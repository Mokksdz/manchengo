/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PURCHASE ORDER MODULE — Module NestJS Bons de Commande
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * INTÉGRÉ au module APPRO (pas un module autonome)
 * Les BC sont un artefact du flux APPRO, pas un domaine indépendant
 */

import { Module } from '@nestjs/common';
import { PurchaseOrderController } from './purchase-order.controller';
import { PurchaseOrderService } from './purchase-order.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PurchaseOrderController],
  providers: [PurchaseOrderService],
  exports: [PurchaseOrderService],
})
export class PurchaseOrderModule {}
