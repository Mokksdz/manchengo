import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GLOBAL EXCEPTION FILTER — Manchengo Smart ERP
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * R2 + R4: Monitoring des erreurs 500 + Logging structuré avec stack trace
 *
 * Captures ALL unhandled exceptions globally:
 * - HTTP exceptions: returns proper error response
 * - Unknown exceptions: logs full stack trace, returns sanitized 500
 * - Structured JSON logging for ELK/Datadog ingestion
 * - Request ID correlation for tracing
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { status, errorResponse } = this.resolveException(exception);

    // Structured log entry
    const logEntry = {
      timestamp: new Date().toISOString(),
      requestId: (request as any).id || request.headers['x-request-id'] || 'unknown',
      method: request.method,
      url: request.url,
      statusCode: status,
      userId: (request as any).user?.sub || (request as any).user?.id || 'anonymous',
      userAgent: request.headers['user-agent'],
      ip: request.ip || request.socket?.remoteAddress,
      error: errorResponse.error,
      message: errorResponse.message,
    };

    if (status >= 500) {
      // R4: Full stack trace for server errors
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(
        JSON.stringify({
          ...logEntry,
          stack,
          severity: 'ERROR',
          category: 'UNHANDLED_SERVER_ERROR',
        }),
      );
    } else if (status >= 400) {
      // Client errors: warn level
      this.logger.warn(JSON.stringify({ ...logEntry, severity: 'WARN' }));
    }

    // Send sanitized response (never leak internal details in production)
    const isProduction = process.env.NODE_ENV === 'production';

    response.status(status).json({
      success: false,
      statusCode: status,
      error: errorResponse.error,
      message: isProduction && status >= 500
        ? 'Une erreur interne est survenue. Contactez l\'administrateur.'
        : errorResponse.message,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: logEntry.requestId,
    });
  }

  private resolveException(exception: unknown): {
    status: number;
    errorResponse: { error: string; message: string };
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      let message: string;
      let error: string;

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = HttpStatus[status] || 'Error';
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, any>;
        message = Array.isArray(resp.message)
          ? resp.message.join(', ')
          : resp.message || exception.message;
        error = resp.error || HttpStatus[status] || 'Error';
      } else {
        message = exception.message;
        error = HttpStatus[status] || 'Error';
      }

      return { status, errorResponse: { error, message } };
    }

    // Non-HTTP exception = 500
    const message = exception instanceof Error
      ? exception.message
      : 'Unknown error occurred';

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      errorResponse: {
        error: 'Internal Server Error',
        message,
      },
    };
  }
}
