import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.smsLog.updateMany({
    where: { providerResponse: "logged-to-console" },
    data: { status: "FAILED" },
  });
  console.log(JSON.stringify({ markedFailed: result.count }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
