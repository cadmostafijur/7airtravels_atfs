import "server-only";

import type { DailyStatus, Prisma, Shift } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { APP_TZ, minutesOfDay, parseHm, weekdayIndex, workDateKey, workDateUtc } from "@/lib/time";

async function defaultShift(): Promise<Shift> {
  const shift = await prisma.shift.findFirst({ where: { isDefault: true } });
  if (!shift) {
    throw new Error("No default shift is configured.");
  }
  return shift;
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
  const checkInAt = dayPunches[0]?.timestamp ?? null;
  const checkOutAt = dayPunches.length > 1 ? dayPunches[dayPunches.length - 1]?.timestamp ?? null : null;

  let status: DailyStatus = "ABSENT";
  let lateMinutes = 0;
  let earlyMinutes = 0;
  let overtimeMinutes = 0;
  let workedMinutes = 0;
  let notes: string | null = null;

  if (holiday) {
    status = "HOLIDAY";
    notes = holiday.name;
  } else if (leave) {
    status = "LEAVE";
    notes = leave.reason;
  } else if (shift.weekendDays.includes(weekday)) {
    status = "WEEKEND";
  } else if (checkInAt) {
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
      workedMinutes = Math.max(0, Math.round((checkOutAt.getTime() - checkInAt.getTime()) / 60000));
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
