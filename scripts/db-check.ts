import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [admins, employees, devices, migrations] = await Promise.all([
    prisma.admin.count(),
    prisma.employee.count(),
    prisma.device.count(),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM "_prisma_migrations"
    `,
  ]);

  console.log(
    JSON.stringify(
      {
        database: "connected",
        admins,
        employees,
        devices,
        migrationsApplied: Number(migrations[0]?.count ?? 0),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("Database check failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
