import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const settings = await prisma.smsSetting.findUnique({ where: { id: "default" } });
  const employees = await prisma.employee.findMany({
    select: { id: true, name: true, employeeCode: true, deviceUserId: true, status: true },
    orderBy: { name: "asc" },
  });
  const recentAttendance = await prisma.attendance.findMany({
    orderBy: { timestamp: "desc" },
    take: 15,
    select: {
      id: true,
      deviceUserId: true,
      timestamp: true,
      attendanceType: true,
      employeeId: true,
      createdAt: true,
    },
  });
  const recentSms = await prisma.smsLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      status: true,
      eventType: true,
      recipient: true,
      providerResponse: true,
      createdAt: true,
      notificationKey: true,
      message: true,
    },
  });

  const unmatched = recentAttendance.filter((a) => !a.employeeId);
  const ageMinutes = (ts: Date) => Math.round((Date.now() - ts.getTime()) / 60_000);

  console.log(
    JSON.stringify(
      {
        env: {
          SMS_PROVIDER: process.env.SMS_PROVIDER,
          SMS_SENDER_ID: process.env.SMS_SENDER_ID,
          SMS_MAX_PUNCH_AGE_MINUTES: process.env.SMS_MAX_PUNCH_AGE_MINUTES ?? "60",
          SMS_API_KEY_set: Boolean(process.env.SMS_API_KEY),
        },
        settings,
        employees,
        recentAttendance: recentAttendance.map((a) => ({
          ...a,
          ageMinutes: ageMinutes(a.timestamp),
        })),
        unmatchedRecentCount: unmatched.length,
        recentSms,
        smsCounts: {
          sent: await prisma.smsLog.count({ where: { status: "SENT" } }),
          failed: await prisma.smsLog.count({ where: { status: "FAILED" } }),
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
