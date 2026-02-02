import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SyncIdempotencyService } from './sync.idempotency';
import { SyncConflictResolver } from './sync.conflict';
import { SyncEventApplier } from './sync.applier';
import { SyncDeviceGuard, SyncRateLimitGuard } from './sync.guard';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SyncController],
  providers: [
    SyncService,
    SyncIdempotencyService,
    SyncConflictResolver,
    SyncEventApplier,
    SyncDeviceGuard,
    SyncRateLimitGuard,
  ],
  exports: [SyncService, SyncIdempotencyService],
})
export class SyncModule {}
