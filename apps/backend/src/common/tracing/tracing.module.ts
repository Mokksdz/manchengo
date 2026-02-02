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
    const otlpEndpoint = this.configService.get<string>('OTEL_EXPORTER_OTLP_ENDPOINT');
    const isProduction = this.configService.get('NODE_ENV') === 'production';

    if (!otlpEndpoint) {
      return; // Tracing disabled if no endpoint configured
    }

    try {
      const { NodeSDK } = await import('@opentelemetry/sdk-node');
      const { getNodeAutoInstrumentations } = await import(
        '@opentelemetry/auto-instrumentations-node'
      );
      const { OTLPTraceExporter } = await import(
        '@opentelemetry/exporter-trace-otlp-http'
      );
      const { Resource } = await import('@opentelemetry/resources');
      const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = await import(
        '@opentelemetry/semantic-conventions'
      );

      const sdk = new NodeSDK({
        resource: new Resource({
          [ATTR_SERVICE_NAME]: 'manchengo-backend',
          [ATTR_SERVICE_VERSION]: '1.0.0',
          'deployment.environment': this.configService.get('NODE_ENV', 'development'),
        }),
        traceExporter: new OTLPTraceExporter({
          url: `${otlpEndpoint}/v1/traces`,
        }),
        instrumentations: [
          getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-http': {
              ignoreIncomingRequestHook: (req) => {
                // Don't trace health checks
                return req.url?.includes('/health') || false;
              },
            },
            '@opentelemetry/instrumentation-express': { enabled: true },
            '@opentelemetry/instrumentation-pg': { enabled: true },
            '@opentelemetry/instrumentation-redis': { enabled: true },
          }),
        ],
      });

      sdk.start();

      // Graceful shutdown
      process.on('SIGTERM', () => {
        sdk.shutdown().catch(console.error);
      });
    } catch {
      // OpenTelemetry packages not installed, silently skip
      if (isProduction) {
        console.warn('OpenTelemetry packages not installed. Tracing disabled.');
      }
    }
  }
}
