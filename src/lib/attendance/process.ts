import "server-only";

import type { AttendanceType, DailyStatus, Prisma, Shift } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { APP_TZ, minutesOfDay, parseHm, weekdayIndex, workDateKey, workDateUtc } from "@/lib/time";

async function defaultShift(): Promise<Shift> {
  const shift = await prisma.shift.findFirst({ where: { isDefault: true } });
  if (!shift) {
    throw new Error("No default shift is configured.");
  }
  return shift;
}

/** Odd punches = In, even = Out. Hours = sum of each In→Out pair. */
export function summarizeDayPunches(timestamps: Date[]) {
  const sorted = [...timestamps].sort((a, b) => a.getTime() - b.getTime());
  const checkInAt = sorted[0] ?? null;
  const checkOutAt = sorted.length > 1 ? sorted[sorted.length - 1]! : null;
  let workedMinutes = 0;
  const pairs: Array<{ inAt: Date; outAt: Date | null }> = [];

  for (let i = 0; i < sorted.length; i += 2) {
    const inAt = sorted[i]!;
    const outAt = sorted[i + 1] ?? null;
    pairs.push({ inAt, outAt });
    if (outAt) {
      workedMinutes += Math.max(0, Math.round((outAt.getTime() - inAt.getTime()) / 60000));
    }
  }

  return { checkInAt, checkOutAt, workedMinutes, pairs, punchCount: sorted.length };
}

function punchTypeForIndex(index: number): AttendanceType {
  return index % 2 === 0 ? "CHECK_IN" : "CHECK_OUT";
}

export async function processDailySummary(employeeId: string, at: Date) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return null;

  const shift = await defaultShift();
  const tz = shift.timezone || APP_TZ;
  const dateKey = workDateKey(at, tz);
  const workDate = workDateUtc(at, tz);
  const weekday = weekdayIndex(at, tz);

  const holiday = await prisma.holiday.findFirst({ where: { date: workDate } });
  const leave = await prisma.leave.findFirst({
    where: {
      employeeId,
      status: "APPROVED",
      startDate: { lte: workDate },
      endDate: { gte: workDate },
    },
  });

  const punches = await prisma.attendance.findMany({
    where: {
      employeeId,
      timestamp: {
        gte: new Date(workDate.getTime() - 12 * 60 * 60 * 1000),
        lt: new Date(workDate.getTime() + 36 * 60 * 60 * 1000),
      },
    },
    orderBy: { timestamp: "asc" },
  });

  const dayPunches = punches.filter((row) => workDateKey(row.timestamp, tz) === dateKey);
  const { checkInAt, checkOutAt, workedMinutes } = summarizeDayPunches(dayPunches.map((row) => row.timestamp));

  // Label alternating punches as In / Out so UI and reports stay consistent
  await Promise.all(
    dayPunches.map((row, index) => {
      const nextType = punchTypeForIndex(index);
      if (row.attendanceType === nextType) return Promise.resolve();
      return prisma.attendance.update({
        where: { id: row.id },
        data: { attendanceType: nextType },
      });
    }),
  );

  const isWeekend = shift.weekendDays.includes(weekday);
  let status: DailyStatus = "ABSENT";
  let lateMinutes = 0;
  let earlyMinutes = 0;
  let overtimeMinutes = 0;
  let notes: string | null = null;

  if (leave) {
    status = "LEAVE";
    notes = leave.reason;
  } else if (!checkInAt) {
    if (holiday) {
      status = "HOLIDAY";
      notes = holiday.name;
    } else if (isWeekend) {
      status = "WEEKEND";
    } else {
      status = "ABSENT";
    }
  } else if (holiday || isWeekend) {
    // Punched on off-day → count as worked day (hours from pairs), not blank WEEKEND
    status = "PRESENT";
    notes = holiday ? `${holiday.name} (duty)` : "Weekend duty";
    if (checkOutAt) {
      const outMin = minutesOfDay(checkOutAt, tz);
      const otMin = parseHm(shift.overtimeAfter);
      if (outMin >= otMin) {
        overtimeMinutes = outMin - otMin;
        status = "OVERTIME";
      }
    }
  } else {
    const inMin = minutesOfDay(checkInAt, tz);
    const lateAfter = parseHm(shift.lateThreshold);
    const halfAfter = parseHm(shift.halfDayAfter);
    if (inMin > halfAfter) status = "HALF_DAY";
    else if (inMin > lateAfter) {
      status = "LATE";
      lateMinutes = inMin - parseHm(shift.officeStart);
    } else {
      status = "PRESENT";
    }

    if (checkOutAt) {
      const outMin = minutesOfDay(checkOutAt, tz);
      const endMin = parseHm(shift.officeEnd);
      const otMin = parseHm(shift.overtimeAfter);
      if (outMin < endMin) {
        earlyMinutes = endMin - outMin;
        if (status === "PRESENT" || status === "LATE") status = "EARLY_LEAVE";
      }
      if (outMin >= otMin) {
        overtimeMinutes = outMin - otMin;
        if (status === "PRESENT") status = "OVERTIME";
      }
    }
  }

  const data: Prisma.DailyAttendanceSummaryUncheckedCreateInput = {
    employeeId,
    departmentId: employee.departmentId,
    workDate,
    checkInAt,
    checkOutAt,
    status,
    lateMinutes,
    earlyMinutes,
    overtimeMinutes,
    workedMinutes,
    notes,
    shiftId: shift.id,
  };

  return prisma.dailyAttendanceSummary.upsert({
    where: { employeeId_workDate: { employeeId, workDate } },
    create: data,
    update: {
      departmentId: data.departmentId,
      checkInAt,
      checkOutAt,
      status,
      lateMinutes,
      earlyMinutes,
      overtimeMinutes,
      workedMinutes,
      notes,
      shiftId: shift.id,
    },
  });
}

export async function markAbsentsForDate(at: Date) {
  const shift = await defaultShift();
  const tz = shift.timezone || APP_TZ;
  const workDate = workDateUtc(at, tz);
  const weekday = weekdayIndex(at, tz);
  const employees = await prisma.employee.findMany({ where: { status: "ACTIVE" } });
  for (const employee of employees) {
    await processDailySummary(employee.id, new Date(`${workDateKey(at, tz)}T12:00:00.000Z`));
  }
  return { count: employees.length, weekend: shift.weekendDays.includes(weekday), workDate };
}

/** Rebuild daily summaries from raw punches for a date range (inclusive calendar days). */
export async function recomputeSummaries(from: Date, to: Date) {
  const shift = await defaultShift();
  const tz = shift.timezone || APP_TZ;
  const employees = await prisma.employee.findMany({ where: { status: "ACTIVE" }, select: { id: true } });

  const startKey = workDateKey(from, tz);
  const endKey = workDateKey(to, tz);
  let cursor = new Date(`${startKey}T12:00:00.000Z`);
  const end = new Date(`${endKey}T12:00:00.000Z`);
  let updated = 0;

  while (cursor.getTime() <= end.getTime()) {
    for (const employee of employees) {
      await processDailySummary(employee.id, cursor);
      updated += 1;
    }
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }

  return { updated, from: startKey, to: endKey };
}
