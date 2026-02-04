/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PAGINATION SERVICE — Cursor & Offset Pagination
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Service générique de pagination avec support:
 * - Cursor-based: Pour scroll infini et grandes listes
 * - Offset-based: Pour navigation par pages
 *
 * AVANTAGES CURSOR:
 * ✅ Performance constante O(1)
 * ✅ Pas de page drift
 * ✅ Stable avec insertions/suppressions
 *
 * AVANTAGES OFFSET:
 * ✅ Sauter à une page spécifique
 * ✅ Afficher le numéro de page total
 * ✅ Navigation familière
 *
 * @version 1.0.0
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Direction de tri
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Options de tri
 */
export interface SortOptions {
  field: string;
  direction: SortDirection;
}

/**
 * Requête de pagination par curseur
 */
export interface CursorPaginationRequest {
  cursor?: string;
  limit?: number;
  direction?: 'forward' | 'backward';
  sort?: SortOptions;
}

/**
 * Requête de pagination par offset
 */
export interface OffsetPaginationRequest {
  page?: number;
  limit?: number;
  sort?: SortOptions;
}

/**
 * Résultat de pagination par curseur
 */
export interface CursorPaginatedResult<T> {
  data: T[];
  pagination: {
    cursor: string | null;
    nextCursor: string | null;
    prevCursor: string | null;
    hasMore: boolean;
    hasPrevious: boolean;
    limit: number;
  };
}

/**
 * Résultat de pagination par offset
 */
export interface OffsetPaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

/**
 * Informations de cursor encodées
 */
interface DecodedCursor {
  id: string | number;
  sortValue?: unknown;
  sortField?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

@Injectable()
export class PaginationService {
  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════════
  // CURSOR PAGINATION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Encode un cursor pour la pagination
   */
  encodeCursor(data: DecodedCursor): string {
    return Buffer.from(JSON.stringify(data)).toString('base64url');
  }

