/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * MANCHENGO ERP - SEED PRODUITS CATALOGUE COMPLET
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Script de seed idempotent pour créer l'intégralité du catalogue produits
 * de la SARL MANCHENGO.
 * 
 * MARQUES:
 * - MONTESA® : Fromages nobles (découpe) + Fromages fondus
 * - QUESA NOVA® : Préparations alimentaires au fromage
 * 
 * FAMILLES:
 * - Fromages nobles (découpe) : Gouda, Cheddar, Maasdam, Edam
 * - Fromages fondus : Seaux IML, Portions
 * - Préparations alimentaires : Seaux IML
 * 
 * @author Manchengo ERP Team
 * @version 1.0.0
 * @date 2025-12-27
 */

import { PrismaClient, PackagingType, StorageType, ProductMpCategory } from '@prisma/client';

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════════════
// DONNÉES RÉFÉRENTIELLES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Marques commerciales Manchengo
 */
const BRANDS = [
  {
    code: 'MONTESA',
    name: 'MONTESA®',
    description: 'Marque premium de fromages nobles et fondus - SARL Manchengo',
  },
  {
    code: 'QUESA_NOVA',
    name: 'QUESA NOVA®',
    description: 'Préparations alimentaires au fromage - SARL Manchengo',
  },
] as const;

/**
 * Familles de produits
 */
const PRODUCT_FAMILIES = [
  {
    code: 'FROMAGE_NOBLE',
    name: 'Fromages nobles (découpe)',
    description: 'Fromages entiers ou en découpe : Gouda, Cheddar, Maasdam, Edam. Emballage sac thermorétractable.',
  },
  {
    code: 'FROMAGE_FONDU',
    name: 'Fromages fondus',
    description: 'Fromages fondus en seaux IML ou portions. Process de fonte industriel.',
  },
  {
    code: 'PREPARATION',
    name: 'Préparations alimentaires',
    description: 'Préparations alimentaires au fromage pour usage professionnel.',
  },
] as const;

/**
 * Catalogue Produits Finis MONTESA® - Fromages Nobles (Découpe)
 * Emballage: Sac thermorétractable + Étiquette adhésive
 */
const MONTESA_FROMAGES_NOBLES = [
  // GOUDA
  {
    code: 'PF-MTN-GDA-400',
    name: 'Gouda MONTESA® 400g',
    shortName: 'Gouda 400g',
    weightGrams: 400,
    packagingType: PackagingType.SAC_THERMO,
    shelfLifeDays: 180, // 6 mois
  },
  {
    code: 'PF-MTN-GDA-2000',
    name: 'Gouda MONTESA® 2kg',
    shortName: 'Gouda 2kg',
    weightGrams: 2000,
    packagingType: PackagingType.SAC_THERMO,
    shelfLifeDays: 180,
  },
  // CHEDDAR
  {
    code: 'PF-MTN-CHD-400',
    name: 'Cheddar MONTESA® 400g',
    shortName: 'Cheddar 400g',
    weightGrams: 400,
    packagingType: PackagingType.SAC_THERMO,
    shelfLifeDays: 180,
  },
  {
    code: 'PF-MTN-CHD-2000',
    name: 'Cheddar MONTESA® 2kg',
    shortName: 'Cheddar 2kg',
    weightGrams: 2000,
    packagingType: PackagingType.SAC_THERMO,
    shelfLifeDays: 180,
  },
  // MAASDAM
  {
    code: 'PF-MTN-MSD-2000',
    name: 'Maasdam MONTESA® 2kg',
    shortName: 'Maasdam 2kg',
    weightGrams: 2000,
    packagingType: PackagingType.SAC_THERMO,
    shelfLifeDays: 180,
  },
  // EDAM - Différentes découpes
  {
    code: 'PF-MTN-EDM-BOULE',
    name: 'Edam MONTESA® Boule entière',
    shortName: 'Edam Boule',
    weightGrams: 1800, // ~1.8kg boule standard
    packagingType: PackagingType.SAC_THERMO,
    shelfLifeDays: 180,
  },
  {
    code: 'PF-MTN-EDM-DEMI',
    name: 'Edam MONTESA® Demi-boule',
    shortName: 'Edam Demi-boule',
    weightGrams: 900, // ~900g
    packagingType: PackagingType.SAC_THERMO,
    shelfLifeDays: 180,
  },
  {
    code: 'PF-MTN-EDM-LUNE',
    name: 'Edam MONTESA® Demi-lune',
    shortName: 'Edam Demi-lune',
    weightGrams: 900,
    packagingType: PackagingType.SAC_THERMO,
    shelfLifeDays: 180,
  },
];

