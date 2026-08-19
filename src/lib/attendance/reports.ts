import "server-only";

import type { DailyAttendanceSummary, Employee, Department } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatDate, formatTime, startOfZonedDay, endOfZonedDay } from "@/lib/time";
import { formatHours, isoWeekKey, monthKey } from "@/lib/hours";
import { summaryWhere } from "@/lib/attendance/stats";

type Row = DailyAttendanceSummary & {
  employee: Employee & { department: Department | null };
};

export type ReportQuery = {
  type: string;
  from: string;
  to: string;
  employeeId?: string;
  departmentId?: string;
  status?: string;
  q?: string;
};

function filters(query: ReportQuery) {
  return summaryWhere({
    from: startOfZonedDay(new Date(query.from || Date.now())),
    to: endOfZonedDay(new Date(query.to || Date.now())),
    employeeId: query.employeeId || undefined,
    departmentId: query.departmentId || undefined,
    status: (query.status || undefined) as never,
    q: query.q || undefined,
  });
}

export async function loadSummaries(query: ReportQuery) {
  const next = { ...query };
  if (next.type === "late") next.status = "LATE";
  if (next.type === "absent") next.status = "ABSENT";

  return prisma.dailyAttendanceSummary.findMany({
    where: filters(next),
    include: { employee: { include: { department: true } } },
    orderBy: [{ workDate: "asc" }, { employee: { name: "asc" } }],
  });
}

export function dailyRows(rows: Row[]) {
  return rows.map((row) => ({
    id: row.id,
    date: formatDate(row.workDate),
    workDate: row.workDate.toISOString(),
    employeeCode: row.employee.employeeCode,
    name: row.employee.name,
    department: row.employee.department?.name ?? "",
    status: row.status,
    checkIn: formatTime(row.checkInAt),
    checkOut: formatTime(row.checkOutAt),
    lateMinutes: row.lateMinutes,
    earlyMinutes: row.earlyMinutes,
    overtimeMinutes: row.overtimeMinutes,
    workedMinutes: row.workedMinutes,
    hours: formatHours(row.workedMinutes),
  }));
}

function bucket(rows: Row[], keyFn: (row: Row) => string, label: (key: string, sample: Row) => Record<string, string>) {
  const map = new Map<string, { sample: Row; present: number; late: number; absent: number; leave: number; minutes: number; days: number }>();
  for (const row of rows) {
    const key = keyFn(row);
    const current = map.get(key) ?? {
      sample: row,
      present: 0,
      late: 0,
      absent: 0,
      leave: 0,
      minutes: 0,
      days: 0,
    };
    current.days += 1;
    current.minutes += row.workedMinutes;
    if (["PRESENT", "OVERTIME", "EARLY_LEAVE", "HALF_DAY"].includes(row.status)) current.present += 1;
    if (row.status === "LATE") current.late += 1;
    if (row.status === "ABSENT") current.absent += 1;
    if (row.status === "LEAVE") current.leave += 1;
    map.set(key, current);
  }
  return [...map.entries()].map(([key, value]) => ({
    id: key,
    ...label(key, value.sample),
    present: value.present,
    late: value.late,
    absent: value.absent,
    leave: value.leave,
    days: value.days,
    hours: formatHours(value.minutes),
    workedMinutes: value.minutes,
  }));
}

