import "server-only";

import type { DailyStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { APP_TZ, startOfZonedDay, endOfZonedDay, workDateUtc, zonedParts } from "@/lib/time";
import { formatHours } from "@/lib/hours";

function presentCount(counts: Record<string, number>) {
  return (counts.PRESENT ?? 0) + (counts.OVERTIME ?? 0) + (counts.EARLY_LEAVE ?? 0) + (counts.HALF_DAY ?? 0);
}

function monthRange(at: Date) {
  const p = zonedParts(at);
  const start = workDateUtc(new Date(`${p.year}-${String(p.month).padStart(2, "0")}-01T12:00:00Z`));
  const nextMonth = p.month === 12 ? `${p.year + 1}-01-01` : `${p.year}-${String(p.month + 1).padStart(2, "0")}-01`;
  const end = new Date(workDateUtc(new Date(`${nextMonth}T12:00:00Z`)).getTime() - 1);
  return { start, end, label: `${p.year}-${String(p.month).padStart(2, "0")}` };
}

export async function getDashboardStats(at = new Date()) {
  const from = startOfZonedDay(at);
  const to = endOfZonedDay(at);
  const workDate = workDateUtc(at);
  const month = monthRange(at);

  const [employees, summaries, monthRows, device, recent] = await Promise.all([
    prisma.employee.count({ where: { status: "ACTIVE" } }),
    prisma.dailyAttendanceSummary.findMany({
      where: { workDate },
      include: { employee: { include: { department: true } } },
      orderBy: { employee: { name: "asc" } },
    }),
    prisma.dailyAttendanceSummary.findMany({
      where: { workDate: { gte: month.start, lte: month.end } },
      select: { workDate: true, status: true, workedMinutes: true },
    }),
    prisma.device.findFirst({ orderBy: { createdAt: "asc" } }),
    prisma.attendance.findMany({
      where: { timestamp: { gte: from, lte: to } },
      include: { employee: true, device: true },
      orderBy: { timestamp: "desc" },
      take: 20,
    }),
  ]);

  const counts = summaries.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});
  const present = presentCount(counts);
  const late = counts.LATE ?? 0;
  const absent = counts.ABSENT ?? 0;
  const leave = counts.LEAVE ?? 0;
  const halfDay = counts.HALF_DAY ?? 0;
  const checkedIn = summaries.filter((row) => row.checkInAt && !row.checkOutAt).length;
  const checkedOut = summaries.filter((row) => row.checkInAt && row.checkOutAt).length;
  const todayMinutes = summaries.reduce((sum, row) => sum + row.workedMinutes, 0);
  const monthMinutes = monthRows.reduce((sum, row) => sum + row.workedMinutes, 0);

  const monthByDay = new Map<string, { present: number; late: number; absent: number; hours: number }>();
  for (const row of monthRows) {
    const key = row.workDate.toISOString().slice(0, 10);
    const current = monthByDay.get(key) ?? { present: 0, late: 0, absent: 0, hours: 0 };
    if (["PRESENT", "OVERTIME", "EARLY_LEAVE", "HALF_DAY"].includes(row.status)) current.present += 1;
    if (row.status === "LATE") current.late += 1;
    if (row.status === "ABSENT") current.absent += 1;
    current.hours += row.workedMinutes;
    monthByDay.set(key, current);
  }
  const monthly = [...monthByDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({
      date,
      present: value.present,
      late: value.late,
      absent: value.absent,
      hours: Number((value.hours / 60).toFixed(1)),
    }));

  const weekStart = workDateUtc(new Date(at.getTime() - 6 * 86400000));
  const trend = monthly.filter((row) => row.date >= weekStart.toISOString().slice(0, 10));

  return {
    timezone: APP_TZ,
    month: month.label,
    totals: {
      present,
      late,
      absent,
      leave,
      halfDay,
      checkedIn,
      checkedOut,
      employees,
      todayMinutes,
      todayHours: formatHours(todayMinutes),
      monthMinutes,
      monthHours: formatHours(monthMinutes),
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
    today: summaries.map((row) => ({
      id: row.id,
      employee: row.employee.name,
      employeeCode: row.employee.employeeCode,
      department: row.employee.department?.name ?? null,
      status: row.status,
      checkInAt: row.checkInAt?.toISOString() ?? null,
      checkOutAt: row.checkOutAt?.toISOString() ?? null,
      workedMinutes: row.workedMinutes,
      lateMinutes: row.lateMinutes,
      earlyMinutes: row.earlyMinutes,
    })),
    feed: recent.map((row) => ({
      id: row.id,
      employee: row.employee?.name ?? `Device user ${row.deviceUserId}`,
      employeeCode: row.employee?.employeeCode ?? null,
      timestamp: row.timestamp.toISOString(),
      verificationMethod: row.verificationMethod,
      device: row.device.name,
      deviceUserId: row.deviceUserId,
    })),
    trend: trend.length ? trend : monthly.slice(-7),
    monthly,
  };
}

export type SummaryWhere = {
  from: Date;
  to: Date;
  employeeId?: string;
  departmentId?: string;
  status?: DailyStatus;
  q?: string;
};

export function summaryWhere(input: SummaryWhere): Prisma.DailyAttendanceSummaryWhereInput {
  return {
    workDate: { gte: workDateUtc(input.from), lte: workDateUtc(input.to) },
    ...(input.employeeId ? { employeeId: input.employeeId } : {}),
    ...(input.departmentId ? { departmentId: input.departmentId } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.q
      ? {
          employee: {
            OR: [
              { name: { contains: input.q, mode: "insensitive" } },
              { employeeCode: { contains: input.q, mode: "insensitive" } },
            ],
          },
        }
      : {}),
  };
}
