/**
 * FleetNexus Prisma Seed Script
 *
 * Populates the database with initial/development data.
 * Run with: pnpm prisma:seed
 *
 * This is a placeholder — add seed logic when models are defined.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Seeding database...');

  // TODO: Add seed data after domain models are created.
  // Example:
  // await prisma.organization.createMany({ data: [...], skipDuplicates: true });

  console.log('✅ Seed complete.');
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
