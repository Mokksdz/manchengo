import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import * as Sentry from '@sentry/node';

@Injectable()
export class SentryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      catchError((error) => {
        const request = context.switchToHttp().getRequest();

        Sentry.withScope((scope) => {
          scope.setTag('controller', context.getClass().name);
          scope.setTag('handler', context.getHandler().name);

          if (request?.user) {
            scope.setUser({
              id: request.user.id,
              email: request.user.email,
            });
          }

          scope.setExtra('url', request?.url);
          scope.setExtra('method', request?.method);

          Sentry.captureException(error);
        });

        return throwError(() => error);
      }),
    );
  }
}
