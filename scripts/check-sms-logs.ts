import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const logs = await prisma.smsLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      status: true,
      eventType: true,
      providerResponse: true,
      message: true,
      createdAt: true,
      recipient: true,
    },
  });
  for (const row of logs) {
    console.log({
      at: row.createdAt.toISOString(),
      status: row.status,
      event: row.eventType,
      to: row.recipient.slice(-4),
      response: (row.providerResponse ?? "").slice(0, 80),
      msg: row.message.slice(0, 60),
    });
  }

  const fake = await prisma.smsLog.count({
    where: { providerResponse: { contains: "logged-to-console" } },
  });
  console.log("consoleFakeSent:", fake);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
