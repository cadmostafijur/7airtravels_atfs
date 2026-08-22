import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    const smsLogs = await tx.smsLog.deleteMany({});
    const punches = await tx.attendance.deleteMany({});
    const summaries = await tx.dailyAttendanceSummary.deleteMany({});
    return {
      smsLogs: smsLogs.count,
      punches: punches.count,
      summaries: summaries.count,
    };
  });
  console.log(JSON.stringify({ cleared: result }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
