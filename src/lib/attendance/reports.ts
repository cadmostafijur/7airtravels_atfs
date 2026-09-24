import "server-only";

import type { DailyAttendanceSummary, Employee, Department } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatDate, formatTime, startOfZonedDay, endOfZonedDay, workDateKey, addDaysKey } from "@/lib/time";
import { formatHours, isoWeekKey, monthKey } from "@/lib/hours";
import { summaryWhere } from "@/lib/attendance/stats";
import { loadPunchBundlesForSummaries, summaryPunchKey } from "@/lib/attendance/punches";

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

export type BuiltReport = {
  type: string;
  title?: string;
  subtitle?: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
};

const PRESENT_MARKS = new Set(["P", "L", "E", "HD"]);

function statusMark(status: string) {
  if (status === "PRESENT" || status === "OVERTIME") return "P";
  if (status === "LATE") return "L";
  if (status === "EARLY_LEAVE") return "E";
  if (status === "HALF_DAY") return "HD";
  if (status === "ABSENT") return "A";
  if (status === "LEAVE") return "V";
  if (status === "HOLIDAY") return "H";
  if (status === "WEEKEND") return "W";
  return "-";
}

function dayKeys(from: string, to: string) {
  const start = workDateKey(new Date(from || Date.now()));
  const end = workDateKey(new Date(to || Date.now()));
  const keys: string[] = [];
  for (let key = start, i = 0; key <= end && i < 93; i += 1, key = addDaysKey(key, 1)) {
    keys.push(key);
  }
  return keys;
}

function dayLabel(key: string, sameMonth: boolean) {
  const day = String(Number(key.slice(8, 10)));
  if (sameMonth) return day;
  return `${day}/${Number(key.slice(5, 7))}`;
}

async function presenceRegister(query: ReportQuery): Promise<BuiltReport> {
  const days = dayKeys(query.from, query.to);
  const sameMonth = days.length > 0 && days.every((key) => key.slice(0, 7) === days[0]!.slice(0, 7));
  const dayColumns = days.map((key) => dayLabel(key, sameMonth));
  const summaries = (await loadSummaries({ ...query, type: "presence", status: undefined })) as Row[];
  const byEmpDay = new Map<string, Row>();
  for (const row of summaries) {
    byEmpDay.set(`${row.employeeId}:${row.workDate.toISOString().slice(0, 10)}`, row);
  }

  const employees = await prisma.employee.findMany({
    where: {
      AND: [
        query.employeeId ? { id: query.employeeId } : {},
        query.departmentId ? { departmentId: query.departmentId } : {},
        query.q
          ? {
              OR: [
                { name: { contains: query.q, mode: "insensitive" } },
                { employeeCode: { contains: query.q, mode: "insensitive" } },
              ],
            }
          : {},
        summaries.length
          ? { OR: [{ status: "ACTIVE" }, { id: { in: [...new Set(summaries.map((row) => row.employeeId))] } }] }
          : { status: "ACTIVE" },
      ],
    },
    include: { department: true },
    orderBy: { name: "asc" },
  });

  const rows = employees.map((employee) => {
    const marks: Record<string, string> = {};
    let present = 0;
    let late = 0;
    let absent = 0;
    let leave = 0;
    days.forEach((day, index) => {
      const summary = byEmpDay.get(`${employee.id}:${day}`);
      const mark = summary ? statusMark(summary.status) : "-";
      marks[dayColumns[index]!] = mark;
      if (PRESENT_MARKS.has(mark)) present += 1;
      if (mark === "L") late += 1;
      if (mark === "A") absent += 1;
      if (mark === "V") leave += 1;
    });
    return {
      id: employee.id,
      name: employee.name,
      employeeCode: employee.employeeCode,
      department: employee.department?.name ?? "",
      ...marks,
      present,
      late,
      absent,
      leave,
    };
  });

  const fromLabel = formatDate(new Date(`${query.from || days[0] || workDateKey(new Date())}T12:00:00Z`));
  const toLabel = formatDate(new Date(`${query.to || days.at(-1) || workDateKey(new Date())}T12:00:00Z`));
  return {
    type: "presence",
    title: "Daily presence register",
    subtitle: `${fromLabel} to ${toLabel}  |  P Present   L Late   A Absent   V Leave   H Holiday   W Weekend   HD Half-day   E Early   - No record`,
    columns: ["Employee", "Code", "Dept", ...dayColumns, "Present", "Late", "Absent", "Leave"],
    rows,
  };
}

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

export async function dailyRows(rows: Row[]) {
  const punches = await loadPunchBundlesForSummaries(rows);
  return rows.map((row) => {
    const bundle = punches.get(summaryPunchKey(row.employeeId, row.workDate));
    const inLabel =
      bundle && bundle.inTimes.length > 1 ? bundle.inTimes.join(" · ") : formatTime(row.checkInAt);
    const outLabel =
      bundle && bundle.outTimes.length > 1 ? bundle.outTimes.join(" · ") : formatTime(row.checkOutAt);
    return {
      id: row.id,
      date: formatDate(row.workDate),
      workDate: row.workDate.toISOString(),
      employeeCode: row.employee.employeeCode,
      name: row.employee.name,
      department: row.employee.department?.name ?? "",
      status: row.status,
      checkIn: inLabel,
      checkOut: outLabel,
      punches: bundle?.pairsLabel ?? "—",
      punchCount: bundle?.punchCount ?? 0,
      lateMinutes: row.lateMinutes,
      earlyMinutes: row.earlyMinutes,
      overtimeMinutes: row.overtimeMinutes,
      workedMinutes: row.workedMinutes,
      hours: formatHours(row.workedMinutes),
      notes: row.notes ?? "",
    };
  });
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

export async function buildReport(query: ReportQuery): Promise<BuiltReport> {
  const type = query.type || "presence";

  if (type === "presence") {
    return presenceRegister(query);
  }

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
    title: type === "hours" ? "Working hours" : "Daily attendance",
    columns: [
      "Date",
      "Code",
      "Name",
      "Department",
      "Status",
      "In",
      "Out",
      "Punches",
      "Late",
      "Early",
      "OT",
      "Hours",
    ],
    rows: await dailyRows(summaries),
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
      if (key === "punches") return String(record.punches ?? "");
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
      if (key === "department" || key === "dept") return String(record.department ?? "");
      if (key === "status") return String(record.status ?? "");
      if (key === "device") return String(record.device ?? "");
      return String(record[column] ?? record[key] ?? "");
    }),
  );
  return { header, rows };
}
