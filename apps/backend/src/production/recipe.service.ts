import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecipeItemType } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════════
// RECIPE SERVICE - Gestion des recettes de production
// ═══════════════════════════════════════════════════════════════════════════════

interface CreateRecipeDto {
  productPfId: number;
  name: string;
  description?: string;
  batchWeight: number;
  outputQuantity: number;
  lossTolerance?: number;
  productionTime?: number;
  shelfLifeDays?: number;
  items: CreateRecipeItemDto[];
}

// DTO pour créer un composant de recette (MP, FLUID ou PACKAGING)
interface CreateRecipeItemDto {
  type?: RecipeItemType;       // MP, FLUID, PACKAGING (default: MP)
  productMpId?: number;        // ID produit (MP ou PACKAGING)
  name?: string;               // Nom (pour FLUID: "Eau", "Vapeur")
  quantity: number;
  unit: string;
  unitCost?: number;           // Coût unitaire (optionnel, pour FLUID)
  affectsStock?: boolean;      // Impact stock (false pour FLUID)
  isMandatory?: boolean;
  isSubstitutable?: boolean;
  substituteIds?: number[];
  sortOrder?: number;
  notes?: string;
}

interface UpdateRecipeDto {
  name?: string;
  description?: string;
  batchWeight?: number;
  outputQuantity?: number;
  lossTolerance?: number;
  productionTime?: number;
  shelfLifeDays?: number;
  isActive?: boolean;
}

@Injectable()
export class RecipeService {
  constructor(private prisma: PrismaService) {}

