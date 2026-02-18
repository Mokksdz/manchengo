import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthModule } from '../auth/auth.module';
import { StockModule } from '../stock/stock.module';

@Module({
  imports: [AuthModule, StockModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
