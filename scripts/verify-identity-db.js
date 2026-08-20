const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.create({
    data: {
      name: 'Verify Fleet',
      type: 'FLEET_OWNER',
      email: 'verify@fleetnexus.dev',
    },
  });

  const user = await prisma.user.create({
    data: {
      firstName: 'Verify',
      lastName: 'User',
      email: 'verify.user@fleetnexus.dev',
      phone: '+919900001111',
      passwordHash: 'not-a-real-hash-for-db-check',
      role: 'FLEET_OWNER',
      organizationId: org.id,
    },
  });

  const found = await prisma.user.findUnique({
    where: { id: user.id },
    include: { organization: true },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        userId: found.id,
        role: found.role,
        orgId: found.organizationId,
        orgName: found.organization.name,
        hasPasswordHash: Boolean(found.passwordHash),
      },
      null,
      2,
    ),
  );

  await prisma.user.delete({ where: { id: user.id } });
  await prisma.organization.delete({ where: { id: org.id } });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