  /**
   * Récupérer toutes les recettes
   */
  async findAll(includeInactive = false) {
    const where = includeInactive ? {} : { isActive: true };
    
    const recipes = await this.prisma.recipe.findMany({
      where,
      include: {
        productPf: {
          select: { id: true, code: true, name: true, unit: true, priceHt: true },
        },
        items: {
          include: {
            productMp: {
              select: { id: true, code: true, name: true, unit: true },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: { productionOrders: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return recipes.map((r) => ({
      id: r.id,
      productPfId: r.productPfId,
      productPf: r.productPf,
      name: r.name,
      description: r.description,
      batchWeight: r.batchWeight,
      outputQuantity: r.outputQuantity,
      lossTolerance: r.lossTolerance,
      productionTime: r.productionTime,
      shelfLifeDays: r.shelfLifeDays,
      isActive: r.isActive,
      version: r.version,
      itemsCount: r.items.length,
      productionOrdersCount: r._count.productionOrders,
      items: r.items.map((item) => ({
        id: item.id,
        productMpId: item.productMpId,
        productMp: item.productMp,
        quantity: item.quantity,
        unit: item.unit,
        isMandatory: item.isMandatory,
        isSubstitutable: item.isSubstitutable,
        substituteIds: item.substituteIds,
        sortOrder: item.sortOrder,
        notes: item.notes,
      })),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  /**
   * Récupérer une recette par ID
   */
  async findById(id: number) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id },
      include: {
        productPf: {
          select: { id: true, code: true, name: true, unit: true, priceHt: true },
        },
        items: {
          include: {
            productMp: {
              select: { id: true, code: true, name: true, unit: true },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: { productionOrders: true },
        },
      },
    });

    if (!recipe) {
      throw new NotFoundException(`Recette #${id} introuvable`);
    }

    return recipe;
  }

  /**
   * Récupérer la recette d'un produit fini
   */
  async findByProductPfId(productPfId: number) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { productPfId },
      include: {
        productPf: {
          select: { id: true, code: true, name: true, unit: true, priceHt: true },
        },
        items: {
          include: {
            productMp: {
              select: { id: true, code: true, name: true, unit: true },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    return recipe;
  }

  /**
   * Créer une nouvelle recette
   */
  async create(dto: CreateRecipeDto, userId: string) {
    // Vérifier que le produit PF existe
    const productPf = await this.prisma.productPf.findUnique({
      where: { id: dto.productPfId },
    });

    if (!productPf) {
      throw new NotFoundException(`Produit fini #${dto.productPfId} introuvable`);
    }

    // Vérifier qu'une recette n'existe pas déjà pour ce produit
    const existingRecipe = await this.prisma.recipe.findUnique({
      where: { productPfId: dto.productPfId },
    });

    if (existingRecipe) {
      throw new BadRequestException(`Une recette existe déjà pour ce produit (ID: ${existingRecipe.id})`);
    }

    // Vérifier que les produits MP/Packaging existent (sauf FLUID)
    const itemsWithProduct = dto.items.filter((i) => i.type !== 'FLUID' && i.productMpId);
    const mpIds = itemsWithProduct.map((i) => i.productMpId!);
    
    if (mpIds.length > 0) {
      const existingMps = await this.prisma.productMp.findMany({
        where: { id: { in: mpIds } },
        select: { id: true },
      });

      if (existingMps.length !== mpIds.length) {
        const foundIds = existingMps.map((p) => p.id);
        const missingIds = mpIds.filter((id) => !foundIds.includes(id));
        throw new BadRequestException(`Produits introuvables: ${missingIds.join(', ')}`);
      }
    }

    // Créer la recette avec ses items
    const recipe = await this.prisma.recipe.create({
      data: {
        productPfId: dto.productPfId,
        name: dto.name,
        description: dto.description,
        batchWeight: dto.batchWeight,
        outputQuantity: dto.outputQuantity,
        lossTolerance: dto.lossTolerance ?? 0.02,
        productionTime: dto.productionTime,
        shelfLifeDays: dto.shelfLifeDays ?? 90,
        createdBy: userId,
        items: {
          create: dto.items.map((item, index) => ({
            type: item.type || 'MP',
            productMpId: item.type === 'FLUID' ? null : item.productMpId,
            name: item.type === 'FLUID' ? (item.name || 'Eau') : null,
            quantity: item.quantity,
            unit: item.unit,
            unitCost: item.unitCost,
            affectsStock: item.affectsStock ?? (item.type === 'FLUID' ? false : true),
            isMandatory: item.isMandatory ?? true,
            isSubstitutable: item.isSubstitutable ?? false,
            substituteIds: item.substituteIds ?? [],
            sortOrder: item.sortOrder ?? index,
            notes: item.notes,
          })),
        },
      },
      include: {
        productPf: {
          select: { id: true, code: true, name: true, unit: true },
        },
        items: {
          include: {
            productMp: {
              select: { id: true, code: true, name: true, unit: true },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    return recipe;
  }

  /**
   * Mettre à jour une recette (paramètres uniquement, pas les items)
   */
  async update(id: number, dto: UpdateRecipeDto) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id },
    });

    if (!recipe) {
      throw new NotFoundException(`Recette #${id} introuvable`);
    }

    // Bug #45: Validate batchWeight and outputQuantity
    if (dto.batchWeight !== undefined && dto.batchWeight <= 0) {
      throw new BadRequestException('Le poids du batch doit être supérieur à 0');
    }
    if (dto.outputQuantity !== undefined && dto.outputQuantity <= 0) {
      throw new BadRequestException('La quantité de sortie doit être supérieure à 0');
    }

    // Bug #48: Check for active production orders before modifying recipe
    const activeOrders = await this.prisma.productionOrder.count({
      where: { recipeId: id, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    });
    if (activeOrders > 0) {
      throw new BadRequestException(`Impossible de modifier la recette: ${activeOrders} ordre(s) de production en cours`);
    }

    const updated = await this.prisma.recipe.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        batchWeight: dto.batchWeight,
        outputQuantity: dto.outputQuantity,
        lossTolerance: dto.lossTolerance,
        productionTime: dto.productionTime,
        shelfLifeDays: dto.shelfLifeDays,
        isActive: dto.isActive,
        version: { increment: 1 },
      },
      include: {
        productPf: {
          select: { id: true, code: true, name: true, unit: true },
        },
        items: {
          include: {
            productMp: {
              select: { id: true, code: true, name: true, unit: true },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    return updated;
  }

  /**
   * Ajouter un item à une recette (MP, FLUID ou PACKAGING)
   */
  async addItem(recipeId: number, dto: CreateRecipeItemDto) {
    // Bug #47b: Validate productMpId for MP items
    if ((!dto.type || dto.type === 'MP') && !dto.productMpId) {
      throw new BadRequestException('productMpId est obligatoire pour les items de type MP');
    }

    const recipe = await this.prisma.recipe.findUnique({
      where: { id: recipeId },
    });

    if (!recipe) {
      throw new NotFoundException(`Recette #${recipeId} introuvable`);
    }

    // Bug #48: Check for active production orders before modifying recipe
    const activeOrders = await this.prisma.productionOrder.count({
      where: { recipeId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    });
    if (activeOrders > 0) {
      throw new BadRequestException(`Impossible de modifier la recette: ${activeOrders} ordre(s) de production en cours`);
    }

    const itemType = dto.type || 'MP';

    // Pour MP et PACKAGING, vérifier que le produit existe
    if (itemType !== 'FLUID' && dto.productMpId) {
      const productMp = await this.prisma.productMp.findUnique({
        where: { id: dto.productMpId },
      });

      if (!productMp) {
        throw new NotFoundException(`Produit #${dto.productMpId} introuvable`);
      }

      // Vérifier si ce produit existe déjà dans la recette
      const existing = await this.prisma.recipeItem.findFirst({
        where: {
          recipeId,
          productMpId: dto.productMpId,
        },
      });

      if (existing) {
        throw new BadRequestException(`Ce produit existe déjà dans la recette`);
      }
    }

    // Déterminer le sortOrder max
    const lastItem = await this.prisma.recipeItem.findFirst({
      where: { recipeId },
      orderBy: { sortOrder: 'desc' },
    });

    const item = await this.prisma.recipeItem.create({
      data: {
        recipeId,
        type: itemType,
        productMpId: itemType === 'FLUID' ? null : dto.productMpId,
        name: itemType === 'FLUID' ? (dto.name || 'Eau') : null,
        quantity: dto.quantity,
        unit: dto.unit,
        unitCost: dto.unitCost,
        affectsStock: dto.affectsStock ?? (itemType === 'FLUID' ? false : true),
        isMandatory: dto.isMandatory ?? true,
        isSubstitutable: dto.isSubstitutable ?? false,
        substituteIds: dto.substituteIds ?? [],
        sortOrder: dto.sortOrder ?? (lastItem ? lastItem.sortOrder + 1 : 0),
        notes: dto.notes,
      },
      include: {
        productMp: {
          select: { id: true, code: true, name: true, unit: true },
        },
      },
    });

    // Incrémenter la version de la recette
    await this.prisma.recipe.update({
      where: { id: recipeId },
      data: { version: { increment: 1 } },
    });

    return item;
  }

  /**
   * Mettre à jour un item de recette
   */
  async updateItem(
    recipeId: number,
    itemId: number,
    dto: Partial<CreateRecipeItemDto>,
  ) {
    const item = await this.prisma.recipeItem.findFirst({
      where: { id: itemId, recipeId },
    });

    if (!item) {
      throw new NotFoundException(`Item #${itemId} introuvable dans la recette #${recipeId}`);
    }

    const updated = await this.prisma.recipeItem.update({
      where: { id: itemId },
      data: {
        quantity: dto.quantity,
        unit: dto.unit,
        isMandatory: dto.isMandatory,
        isSubstitutable: dto.isSubstitutable,
        substituteIds: dto.substituteIds,
        sortOrder: dto.sortOrder,
        notes: dto.notes,
      },
      include: {
        productMp: {
          select: { id: true, code: true, name: true, unit: true },
        },
      },
    });

    // Incrémenter la version de la recette
    await this.prisma.recipe.update({
      where: { id: recipeId },
      data: { version: { increment: 1 } },
    });

    return updated;
  }

  /**
   * Supprimer un item de recette
   */
  async removeItem(recipeId: number, itemId: number) {
    const item = await this.prisma.recipeItem.findFirst({
      where: { id: itemId, recipeId },
    });

    if (!item) {
      throw new NotFoundException(`Item #${itemId} introuvable dans la recette #${recipeId}`);
    }

    // Bug #48: Check for active production orders before modifying recipe
    const activeOrders = await this.prisma.productionOrder.count({
      where: { recipeId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    });
    if (activeOrders > 0) {
      throw new BadRequestException(`Impossible de modifier la recette: ${activeOrders} ordre(s) de production en cours`);
    }

    await this.prisma.recipeItem.delete({
      where: { id: itemId },
    });

    // Incrémenter la version de la recette
    await this.prisma.recipe.update({
      where: { id: recipeId },
      data: { version: { increment: 1 } },
    });

    return { deleted: true };
  }

  /**
   * Calculer les besoins en MP pour une quantité donnée
   */
  async calculateRequirements(recipeId: number, batchCount: number) {
    const recipe = await this.findById(recipeId);

    const requirements = recipe.items.map((item) => ({
      productMpId: item.productMpId,
      productMp: item.productMp,
      quantityPerBatch: item.quantity,
      totalQuantity: Number(item.quantity) * batchCount,
      unit: item.unit,
      isMandatory: item.isMandatory,
    }));

    return {
      recipeId,
      recipeName: recipe.name,
      batchCount,
      outputQuantity: recipe.outputQuantity * batchCount,
      requirements,
    };
  }

  /**
   * Vérifier la disponibilité des stocks pour une production
   */
  async checkStockAvailability(recipeId: number, batchCount: number) {
    const recipe = await this.findById(recipeId);

    // Filtrer uniquement les items qui affectent le stock (pas FLUID)
    const stockItems = recipe.items.filter((item: any) => 
      item.affectsStock !== false && item.productMpId
    );

    const availability = await Promise.all(
      stockItems.map(async (item: any) => {
        const requiredQty = item.quantity * batchCount;

        // Calculer stock disponible (lots AVAILABLE, non expirés, avec quantité > 0)
        // IMPORTANT: Aligné avec lot-consumption.service.ts qui filtre aussi par status AVAILABLE
        const lots = await this.prisma.lotMp.findMany({
          where: {
            productId: item.productMpId,
            status: 'AVAILABLE',
            quantityRemaining: { gt: 0 },
            OR: [
              { expiryDate: null },
              { expiryDate: { gt: new Date() } },
            ],
          },
          select: {
            id: true,
            lotNumber: true,
            quantityRemaining: true,
            expiryDate: true,
          },
          orderBy: [
            { expiryDate: 'asc' },
            { createdAt: 'asc' },
          ],
        });

        const totalAvailable = lots.reduce((sum, l) => sum + l.quantityRemaining, 0);
        const isAvailable = totalAvailable >= requiredQty;

        return {
          productMpId: item.productMpId,
          productMp: item.productMp,
          requiredQuantity: requiredQty,
          availableQuantity: totalAvailable,
          isAvailable,
          isMandatory: item.isMandatory,
          shortage: isAvailable ? 0 : requiredQty - totalAvailable,
          lots: lots.slice(0, 5), // Top 5 lots FIFO
        };
      }),
    );

    const canProduce = availability
      .filter((a) => a.isMandatory)
      .every((a) => a.isAvailable);

    return {
      recipeId,
      recipeName: recipe.name,
      batchCount,
      targetOutput: recipe.outputQuantity * batchCount,
      canProduce,
      availability,
    };
  }
}
