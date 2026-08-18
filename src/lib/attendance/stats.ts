import "server-only";

import { prisma } from "@/lib/prisma";
import { APP_TZ, startOfZonedDay, endOfZonedDay, workDateUtc } from "@/lib/time";

export async function getDashboardStats(at = new Date()) {
  const from = startOfZonedDay(at);
  const to = endOfZonedDay(at);
  const workDate = workDateUtc(at);

  const [employees, summaries, live, device, recent] = await Promise.all([
    prisma.employee.count({ where: { status: "ACTIVE" } }),
    prisma.dailyAttendanceSummary.groupBy({
      by: ["status"],
      where: { workDate },
      _count: { _all: true },
    }),
    prisma.dailyAttendanceSummary.findMany({
      where: { workDate },
      select: { checkInAt: true, checkOutAt: true },
    }),
    prisma.device.findFirst({ orderBy: { createdAt: "asc" } }),
    prisma.attendance.findMany({
      where: { timestamp: { gte: from, lte: to } },
      include: { employee: true, device: true },
      orderBy: { timestamp: "desc" },
      take: 20,
    }),
  ]);

  const counts = Object.fromEntries(summaries.map((row) => [row.status, row._count._all]));
  const present = (counts.PRESENT ?? 0) + (counts.OVERTIME ?? 0) + (counts.EARLY_LEAVE ?? 0);
  const late = counts.LATE ?? 0;
  const absent = counts.ABSENT ?? 0;
  const leave = counts.LEAVE ?? 0;
  const checkedIn = live.filter((row) => row.checkInAt && !row.checkOutAt).length;
  const checkedOut = live.filter((row) => row.checkInAt && row.checkOutAt).length;

  return {
    timezone: APP_TZ,
    totals: {
      present,
      late,
      absent,
      leave,
      checkedIn,
      checkedOut,
      employees,
    },
    device: device
      ? {
          id: device.id,
          name: device.name,
          model: device.model,
          ipAddress: device.ipAddress,
          port: device.port,
          status: device.status,
          lastSyncAt: device.lastSyncAt,
          lastConnectedAt: device.lastConnectedAt,
          totalSynced: device.totalSynced,
        }
      : null,
    feed: recent.map((row) => ({
      id: row.id,
      employee: row.employee?.name ?? `Device user ${row.deviceUserId}`,
      employeeCode: row.employee?.employeeCode ?? null,
      timestamp: row.timestamp.toISOString(),
      verificationMethod: row.verificationMethod,
      device: row.device.name,
      deviceUserId: row.deviceUserId,
    })),
  };
}

export async function getTrendData() {
  const days: { date: string; present: number; late: number; absent: number }[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const workDate = workDateUtc(d);
    const grouped = await prisma.dailyAttendanceSummary.groupBy({
      by: ["status"],
      where: { workDate },
      _count: { _all: true },
    });
    const counts = Object.fromEntries(grouped.map((row) => [row.status, row._count._all]));
    days.push({
      date: workDate.toISOString().slice(0, 10),
      present: (counts.PRESENT ?? 0) + (counts.OVERTIME ?? 0) + (counts.EARLY_LEAVE ?? 0),
      late: counts.LATE ?? 0,
      absent: counts.ABSENT ?? 0,
    });
  }
  return days;
}
