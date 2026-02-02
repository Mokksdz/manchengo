import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthModule } from '../auth/auth.module';
import { SyncModule } from '../sync/sync.module';
import { StockModule } from '../stock/stock.module';

@Module({
  imports: [AuthModule, SyncModule, StockModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
