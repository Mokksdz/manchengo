import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProductMpDto,
  UpdateProductMpDto,
  CreateProductPfDto,
  UpdateProductPfDto,
  ProductMpResponseDto,
  ProductPfResponseDto,
} from './dto/product.dto';

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTS SERVICE - Gestion des articles (MP, PF)
// ═══════════════════════════════════════════════════════════════════════════════
// RÈGLES MÉTIER:
// - Code unique obligatoire (MP-XXX, PF-XXX)
// - Suppression INTERDITE si mouvements existants
// - Désactivation via isActive uniquement
// - Stock calculé dynamiquement via mouvements
// ═══════════════════════════════════════════════════════════════════════════════

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUITS MATIÈRES PREMIÈRES (MP)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Liste tous les produits MP (actifs par défaut)
   */
  async findAllMp(includeInactive = false): Promise<ProductMpResponseDto[]> {
    const products = await this.prisma.productMp.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { code: 'asc' },
      include: {
        _count: {
          select: { stockMovements: true },
        },
      },
    });

    return products.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      unit: p.unit,
      category: (p as any).category || 'RAW_MATERIAL',
      minStock: p.minStock,
      isActive: p.isActive,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      movementCount: p._count.stockMovements,
    }));
  }

  /**
   * Liste tous les emballages (category = PACKAGING)
   */
  async findAllPackaging(): Promise<ProductMpResponseDto[]> {
    const products = await this.prisma.productMp.findMany({
      where: { 
        isActive: true,
        category: 'PACKAGING',
      },
      orderBy: { code: 'asc' },
      include: {
        _count: {
          select: { stockMovements: true },
        },
      },
    });

    return products.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      unit: p.unit,
      category: (p as any).category || 'PACKAGING',
      minStock: p.minStock,
      isActive: p.isActive,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      movementCount: p._count.stockMovements,
    }));
  }

  /**
   * Liste toutes les matières premières (category = RAW_MATERIAL)
   */
  async findAllRawMaterials(): Promise<ProductMpResponseDto[]> {
    const products = await this.prisma.productMp.findMany({
      where: { 
        isActive: true,
        category: 'RAW_MATERIAL',
      },
      orderBy: { code: 'asc' },
      include: {
        _count: {
          select: { stockMovements: true },
        },
      },
    });

    return products.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      unit: p.unit,
      category: (p as any).category || 'RAW_MATERIAL',
      minStock: p.minStock,
      isActive: p.isActive,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      movementCount: p._count.stockMovements,
    }));
  }

  /**
   * Récupère un produit MP par ID
   */
  async findMpById(id: number): Promise<ProductMpResponseDto> {
    const product = await this.prisma.productMp.findUnique({
      where: { id },
      include: {
        _count: {
          select: { stockMovements: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Produit MP #${id} introuvable`);
    }

    return {
      id: product.id,
      code: product.code,
      name: product.name,
      unit: product.unit,
      minStock: product.minStock,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      movementCount: product._count.stockMovements,
    };
  }

  /**
   * Génère le prochain code MP disponible (MP-001, MP-002, etc.)
   */
  async getNextMpCode(): Promise<{ code: string }> {
    const lastProduct = await this.prisma.productMp.findFirst({
      where: { code: { startsWith: 'MP-' } },
      orderBy: { code: 'desc' },
    });

    let nextNumber = 1;
    if (lastProduct) {
      const match = lastProduct.code.match(/MP-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return { code: `MP-${String(nextNumber).padStart(3, '0')}` };
  }

  /**
   * Crée un nouveau produit MP
   */
  async createMp(dto: CreateProductMpDto): Promise<ProductMpResponseDto> {
    // Générer le code si non fourni
    let code = dto.code?.trim().toUpperCase();
    if (!code) {
      const nextCode = await this.getNextMpCode();
      code = nextCode.code;
    }

    // Vérifier l'unicité du code
    const existing = await this.prisma.productMp.findUnique({
      where: { code },
    });

    if (existing) {
      throw new ConflictException(`Le code ${code} existe déjà`);
    }

    const product = await this.prisma.productMp.create({
      data: {
        code,
        name: dto.name.trim(),
        unit: dto.unit.trim(),
        category: dto.category || 'RAW_MATERIAL',
        minStock: dto.minStock ?? 0,
        isStockTracked: dto.isStockTracked ?? true,
        defaultTvaRate: dto.defaultTvaRate ?? 19,
      },
    });

    return {
      id: product.id,
      code: product.code,
      name: product.name,
      unit: product.unit,
      category: product.category,
      minStock: product.minStock,
      isActive: product.isActive,
      isStockTracked: product.isStockTracked,
      defaultTvaRate: product.defaultTvaRate,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      movementCount: 0,
    };
  }

  /**
   * Met à jour un produit MP
   */
  async updateMp(id: number, dto: UpdateProductMpDto): Promise<ProductMpResponseDto> {
    const existing = await this.prisma.productMp.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Produit MP #${id} introuvable`);
    }

    const product = await this.prisma.productMp.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.unit && { unit: dto.unit.trim() }),
        ...(dto.minStock !== undefined && { minStock: dto.minStock }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        _count: {
          select: { stockMovements: true },
        },
      },
    });

    return {
      id: product.id,
      code: product.code,
      name: product.name,
      unit: product.unit,
      minStock: product.minStock,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      movementCount: product._count.stockMovements,
    };
  }

  /**
   * Vérifie si un produit MP peut être supprimé
   */
  async canDeleteMp(id: number): Promise<{ canDelete: boolean; reason?: string }> {
    const product = await this.prisma.productMp.findUnique({
      where: { id },
      include: {
        _count: {
          select: { stockMovements: true, lots: true, receptionLines: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Produit MP #${id} introuvable`);
    }

    if (product._count.stockMovements > 0) {
      return {
        canDelete: false,
        reason: `Ce produit a ${product._count.stockMovements} mouvement(s) de stock. Désactivez-le à la place.`,
      };
    }

    if (product._count.receptionLines > 0) {
      return {
        canDelete: false,
        reason: `Ce produit est utilisé dans ${product._count.receptionLines} ligne(s) de réception. Désactivez-le à la place.`,
      };
    }

    return { canDelete: true };
  }

  /**
   * Désactive un produit MP
   */
  async deactivateMp(id: number): Promise<ProductMpResponseDto> {
    const existing = await this.prisma.productMp.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Produit MP #${id} introuvable`);
    }

    const product = await this.prisma.productMp.update({
      where: { id },
      data: { isActive: false },
      include: {
        _count: {
          select: { stockMovements: true },
        },
      },
    });

    return {
      id: product.id,
      code: product.code,
      name: product.name,
      unit: product.unit,
      minStock: product.minStock,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      movementCount: product._count.stockMovements,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUITS FINIS (PF)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Liste tous les produits PF (actifs par défaut)
   */
  async findAllPf(includeInactive = false): Promise<ProductPfResponseDto[]> {
    const products = await this.prisma.productPf.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { code: 'asc' },
      include: {
        _count: {
          select: { stockMovements: true },
        },
      },
    });

    return products.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      unit: p.unit,
      priceHt: p.priceHt,
      minStock: p.minStock,
      isActive: p.isActive,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      movementCount: p._count.stockMovements,
    }));
  }

  /**
   * Récupère un produit PF par ID
   */
  async findPfById(id: number): Promise<ProductPfResponseDto> {
    const product = await this.prisma.productPf.findUnique({
      where: { id },
      include: {
        _count: {
          select: { stockMovements: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Produit PF #${id} introuvable`);
    }

    return {
      id: product.id,
      code: product.code,
      name: product.name,
      unit: product.unit,
      priceHt: product.priceHt,
      minStock: product.minStock,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      movementCount: product._count.stockMovements,
    };
  }

  /**
   * Crée un nouveau produit PF
   */
  async createPf(dto: CreateProductPfDto): Promise<ProductPfResponseDto> {
    // Vérifier l'unicité du code
    const existing = await this.prisma.productPf.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictException(`Le code ${dto.code} existe déjà`);
    }

    const product = await this.prisma.productPf.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        unit: dto.unit.trim(),
        priceHt: dto.priceHt ?? 0,
        minStock: dto.minStock ?? 0,
      },
    });

    return {
      id: product.id,
      code: product.code,
      name: product.name,
      unit: product.unit,
      priceHt: product.priceHt,
      minStock: product.minStock,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      movementCount: 0,
    };
  }

  /**
   * Met à jour un produit PF
   */
  async updatePf(id: number, dto: UpdateProductPfDto): Promise<ProductPfResponseDto> {
    const existing = await this.prisma.productPf.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Produit PF #${id} introuvable`);
    }

    const product = await this.prisma.productPf.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name.trim() }),
        ...(dto.unit && { unit: dto.unit.trim() }),
        ...(dto.priceHt !== undefined && { priceHt: dto.priceHt }),
        ...(dto.minStock !== undefined && { minStock: dto.minStock }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        _count: {
          select: { stockMovements: true },
        },
      },
    });

    return {
      id: product.id,
      code: product.code,
      name: product.name,
      unit: product.unit,
      priceHt: product.priceHt,
      minStock: product.minStock,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      movementCount: product._count.stockMovements,
    };
  }

  /**
   * Vérifie si un produit PF peut être supprimé
   */
  async canDeletePf(id: number): Promise<{ canDelete: boolean; reason?: string }> {
    const product = await this.prisma.productPf.findUnique({
      where: { id },
      include: {
        _count: {
          select: { stockMovements: true, lots: true, invoiceLines: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Produit PF #${id} introuvable`);
    }

    if (product._count.stockMovements > 0) {
      return {
        canDelete: false,
        reason: `Ce produit a ${product._count.stockMovements} mouvement(s) de stock. Désactivez-le à la place.`,
      };
    }

    if (product._count.invoiceLines > 0) {
      return {
        canDelete: false,
        reason: `Ce produit est utilisé dans ${product._count.invoiceLines} ligne(s) de facture. Désactivez-le à la place.`,
      };
    }

    return { canDelete: true };
  }

  /**
   * Désactive un produit PF
   */
  async deactivatePf(id: number): Promise<ProductPfResponseDto> {
    const existing = await this.prisma.productPf.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Produit PF #${id} introuvable`);
    }

    const product = await this.prisma.productPf.update({
      where: { id },
      data: { isActive: false },
      include: {
        _count: {
          select: { stockMovements: true },
        },
      },
    });

    return {
      id: product.id,
      code: product.code,
      name: product.name,
      unit: product.unit,
      priceHt: product.priceHt,
      minStock: product.minStock,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      movementCount: product._count.stockMovements,
    };
  }
}
