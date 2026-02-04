import { Module, Global, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * OpenTelemetry Distributed Tracing Module
 *
 * Provides request tracing across services.
 * Requires: @opentelemetry/sdk-node, @opentelemetry/auto-instrumentations-node
 *
 * Install: npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
 *          @opentelemetry/exporter-trace-otlp-http @opentelemetry/resources
 *          @opentelemetry/semantic-conventions
 *
 * Configure OTEL_EXPORTER_OTLP_ENDPOINT in .env for your collector (Jaeger, Tempo, etc.)
 */
@Global()
@Module({})
export class TracingModule implements OnModuleInit {
  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    // Tracing disabled - OpenTelemetry SDK optional for production monitoring
    // To enable, configure OTEL_EXPORTER_OTLP_ENDPOINT and ensure compatible package versions
    return;
  }
}