  /**
   * Décode un cursor
   */
  decodeCursor(cursor: string): DecodedCursor | null {
    try {
      const decoded = Buffer.from(cursor, 'base64url').toString('utf-8');
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }

  /**
   * Pagination cursor générique pour Prisma
   *
   * @example
   * const result = await paginationService.cursorPaginate(
   *   'productMp',
   *   { isActive: true },
   *   { cursor: 'abc123', limit: 20 },
   *   { field: 'createdAt', direction: 'desc' }
   * );
   */
  async cursorPaginate<T>(
    model: string,
    where: Record<string, unknown>,
    request: CursorPaginationRequest,
    defaultSort: SortOptions = { field: 'id', direction: 'desc' },
    include?: Record<string, unknown>,
  ): Promise<CursorPaginatedResult<T>> {
    const limit = Math.min(request.limit || 20, 100); // Max 100
    const sort = request.sort || defaultSort;
    const direction = request.direction || 'forward';

    // Construire la query
    const prismaModel = (this.prisma as any)[model];
    if (!prismaModel) {
      throw new Error(`Model "${model}" not found`);
    }

    // Décoder le cursor si présent
    let cursorWhere = {};
    if (request.cursor) {
      const decoded = this.decodeCursor(request.cursor);
      if (decoded) {
        cursorWhere = this.buildCursorWhere(decoded, sort, direction);
      }
    }

    // Combiner les conditions
    const finalWhere = {
      ...where,
      ...cursorWhere,
    };

    // Déterminer l'ordre
    const orderDirection = direction === 'forward'
      ? sort.direction
      : sort.direction === 'asc' ? 'desc' : 'asc';

    // Fetch limit + 1 pour détecter hasMore
    const items = await prismaModel.findMany({
      where: finalWhere,
      orderBy: { [sort.field]: orderDirection },
      take: limit + 1,
      ...(include && { include }),
    });

    // Déterminer si il y a plus de résultats
    const hasMore = items.length > limit;
    if (hasMore) {
      items.pop(); // Retirer l'élément en trop
    }

    // Si direction backward, inverser les résultats
    if (direction === 'backward') {
      items.reverse();
    }

    // Générer les cursors
    const firstItem = items[0];
    const lastItem = items[items.length - 1];

    const nextCursor = hasMore && lastItem
      ? this.encodeCursor({
          id: lastItem.id,
          sortValue: lastItem[sort.field],
          sortField: sort.field,
        })
      : null;

    const prevCursor = request.cursor && firstItem
      ? this.encodeCursor({
          id: firstItem.id,
          sortValue: firstItem[sort.field],
          sortField: sort.field,
        })
      : null;

    return {
      data: items as T[],
      pagination: {
        cursor: request.cursor || null,
        nextCursor,
        prevCursor,
        hasMore,
        hasPrevious: !!request.cursor,
        limit,
      },
    };
  }

  /**
   * Construit la clause WHERE pour le cursor
   */
  private buildCursorWhere(
    cursor: DecodedCursor,
    sort: SortOptions,
    direction: 'forward' | 'backward',
  ): Record<string, unknown> {
    const operator = direction === 'forward'
      ? sort.direction === 'asc' ? 'gt' : 'lt'
      : sort.direction === 'asc' ? 'lt' : 'gt';

    // Si on trie par un champ autre que id, on utilise une comparaison composée
    if (cursor.sortField && cursor.sortField !== 'id') {
      return {
        OR: [
          // Même valeur de sort, comparer par id
          {
            [cursor.sortField]: cursor.sortValue,
            id: { [operator]: cursor.id },
          },
          // Valeur de sort différente
          {
            [cursor.sortField]: { [operator]: cursor.sortValue },
          },
        ],
      };
    }

    // Tri simple par id
    return {
      id: { [operator]: cursor.id },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // OFFSET PAGINATION
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Pagination offset générique pour Prisma
   *
   * @example
   * const result = await paginationService.offsetPaginate(
   *   'productMp',
   *   { isActive: true },
   *   { page: 1, limit: 20 }
   * );
   */
  async offsetPaginate<T>(
    model: string,
    where: Record<string, unknown>,
    request: OffsetPaginationRequest,
    defaultSort: SortOptions = { field: 'id', direction: 'desc' },
    include?: Record<string, unknown>,
  ): Promise<OffsetPaginatedResult<T>> {
    const page = Math.max(request.page || 1, 1);
    const limit = Math.min(request.limit || 20, 100);
    const sort = request.sort || defaultSort;
    const skip = (page - 1) * limit;

    const prismaModel = (this.prisma as any)[model];
    if (!prismaModel) {
      throw new Error(`Model "${model}" not found`);
    }

    // Exécuter count et findMany en parallèle
    const [total, items] = await Promise.all([
      prismaModel.count({ where }),
      prismaModel.findMany({
        where,
        orderBy: { [sort.field]: sort.direction },
        skip,
        take: limit,
        ...(include && { include }),
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: items as T[],
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SPECIALIZED METHODS FOR COMMON USE CASES
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Pagination cursor pour les MP
   */
  async paginateMp(
    where: Record<string, unknown>,
    request: CursorPaginationRequest,
  ): Promise<CursorPaginatedResult<any>> {
    return this.cursorPaginate(
      'productMp',
      { ...where, isActive: true },
      request,
      { field: 'code', direction: 'asc' },
      { category: true },
    );
  }

  /**
   * Pagination cursor pour les PF
   */
  async paginatePf(
    where: Record<string, unknown>,
    request: CursorPaginationRequest,
  ): Promise<CursorPaginatedResult<any>> {
    return this.cursorPaginate(
      'productPf',
      { ...where, isActive: true },
      request,
      { field: 'code', direction: 'asc' },
      { category: true },
    );
  }

  /**
   * Pagination cursor pour les mouvements de stock
   */
  async paginateStockMovements(
    where: Record<string, unknown>,
    request: CursorPaginationRequest,
  ): Promise<CursorPaginatedResult<any>> {
    return this.cursorPaginate(
      'stockMovement',
      { ...where, isDeleted: false },
      request,
      { field: 'createdAt', direction: 'desc' },
      {
        productMp: { select: { id: true, code: true, name: true } },
        productPf: { select: { id: true, code: true, name: true } },
      },
    );
  }

  /**
   * Pagination cursor pour les ordres de production
   */
  async paginateProductionOrders(
    where: Record<string, unknown>,
    request: CursorPaginationRequest,
  ): Promise<CursorPaginatedResult<any>> {
    return this.cursorPaginate(
      'productionOrder',
      where,
      request,
      { field: 'createdAt', direction: 'desc' },
      {
        recipe: {
          select: {
            id: true,
            name: true,
            productPf: { select: { id: true, code: true, name: true } },
          },
        },
      },
    );
  }

  /**
   * Pagination cursor pour les fournisseurs
   */
  async paginateSuppliers(
    where: Record<string, unknown>,
    request: CursorPaginationRequest,
  ): Promise<CursorPaginatedResult<any>> {
    return this.cursorPaginate(
      'supplier',
      { ...where, isActive: true },
      request,
      { field: 'name', direction: 'asc' },
      {
        _count: { select: { products: true } },
      },
    );
  }

  /**
   * Pagination cursor pour les lots
   */
  async paginateLots(
    where: Record<string, unknown>,
    request: CursorPaginationRequest,
  ): Promise<CursorPaginatedResult<any>> {
    return this.cursorPaginate(
      'lot',
      where,
      request,
      { field: 'createdAt', direction: 'desc' },
      {
        productMp: { select: { id: true, code: true, name: true } },
      },
    );
  }

  /**
   * Pagination cursor pour les alertes APPRO
   */
  async paginateApproAlerts(
    where: Record<string, unknown>,
    request: CursorPaginationRequest,
  ): Promise<CursorPaginatedResult<any>> {
    return this.cursorPaginate(
      'approAlert',
      where,
      request,
      { field: 'createdAt', direction: 'desc' },
      {
        acknowledgedByUser: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    );
  }

  /**
   * Pagination cursor pour les bons de commande
   */
  async paginatePurchaseOrders(
    where: Record<string, unknown>,
    request: CursorPaginationRequest,
  ): Promise<CursorPaginatedResult<any>> {
    return this.cursorPaginate(
      'purchaseOrder',
      where,
      request,
      { field: 'createdAt', direction: 'desc' },
      {
        supplier: { select: { id: true, code: true, name: true, grade: true } },
        items: {
          include: {
            productMp: { select: { id: true, code: true, name: true } },
          },
        },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    );
  }

  /**
   * Pagination cursor pour les audit logs
   */
  async paginateAuditLogs(
    where: Record<string, unknown>,
    request: CursorPaginationRequest,
  ): Promise<CursorPaginatedResult<any>> {
    return this.cursorPaginate(
      'auditLog',
      where,
      request,
      { field: 'timestamp', direction: 'desc' },
    );
  }

  /**
   * Pagination cursor pour les events domain
   */
  async paginateDomainEvents(
    where: Record<string, unknown>,
    request: CursorPaginationRequest,
  ): Promise<CursorPaginatedResult<any>> {
    return this.cursorPaginate(
      'domainEvent',
      where,
      request,
      { field: 'version', direction: 'desc' },
    );
  }
}
