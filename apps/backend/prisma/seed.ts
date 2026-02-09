import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ═══════════════════════════════════════════════════════════════════════════
  // USERS ONLY — No test data
  // The client will fill in their own: MP, PF, Recipes, Suppliers, Clients
  // ═══════════════════════════════════════════════════════════════════════════

  const adminPassword = await bcrypt.hash('admin123', 10);

  await prisma.user.upsert({
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

  await prisma.user.upsert({
    where: { email: 'commercial@manchengo.dz' },
    update: {},
    create: {
      code: 'USR-002',
      email: 'commercial@manchengo.dz',
      passwordHash: adminPassword,
      firstName: 'Commercial',
      lastName: 'Manchengo',
      role: UserRole.COMMERCIAL,
    },
  });

  await prisma.user.upsert({
    where: { email: 'production@manchengo.dz' },
    update: {},
    create: {
      code: 'USR-003',
      email: 'production@manchengo.dz',
      passwordHash: adminPassword,
      firstName: 'Production',
      lastName: 'Manchengo',
      role: UserRole.PRODUCTION,
    },
  });

  await prisma.user.upsert({
    where: { email: 'stock@manchengo.dz' },
    update: {},
    create: {
      code: 'USR-004',
      email: 'stock@manchengo.dz',
      passwordHash: adminPassword,
      firstName: 'Stock',
      lastName: 'Manchengo',
      role: UserRole.APPRO,
    },
  });

  console.log('✅ Users created');

  console.log('🎉 Seed completed successfully!');
  console.log('');
  console.log('📋 Credentials:');
  console.log('   Admin: admin@manchengo.dz / admin123');
  console.log('   Commercial: commercial@manchengo.dz / admin123');
  console.log('   Production: production@manchengo.dz / admin123');
  console.log('   Stock (APPRO): stock@manchengo.dz / admin123');
  console.log('');
  console.log('ℹ️  The database is empty. Please add your own:');
  console.log('   - Matières premières (MP)');
  console.log('   - Produits finis (PF)');
  console.log('   - Recettes');
  console.log('   - Fournisseurs');
  console.log('   - Clients');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
