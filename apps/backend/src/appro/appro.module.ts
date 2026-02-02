/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * APPRO MODULE - Module NestJS Approvisionnement
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * SOUS-MODULES:
 * - PurchaseOrderModule: Bons de Commande (flux verrouillé depuis Demandes)
 */

import { Module } from '@nestjs/common';
import { ApproController } from './appro.controller';
import { ApproService } from './appro.service';
import { ApproAlertService } from './appro-alert.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PurchaseOrderModule } from './purchase-orders/purchase-order.module';

@Module({
  imports: [PrismaModule, PurchaseOrderModule],
  controllers: [ApproController],
  providers: [ApproService, ApproAlertService],
  exports: [ApproService, ApproAlertService],
})
export class ApproModule {}
