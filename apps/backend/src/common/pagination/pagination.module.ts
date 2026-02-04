/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PAGINATION MODULE — Manchengo Smart ERP
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Module de pagination performante avec support Cursor et Offset.
 *
 * PAGINATION CURSOR (Recommandée):
 * - Performance O(1) quelque soit la page
 * - Pas de problème de "page drift" lors d'insertions
 * - Idéale pour les grandes listes et le scroll infini
 *
 * PAGINATION OFFSET (Classique):
 * - Permet de sauter à n'importe quelle page
 * - Familière pour les utilisateurs
 * - Moins performante sur grandes tables (O(n))
 *
 * @version 1.0.0
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { Module, Global } from '@nestjs/common';
import { PaginationService } from './pagination.service';
import { PaginationController } from './pagination.controller';

@Global()
@Module({
  controllers: [PaginationController],
  providers: [PaginationService],
  exports: [PaginationService],
})
export class PaginationModule {}
