import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { EventApplierService } from './event-applier.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [SyncController],
  providers: [SyncService, EventApplierService],
  exports: [SyncService],
})
export class SyncModule {}
