import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { MonitoringService } from './monitoring.service';
import { AlertsService } from './alerts.service';
import { MonitoringController } from './monitoring.controller';

/**
 * Monitoring Module
 * 
 * Provides system monitoring and operational alerts:
 * - KPI computation from PostgreSQL data
 * - Alert detection for sync, stock, fiscal, security issues
 * - Scheduled alert checks (cron)
 * - Admin endpoints for alert management
 */
@Module({
  imports: [
    PrismaModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [MonitoringController],
  providers: [MonitoringService, AlertsService],
  exports: [MonitoringService, AlertsService],
})
export class MonitoringModule {}
