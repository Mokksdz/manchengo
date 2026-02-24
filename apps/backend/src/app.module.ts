import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { CsrfMiddleware } from './common/middleware/csrf.middleware';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard, ThrottlerStorage } from '@nestjs/throttler';
import { RedisThrottlerStorage } from './common/throttler/redis-throttler-storage';
import { PrismaModule } from './prisma/prisma.module';
import { LoggerModule } from './common/logger';
import { AuditModule } from './common/audit';
import { AuthModule } from './auth/auth.module';
import { SyncModule } from './modules/sync/sync.module';
import { AdminModule } from './admin/admin.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ExportsModule } from './exports/exports.module';
import { SecurityModule } from './security/security.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { LicensingModule } from './licensing/licensing.module';
import { StockModule } from './stock/stock.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { ProductsModule } from './products/products.module';
import { LotsModule } from './lots/lots.module';
import { ProductionModule } from './production/production.module';
import { DeliveryModule } from './delivery/delivery.module';
import { ApproModule } from './appro/appro.module';
import { GovernanceModule } from './governance/governance.module';
import { RedisCacheModule } from './cache/cache.module';
import { SentryModule } from './common/sentry/sentry.module';
import { HealthModule } from './common/health/health.module';
import { MetricsModule } from './common/metrics/metrics.module';
import { WebSocketModule } from './common/websocket/websocket.module';
import { QueuesModule } from './common/queues/queues.module';
import { EventsModule } from './common/events/events.module';
import { PaginationModule } from './common/pagination/pagination.module';
import { EmailModule } from './common/email';
import { ReportsModule } from './reports/reports.module';
import { AccountingModule } from './accounting/accounting.module';
import { ClientsModule } from './clients/clients.module';
import { InvoicesModule } from './invoices/invoices.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // ═══════════════════════════════════════════════════════════════════════════
    // Rate Limiting - Global throttler
    // ═══════════════════════════════════════════════════════════════════════════
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'short',
            ttl: config.get<number>('THROTTLE_SHORT_TTL', 1000),
            limit: config.get<number>('THROTTLE_SHORT_LIMIT', 10),
          },
          {
            name: 'medium',
            ttl: config.get<number>('THROTTLE_MEDIUM_TTL', 60000),
            limit: config.get<number>('THROTTLE_MEDIUM_LIMIT', 100),
          },
          {
            name: 'long',
            ttl: config.get<number>('THROTTLE_LONG_TTL', 3600000),
            limit: config.get<number>('THROTTLE_LONG_LIMIT', 1000),
          },
        ],
      }),
    }),

    // Scheduling for cron jobs
    ScheduleModule.forRoot(),

    // Error monitoring
    SentryModule,

    // Core modules
    RedisCacheModule, // Global cache (Redis + memory fallback)
    LoggerModule, // Global structured logging
    AuditModule,  // Global audit trail
    GovernanceModule, // Data retention, security hardening, feature flags
    PrismaModule,
    SecurityModule, // Global - provides SecurityLogService, DevicesService
    LicensingModule, // Global - SaaS licensing
    AuthModule,
    SyncModule,
    AdminModule,
    SuppliersModule, // Supplier management with fiscal validation
    ProductsModule, // Product catalog (MP, PF)
    LotsModule, // V1.1 - Lots, DLC, FIFO management
    StockModule, // Stock management - movement-based
    ProductionModule, // Production - Recipes, Orders, FIFO consumption
    DeliveryModule,   // Delivery - QR validation, proof of delivery
    ApproModule,      // Module APPRO PRO - Approvisionnement industriel
    DashboardModule,
    ExportsModule,
    MonitoringModule, // Monitoring & Alerts
    HealthModule,     // R6: Health checks (DB, Redis, memory)
    MetricsModule,    // R17: Prometheus metrics endpoint
    WebSocketModule,  // R18: WebSocket for real-time dashboard
    QueuesModule,     // BullMQ - Async job processing (reports, notifications, alerts)
    EventsModule,     // Event Sourcing - Domain events for full traceability
    PaginationModule, // Cursor & Offset pagination utilities
    EmailModule,      // Global - Nodemailer SMTP email service
    ReportsModule,    // Advanced reporting with PDF/Excel export
    AccountingModule, // Accounting - Journal entries, PC Compta, Sage, VAT
    ClientsModule,    // Client CRUD - Distributeurs, Grossistes, etc.
    InvoicesModule,   // Invoice CRUD - Facturation avec lignes et paiements
  ],
  providers: [
    // Rate limiting - Redis-backed for persistence across restarts
    RedisThrottlerStorage,
    {
      provide: ThrottlerStorage,
      useExisting: RedisThrottlerStorage,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply RequestId middleware to all routes
    consumer.apply(RequestIdMiddleware).forRoutes('*');
    // CSRF protection for state-changing requests
    consumer.apply(CsrfMiddleware).forRoutes('*');
  }
}
