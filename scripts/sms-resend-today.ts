/**
 * One-off: send SMS for today's punches that have an employee but no SENT log yet.
 * Usage: npx tsx scripts/sms-resend-today.ts
 */
import { PrismaClient } from "@prisma/client";
import { notifyAttendanceSms } from "../src/lib/sms/service";
import { processDailySummary } from "../src/lib/attendance/process";
import { workDateKey } from "../src/lib/time";

const prisma = new PrismaClient();

async function main() {
  const today = workDateKey(new Date());
  const punches = await prisma.attendance.findMany({
    where: { employeeId: { not: null } },
    orderBy: { timestamp: "desc" },
    take: 50,
    include: {
      employee: true,
      smsLogs: { where: { status: "SENT" }, select: { id: true } },
    },
  });

  const pending = punches.filter(
    (row) => row.employee && row.smsLogs.length === 0 && workDateKey(row.timestamp) === today,
  );

  console.log(`Today=${today} pending_with_employee=${pending.length}`);

  let attempted = 0;
  for (const punch of pending) {
    if (!punch.employee) continue;
    const summary = await processDailySummary(punch.employee.id, punch.timestamp);
    await notifyAttendanceSms(punch, punch.employee, summary);
    attempted += 1;
    console.log(`attempted ${punch.employee.name} ${punch.timestamp.toISOString()} deviceUser=${punch.deviceUserId}`);
  }

  const recent = await prisma.smsLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { status: true, recipient: true, providerResponse: true, eventType: true, createdAt: true },
  });
  console.log(JSON.stringify({ attempted, recent }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