/**
 * Catalogue Produits Finis MONTESA® - Fromages Fondus
 * Emballage: Seaux plastique IML ou Barquettes IML
 */
const MONTESA_FROMAGES_FONDUS = [
  // MONTESA S - Seaux IML
  {
    code: 'PF-MTN-FND-1600',
    name: 'Montesa S Fromage fondu 1.6kg',
    shortName: 'Montesa S 1.6kg',
    weightGrams: 1600,
    packagingType: PackagingType.SEAU_IML,
    shelfLifeDays: 365, // 1 an
  },
  {
    code: 'PF-MTN-FND-800',
    name: 'Montesa S Fromage fondu 800g',
    shortName: 'Montesa S 800g',
    weightGrams: 800,
    packagingType: PackagingType.SEAU_IML,
    shelfLifeDays: 365,
  },
  {
    code: 'PF-MTN-FND-400',
    name: 'Montesa S Fromage fondu 400g',
    shortName: 'Montesa S 400g',
    weightGrams: 400,
    packagingType: PackagingType.SEAU_IML,
    shelfLifeDays: 365,
  },
  // PORTIONS - Barquette IML
  {
    code: 'PF-MTN-POR-BRQ',
    name: 'Fromage fondu MONTESA® Portions',
    shortName: 'Portions Barquette',
    weightGrams: 140, // 8 portions x 17.5g standard
    packagingType: PackagingType.BARQUETTE_IML,
    shelfLifeDays: 365,
  },
];

/**
 * Catalogue Produits Finis QUESA NOVA®
 * Préparations alimentaires au fromage - Usage professionnel
 */
const QUESA_NOVA_PREPARATIONS = [
  {
    code: 'PF-QNV-PRE-2000',
    name: 'Préparation alimentaire au fromage QUESA NOVA® 2kg',
    shortName: 'Prépa Fromage 2kg',
    weightGrams: 2000,
    packagingType: PackagingType.SEAU_IML,
    shelfLifeDays: 365,
  },
];

/**
 * Matières Premières - Emballages
 * Utilisés dans les recettes de production
 */