export async function buildReport(query: ReportQuery) {
  const type = query.type || "daily";

  if (type === "leave") {
    const from = startOfZonedDay(new Date(query.from || Date.now()));
    const to = endOfZonedDay(new Date(query.to || Date.now()));
    const leaves = await prisma.leave.findMany({
      where: {
        startDate: { lte: to },
        endDate: { gte: from },
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      },
      include: { employee: { include: { department: true } } },
      orderBy: { startDate: "desc" },
    });
    return {
      type,
      columns: ["Employee", "Code", "Department", "From", "To", "Status", "Reason"],
      rows: leaves.map((row) => ({
        id: row.id,
        name: row.employee.name,
        employeeCode: row.employee.employeeCode,
        department: row.employee.department?.name ?? "",
        from: formatDate(row.startDate),
        to: formatDate(row.endDate),
        status: row.status,
        reason: row.reason ?? "",
      })),
    };
  }

  if (type === "raw") {
    const from = startOfZonedDay(new Date(query.from || Date.now()));
    const to = endOfZonedDay(new Date(query.to || Date.now()));
    const punches = await prisma.attendance.findMany({
      where: {
        timestamp: { gte: from, lte: to },
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      },
      include: { employee: true, device: true },
      orderBy: { timestamp: "asc" },
    });
    return {
      type,
      columns: ["Time", "Employee", "Code", "Device", "Method", "Source"],
      rows: punches.map((row) => ({
        id: row.id,
        time: `${formatDate(row.timestamp)} ${formatTime(row.timestamp)}`,
        name: row.employee?.name ?? `UID ${row.deviceUserId}`,
        employeeCode: row.employee?.employeeCode ?? "",
        device: row.device.name,
        method: row.verificationMethod,
        source: row.source,
      })),
    };
  }

  const summaries = (await loadSummaries(query)) as Row[];

  if (type === "weekly") {
    return {
      type,
      columns: ["Week", "Present", "Late", "Absent", "Leave", "Hours"],
      rows: bucket(summaries, (row) => isoWeekKey(row.workDate), (key) => ({ week: key })),
    };
  }

  if (type === "monthly") {
    return {
      type,
      columns: ["Month", "Present", "Late", "Absent", "Leave", "Hours"],
      rows: bucket(summaries, (row) => monthKey(row.workDate), (key) => ({ month: key })),
    };
  }

  if (type === "employee") {
    return {
      type,
      columns: ["Employee", "Code", "Department", "Present", "Late", "Absent", "Leave", "Hours"],
      rows: bucket(
        summaries,
        (row) => row.employeeId,
        (_key, sample) => ({
          name: sample.employee.name,
          employeeCode: sample.employee.employeeCode,
          department: sample.employee.department?.name ?? "",
        }),
      ),
    };
  }

  if (type === "department") {
    return {
      type,
      columns: ["Department", "Present", "Late", "Absent", "Leave", "Hours"],
      rows: bucket(
        summaries,
        (row) => row.departmentId ?? "none",
        (_key, sample) => ({ department: sample.employee.department?.name ?? "Unassigned" }),
      ),
    };
  }

  return {
    type: type === "hours" ? "hours" : type,
    columns: ["Date", "Code", "Name", "Department", "Status", "In", "Out", "Late", "Early", "OT", "Hours"],
    rows: dailyRows(summaries),
  };
}

export function exportMatrix(report: Awaited<ReturnType<typeof buildReport>>) {
  const header = report.columns;
  const rows = report.rows.map((row) =>
    header.map((column) => {
      const key = column.toLowerCase();
      const record = row as Record<string, unknown>;
      if (key === "employee") return String(record.name ?? "");
      if (key === "code") return String(record.employeeCode ?? "");
      if (key === "in") return String(record.checkIn ?? "");
      if (key === "out") return String(record.checkOut ?? "");
      if (key === "late") return String(record.lateMinutes ?? record.late ?? "");
      if (key === "early") return String(record.earlyMinutes ?? "");
      if (key === "ot") return String(record.overtimeMinutes ?? "");
      if (key === "hours") return String(record.hours ?? "");
      if (key === "from") return String(record.from ?? "");
      if (key === "to") return String(record.to ?? "");
      if (key === "time") return String(record.time ?? "");
      if (key === "method") return String(record.method ?? "");
      if (key === "source") return String(record.source ?? "");
      if (key === "week") return String(record.week ?? "");
      if (key === "month") return String(record.month ?? "");
      if (key === "present") return String(record.present ?? "");
      if (key === "absent") return String(record.absent ?? "");
      if (key === "leave") return String(record.leave ?? record.status ?? "");
      if (key === "reason") return String(record.reason ?? "");
      if (key === "date") return String(record.date ?? "");
      if (key === "name") return String(record.name ?? "");
      if (key === "department") return String(record.department ?? "");
      if (key === "status") return String(record.status ?? "");
      if (key === "device") return String(record.device ?? "");
      return String(record[column] ?? record[key] ?? "");
    }),
  );
  return { header, rows };
}
