import { PrismaClient, UserRole, ClientType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ═══════════════════════════════════════════════════════════════════════════
  // USERS
  // ═══════════════════════════════════════════════════════════════════════════

  const adminPassword = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@manchengo.dz' },
    update: {},
    create: {
      code: 'USR-001',
      email: 'admin@manchengo.dz',
      passwordHash: adminPassword,
      firstName: 'Admin',
      lastName: 'Manchengo',
      role: UserRole.ADMIN,
    },
  });

  const commercial = await prisma.user.upsert({
    where: { email: 'commercial@manchengo.dz' },
    update: {},
    create: {
      code: 'USR-002',
      email: 'commercial@manchengo.dz',
      passwordHash: adminPassword,
      firstName: 'Ahmed',
      lastName: 'Benali',
      role: UserRole.COMMERCIAL,
    },
  });

  const production = await prisma.user.upsert({
    where: { email: 'production@manchengo.dz' },
    update: {},
    create: {
      code: 'USR-003',
      email: 'production@manchengo.dz',
      passwordHash: adminPassword,
      firstName: 'Mohamed',
      lastName: 'Cherif',
      role: UserRole.PRODUCTION,
    },
  });

  const appro = await prisma.user.upsert({
    where: { email: 'stock@manchengo.dz' },
    update: {},
    create: {
      code: 'USR-004',
      email: 'stock@manchengo.dz',
      passwordHash: adminPassword,
      firstName: 'Karim',
      lastName: 'Boudjema',
      role: UserRole.APPRO,
    },
  });

  console.log('✅ Users created');

  // ═══════════════════════════════════════════════════════════════════════════
  // SUPPLIERS
  // ═══════════════════════════════════════════════════════════════════════════

  const supplier1 = await prisma.supplier.upsert({
    where: { code: 'FOUR-001' },
    update: {},
    create: {
      code: 'FOUR-001',
      name: 'Laiterie El Hayet',
      phone: '0550123456',
      address: 'Zone Industrielle, Blida',
    },
  });

  const supplier2 = await prisma.supplier.upsert({
    where: { code: 'FOUR-002' },
    update: {},
    create: {
      code: 'FOUR-002',
      name: 'Ferme Agricole Mitidja',
      phone: '0551234567',
      address: 'Mitidja, Blida',
    },
  });

  console.log('✅ Suppliers created');

  // ═══════════════════════════════════════════════════════════════════════════
  // CLIENTS
  // ═══════════════════════════════════════════════════════════════════════════

  await prisma.client.upsert({
    where: { code: 'CLI-001' },
    update: {},
    create: {
      code: 'CLI-001',
      name: 'Superette El Baraka',
      type: ClientType.SUPERETTE,
      phone: '0552345678',
      address: 'Centre ville, Alger',
    },
  });

  await prisma.client.upsert({
    where: { code: 'CLI-002' },
    update: {},
    create: {
      code: 'CLI-002',
      name: 'Grossiste Ben Amar',
      type: ClientType.GROSSISTE,
      nif: '000123456789',
      phone: '0553456789',
      address: 'Marché de gros, Hussein Dey',
    },
  });

  await prisma.client.upsert({
    where: { code: 'CLI-003' },
    update: {},
    create: {
      code: 'CLI-003',
      name: 'Fast Food El Kheir',
      type: ClientType.FAST_FOOD,
      phone: '0554567890',
      address: 'Bab El Oued, Alger',
    },
  });

  console.log('✅ Clients created');

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUCTS MP (Matières Premières)
  // ═══════════════════════════════════════════════════════════════════════════

  const lait = await prisma.productMp.upsert({
    where: { code: 'MP-001' },
    update: {},
    create: {
      code: 'MP-001',
      name: 'Lait cru',
      unit: 'L',
      minStock: 500,
    },
  });

  const sel = await prisma.productMp.upsert({
    where: { code: 'MP-002' },
    update: {},
    create: {
      code: 'MP-002',
      name: 'Sel',
      unit: 'kg',
      minStock: 50,
    },
  });

  const presure = await prisma.productMp.upsert({
    where: { code: 'MP-003' },
    update: {},
    create: {
      code: 'MP-003',
      name: 'Présure',
      unit: 'L',
      minStock: 10,
    },
  });

  console.log('✅ Products MP created');

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUCTS PF (Produits Finis)
  // ═══════════════════════════════════════════════════════════════════════════

  const fromage = await prisma.productPf.upsert({
    where: { code: 'PF-001' },
    update: {},
    create: {
      code: 'PF-001',
      name: 'Fromage Manchego Tradition',
      unit: 'unité',
      priceHt: 120000, // 1200 DA
      minStock: 100,
    },
  });

  const fromageBio = await prisma.productPf.upsert({
    where: { code: 'PF-002' },
    update: {},
    create: {
      code: 'PF-002',
      name: 'Fromage Bio Premium',
      unit: 'unité',
      priceHt: 180000, // 1800 DA
      minStock: 50,
    },
  });

  const petit = await prisma.productPf.upsert({
    where: { code: 'PF-003' },
    update: {},
    create: {
      code: 'PF-003',
      name: 'Petit Manchego',
      unit: 'unité',
      priceHt: 60000, // 600 DA
      minStock: 200,
    },
  });

  console.log('✅ Products PF created');

  // ═══════════════════════════════════════════════════════════════════════════
  // LOTS MP (Initial Stock)
  // ═══════════════════════════════════════════════════════════════════════════

  await prisma.lotMp.upsert({
    where: { lotNumber: 'L241220-001' },
    update: {},
    create: {
      lotNumber: 'L241220-001',
      productId: lait.id,
      supplierId: supplier1.id,
      quantityInitial: 1000,
      quantityRemaining: 1000,
      manufactureDate: new Date('2024-12-20'),
      isActive: true,
    },
  });

  await prisma.lotMp.upsert({
    where: { lotNumber: 'L241220-002' },
    update: {},
    create: {
      lotNumber: 'L241220-002',
      productId: sel.id,
      supplierId: supplier2.id,
      quantityInitial: 100,
      quantityRemaining: 100,
      manufactureDate: new Date('2024-12-20'),
      isActive: true,
    },
  });

  console.log('✅ Lots MP created');

  // ═══════════════════════════════════════════════════════════════════════════
  // LOTS PF (Initial Stock)
  // ═══════════════════════════════════════════════════════════════════════════

  await prisma.lotPf.upsert({
    where: { lotNumber: 'PF241220-001' },
    update: {},
    create: {
      lotNumber: 'PF241220-001',
      productId: fromage.id,
      quantityInitial: 150,
      quantityRemaining: 150,
      manufactureDate: new Date('2024-12-20'),
      isActive: true,
      expiryDate: new Date('2025-03-20'),
    },
  });

  await prisma.lotPf.upsert({
    where: { lotNumber: 'PF241220-002' },
    update: {},
    create: {
      lotNumber: 'PF241220-002',
      productId: petit.id,
      quantityInitial: 300,
      quantityRemaining: 300,
      manufactureDate: new Date('2024-12-20'),
      isActive: true,
      expiryDate: new Date('2025-02-20'),
    },
  });

  console.log('✅ Lots PF created');

  console.log('🎉 Seed completed successfully!');
  console.log('');
  console.log('📋 Test credentials:');
  console.log('   Admin: admin@manchengo.dz / admin123');
  console.log('   Commercial: commercial@manchengo.dz / admin123');
  console.log('   Production: production@manchengo.dz / admin123');
  console.log('   Stock (APPRO): stock@manchengo.dz / admin123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