const EMBALLAGES_MP = [
  // Seaux IML
  {
    code: 'MP-EMB-SEAU-1600',
    name: 'Seau plastique IML 1.6kg',
    unit: 'unité',
    category: ProductMpCategory.PACKAGING,
    minStock: 500,
  },
  {
    code: 'MP-EMB-SEAU-800',
    name: 'Seau plastique IML 800g',
    unit: 'unité',
    category: ProductMpCategory.PACKAGING,
    minStock: 500,
  },
  {
    code: 'MP-EMB-SEAU-400',
    name: 'Seau plastique IML 400g',
    unit: 'unité',
    category: ProductMpCategory.PACKAGING,
    minStock: 500,
  },
  {
    code: 'MP-EMB-SEAU-2000',
    name: 'Seau plastique IML 2kg',
    unit: 'unité',
    category: ProductMpCategory.PACKAGING,
    minStock: 500,
  },
  // Barquettes
  {
    code: 'MP-EMB-BRQ-POR',
    name: 'Barquette IML Portions',
    unit: 'unité',
    category: ProductMpCategory.PACKAGING,
    minStock: 1000,
  },
  // Sacs thermorétractables
  {
    code: 'MP-EMB-SAC-400',
    name: 'Sac thermorétractable 400g',
    unit: 'unité',
    category: ProductMpCategory.PACKAGING,
    minStock: 1000,
  },
  {
    code: 'MP-EMB-SAC-2000',
    name: 'Sac thermorétractable 2kg',
    unit: 'unité',
    category: ProductMpCategory.PACKAGING,
    minStock: 500,
  },
  {
    code: 'MP-EMB-SAC-BOULE',
    name: 'Sac thermorétractable Boule Edam',
    unit: 'unité',
    category: ProductMpCategory.PACKAGING,
    minStock: 500,
  },
  // Étiquettes
  {
    code: 'MP-EMB-ETQ-MONTESA',
    name: 'Étiquette adhésive MONTESA®',
    unit: 'unité',
    category: ProductMpCategory.PACKAGING,
    minStock: 5000,
  },
  {
    code: 'MP-EMB-ETQ-QUESA',
    name: 'Étiquette adhésive QUESA NOVA®',
    unit: 'unité',
    category: ProductMpCategory.PACKAGING,
    minStock: 2000,
  },
  // Cartons
  {
    code: 'MP-EMB-CTN-12',
    name: 'Carton 12 unités',
    unit: 'unité',
    category: ProductMpCategory.PACKAGING,
    minStock: 200,
  },
  {
    code: 'MP-EMB-CTN-6',
    name: 'Carton 6 unités',
    unit: 'unité',
    category: ProductMpCategory.PACKAGING,
    minStock: 200,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// FONCTIONS DE SEED
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Génère un code produit séquentiel si pas fourni
 */
let pfCounter = 100;
function getNextPfCode(): string {
  return `PF-${String(++pfCounter).padStart(3, '0')}`;
}

/**
 * Seed des marques commerciales
 */
async function seedBrands() {
  console.log('📦 Création des marques...');
  
  for (const brand of BRANDS) {
    await prisma.brand.upsert({
      where: { code: brand.code },
      update: {
        name: brand.name,
        description: brand.description,
      },
      create: {
        code: brand.code,
        name: brand.name,
        description: brand.description,
      },
    });
    console.log(`   ✓ ${brand.name}`);
  }
}

/**
 * Seed des familles de produits
 */
async function seedProductFamilies() {
  console.log('📦 Création des familles produits...');
  
  for (const family of PRODUCT_FAMILIES) {
    await prisma.productFamily.upsert({
      where: { code: family.code },
      update: {
        name: family.name,
        description: family.description,
      },
      create: {
        code: family.code,
        name: family.name,
        description: family.description,
      },
    });
    console.log(`   ✓ ${family.name}`);
  }
}

/**
 * Seed des emballages (MP)
 */
async function seedEmballages() {
  console.log('📦 Création des emballages (MP)...');
  
  for (const emb of EMBALLAGES_MP) {
    await prisma.productMp.upsert({
      where: { code: emb.code },
      update: {
        name: emb.name,
        unit: emb.unit,
        category: emb.category,
        minStock: emb.minStock,
      },
      create: {
        code: emb.code,
        name: emb.name,
        unit: emb.unit,
        category: emb.category,
        minStock: emb.minStock,
        isActive: true,
        isStockTracked: true,
      },
    });
    console.log(`   ✓ ${emb.name}`);
  }
}

/**
 * Seed des produits finis MONTESA® Fromages Nobles
 */
async function seedMontesaFromagesNobles() {
  console.log('🧀 Création produits MONTESA® Fromages Nobles...');
  
  const brand = await prisma.brand.findUnique({ where: { code: 'MONTESA' } });
  const family = await prisma.productFamily.findUnique({ where: { code: 'FROMAGE_NOBLE' } });
  
  if (!brand || !family) {
    throw new Error('Brand MONTESA ou famille FROMAGE_NOBLE introuvable');
  }
  
  for (const product of MONTESA_FROMAGES_NOBLES) {
    await prisma.productPf.upsert({
      where: { code: product.code },
      update: {
        name: product.name,
        shortName: product.shortName,
        weightGrams: product.weightGrams,
        packagingType: product.packagingType,
        shelfLifeDays: product.shelfLifeDays,
        brandId: brand.id,
        familyId: family.id,
      },
      create: {
        code: product.code,
        name: product.name,
        shortName: product.shortName,
        unit: 'unité',
        priceHt: 0, // Prix à définir par le commercial
        weightGrams: product.weightGrams,
        packagingType: product.packagingType,
        storageType: StorageType.REFRIGERE,
        shelfLifeDays: product.shelfLifeDays,
        brandId: brand.id,
        familyId: family.id,
        isActive: true,
        minStock: 50,
      },
    });
    console.log(`   ✓ ${product.name}`);
  }
}

/**
 * Seed des produits finis MONTESA® Fromages Fondus
 */
async function seedMontesaFromagesFondus() {
  console.log('🧀 Création produits MONTESA® Fromages Fondus...');
  
  const brand = await prisma.brand.findUnique({ where: { code: 'MONTESA' } });
  const family = await prisma.productFamily.findUnique({ where: { code: 'FROMAGE_FONDU' } });
  
  if (!brand || !family) {
    throw new Error('Brand MONTESA ou famille FROMAGE_FONDU introuvable');
  }
  
  for (const product of MONTESA_FROMAGES_FONDUS) {
    await prisma.productPf.upsert({
      where: { code: product.code },
      update: {
        name: product.name,
        shortName: product.shortName,
        weightGrams: product.weightGrams,
        packagingType: product.packagingType,
        shelfLifeDays: product.shelfLifeDays,
        brandId: brand.id,
        familyId: family.id,
      },
      create: {
        code: product.code,
        name: product.name,
        shortName: product.shortName,
        unit: 'unité',
        priceHt: 0,
        weightGrams: product.weightGrams,
        packagingType: product.packagingType,
        storageType: StorageType.REFRIGERE,
        shelfLifeDays: product.shelfLifeDays,
        brandId: brand.id,
        familyId: family.id,
        isActive: true,
        minStock: 100,
      },
    });
    console.log(`   ✓ ${product.name}`);
  }
}

/**
 * Seed des produits finis QUESA NOVA®
 */
async function seedQuesaNova() {
  console.log('🧀 Création produits QUESA NOVA®...');
  
  const brand = await prisma.brand.findUnique({ where: { code: 'QUESA_NOVA' } });
  const family = await prisma.productFamily.findUnique({ where: { code: 'PREPARATION' } });
  
  if (!brand || !family) {
    throw new Error('Brand QUESA_NOVA ou famille PREPARATION introuvable');
  }
  
  for (const product of QUESA_NOVA_PREPARATIONS) {
    await prisma.productPf.upsert({
      where: { code: product.code },
      update: {
        name: product.name,
        shortName: product.shortName,
        weightGrams: product.weightGrams,
        packagingType: product.packagingType,
        shelfLifeDays: product.shelfLifeDays,
        brandId: brand.id,
        familyId: family.id,
      },
      create: {
        code: product.code,
        name: product.name,
        shortName: product.shortName,
        unit: 'unité',
        priceHt: 0,
        weightGrams: product.weightGrams,
        packagingType: product.packagingType,
        storageType: StorageType.REFRIGERE,
        shelfLifeDays: product.shelfLifeDays,
        brandId: brand.id,
        familyId: family.id,
        isActive: true,
        minStock: 50,
      },
    });
    console.log(`   ✓ ${product.name}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  MANCHENGO ERP - SEED CATALOGUE PRODUITS');
  console.log('  SARL MANCHENGO - Marques MONTESA® & QUESA NOVA®');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('');
  
  try {
    // 1. Référentiels
    await seedBrands();
    await seedProductFamilies();
    
    // 2. Matières premières (emballages)
    await seedEmballages();
    
    // 3. Produits finis
    await seedMontesaFromagesNobles();
    await seedMontesaFromagesFondus();
    await seedQuesaNova();
    
    // Résumé
    const stats = await getStats();
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('  ✅ SEED TERMINÉ AVEC SUCCÈS');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(`  📦 Marques:           ${stats.brands}`);
    console.log(`  📦 Familles:          ${stats.families}`);
    console.log(`  🧀 Produits Finis:    ${stats.productsPf}`);
    console.log(`  📦 Emballages (MP):   ${stats.emballages}`);
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('');
    
  } catch (error) {
    console.error('❌ Erreur lors du seed:', error);
    throw error;
  }
}

async function getStats() {
  const [brands, families, productsPf, emballages] = await Promise.all([
    prisma.brand.count(),
    prisma.productFamily.count(),
    prisma.productPf.count(),
    prisma.productMp.count({ where: { category: 'PACKAGING' } }),
  ]);
  
  return { brands, families, productsPf, emballages };
}

// Exécution
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
