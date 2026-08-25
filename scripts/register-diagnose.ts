import { PrismaClient } from "@prisma/client";
import { workDateKey, workDateUtc } from "../src/lib/time";

const prisma = new PrismaClient();

async function main() {
  const todayKey = workDateKey(new Date());
  const todayUtc = workDateUtc(new Date());

  const attendanceToday = await prisma.attendance.findMany({
    where: {
      timestamp: {
        gte: new Date(`${todayKey}T00:00:00+06:00`),
        lt: new Date(`${todayKey}T23:59:59.999+06:00`),
      },
    },
    orderBy: { timestamp: "desc" },
    select: {
      id: true,
      deviceUserId: true,
      employeeId: true,
      timestamp: true,
      attendanceType: true,
      employee: { select: { name: true, deviceUserId: true } },
    },
  });

  const summaries = await prisma.dailyAttendanceSummary.findMany({
    where: { workDate: todayUtc },
    include: { employee: { select: { name: true, deviceUserId: true } } },
  });

  const sms = await prisma.smsLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { status: true, providerResponse: true, createdAt: true, recipient: true },
  });

  const employees = await prisma.employee.findMany({
    select: { name: true, deviceUserId: true, status: true },
    orderBy: { deviceUserId: "asc" },
  });

  const unmatchedIds = [...new Set(attendanceToday.filter((a) => !a.employeeId).map((a) => a.deviceUserId))];

  console.log(
    JSON.stringify(
      {
        todayKey,
        attendanceTodayCount: attendanceToday.length,
        withEmployee: attendanceToday.filter((a) => a.employeeId).length,
        withoutEmployee: attendanceToday.filter((a) => !a.employeeId).length,
        unmatchedDeviceUserIds: unmatchedIds,
        summariesCount: summaries.length,
        summaries: summaries.map((s) => ({
          name: s.employee.name,
          deviceUserId: s.employee.deviceUserId,
          status: s.status,
          checkIn: s.checkInAt,
          checkOut: s.checkOutAt,
        })),
        recentAttendance: attendanceToday.slice(0, 12).map((a) => ({
          deviceUserId: a.deviceUserId,
          name: a.employee?.name ?? null,
          type: a.attendanceType,
          time: a.timestamp,
        })),
        employees,
        smsLatest: sms.map((s) => ({
          status: s.status,
          createdAt: s.createdAt,
          recipient: s.recipient,
          err: (s.providerResponse ?? "").slice(0, 160),
        })),
        smsSent: await prisma.smsLog.count({ where: { status: "SENT" } }),
        smsFailed: await prisma.smsLog.count({ where: { status: "FAILED" } }),
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
