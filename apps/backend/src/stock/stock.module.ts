import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { LotConsumptionService } from './lot-consumption.service';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { StockDashboardService } from './stock-dashboard.service';
import { StockDashboardController } from './stock-dashboard.controller';
import { StockCalculationService } from './stock-calculation.service';
import { LotExpiryJob } from './jobs/lot-expiry.job';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../common/audit/audit.module';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [
    StockController,
    InventoryController,
    StockDashboardController,
  ],
  providers: [
    StockCalculationService,
    StockService,
    LotConsumptionService,
    InventoryService,
    StockDashboardService,
    LotExpiryJob,
  ],
  exports: [
    StockCalculationService,
    StockService,
    LotConsumptionService,
    InventoryService,
    StockDashboardService,
  ],
})
export class StockModule {}
