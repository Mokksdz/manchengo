import { Module } from '@nestjs/common';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SecurityModule } from '../security/security.module';

// ═══════════════════════════════════════════════════════════════════════════════
// DELIVERY MODULE - QR Code Validation & Proof of Delivery
// ═══════════════════════════════════════════════════════════════════════════════
// Features:
// - Secure QR code validation with SHA256 checksum
// - Anti-double validation (atomic transactions)
// - Complete audit trail
// - Device/User validation
// - Proof of delivery capture (photo, signature)
// ═══════════════════════════════════════════════════════════════════════════════

@Module({
  imports: [
    PrismaModule,
    SecurityModule, // For SecurityLogService
  ],
  controllers: [DeliveryController],
  providers: [DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
