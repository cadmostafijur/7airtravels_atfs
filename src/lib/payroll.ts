import "server-only";

import type { PayrollRecord, PayrollStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import {
  absencesFromLateDays,
  absentFineAmount,
  adjustedSalaryAmount,
  dailyAbsentPenalty,
  monthDateKeys,
  workingDayKeys,
} from "@/lib/payroll-rules";

export function taka(value: number) {
  return `Tk ${Math.round(value).toLocaleString("en-BD")}`;
}

export function currentPayrollMonth(at = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(at);
  const year = parts.find((part) => part.type === "year")?.value ?? String(at.getUTCFullYear());
  const month = parts.find((part) => part.type === "month")?.value ?? String(at.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function monthBounds(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  const safe = match ? month : currentPayrollMonth();
  const [year, monthText] = safe.split("-");
  const start = new Date(`${year}-${monthText}-01T00:00:00.000Z`);
  const endKey = monthDateKeys(safe).at(-1) ?? `${year}-${monthText}-01`;
  const end = new Date(`${endKey}T00:00:00.000Z`);
  return { month: safe, start, end };
}

const PRESENT = new Set(["PRESENT", "LATE", "OVERTIME", "EARLY_LEAVE", "HALF_DAY"]);

type Calc = {
  monthlySalary: number;
  workingDays: number;
  presentDays: number;
  lateDays: number;
  lateMinutes: number;
  absentDays: number;
  lateAbsences: number;
  dailyPenalty: number;
  calculatedFine: number;
};

async function monthContext(month: string) {
  const shift = await prisma.shift.findFirst({ where: { isDefault: true } });
  const weekendDays = shift?.weekendDays ?? [5];
  const { start, end } = monthBounds(month);
  const holidays = await prisma.holiday.findMany({
    where: { date: { gte: start, lte: end } },
    select: { date: true },
  });
  const holidayKeys = holidays.map((row) => row.date.toISOString().slice(0, 10));
  const workingDays = workingDayKeys(month, weekendDays, holidayKeys).length;
  return { shift, start, end, workingDays, weekendDays };
}

function statsFor(
  summaries: Array<{ status: string; lateMinutes: number }>,
  salary: number,
  workingDays: number,
): Calc {
  const absentDays = summaries.filter((row) => row.status === "ABSENT").length;
  const presentDays = summaries.filter((row) => PRESENT.has(row.status)).length;
  let lateDays = 0;
  let lateMinutes = 0;
  for (const row of summaries) {
    if (row.status !== "LATE") continue;
    lateDays += 1;
    lateMinutes += Math.max(0, row.lateMinutes);
  }
  const dailyPenalty = dailyAbsentPenalty(salary, workingDays);
  const lateAbsences = absencesFromLateDays(lateDays);
  return {
    monthlySalary: salary,
    workingDays,
    presentDays,
    lateDays,
    lateMinutes,
    absentDays,
    lateAbsences,
    dailyPenalty,
    calculatedFine: dailyPenalty * (absentDays + lateAbsences),
  };
}

export type PayrollRow = {
  id: string;
  employeeId: string;
  employeeCode: string;
  name: string;
  department: string;
  month: string;
  monthlySalary: number;
  salaryOverridden: boolean;
  workingDays: number;
  presentDays: number;
  lateDays: number;
  lateMinutes: number;
  absentDays: number;
  lateAbsences: number;
  dailyPenalty: number;
  calculatedFine: number;
  absentFine: number;
  fineOverridden: boolean;
  adjustedSalary: number;
  status: PayrollStatus;
  paidAt: string | null;
  note: string | null;
};

function toRow(
  record: PayrollRecord & { employee: { employeeCode: string; name: string; department: { name: string } | null } },
): PayrollRow {
  return {
    id: record.id,
    employeeId: record.employeeId,
    employeeCode: record.employee.employeeCode,
    name: record.employee.name,
    department: record.employee.department?.name ?? "",
    month: record.month,
    monthlySalary: record.monthlySalary,
    salaryOverridden: record.salaryOverridden,
    workingDays: record.workingDays,
    presentDays: record.presentDays,
    lateDays: record.lateDays,
    lateMinutes: record.lateMinutes,
    absentDays: record.absentDays,
    lateAbsences: record.countedAbsentDays,
    dailyPenalty: record.dailyPenalty,
    calculatedFine: record.calculatedFine,
    absentFine: record.absentFine,
    fineOverridden: record.fineOverridden,
    adjustedSalary: record.adjustedSalary,
    status: record.status,
    paidAt: record.paidAt?.toISOString() ?? null,
    note: record.note,
  };
}

export async function buildMonthlyPayroll(month: string) {
  const ctx = await monthContext(month);
  const { month: safe, start, end } = monthBounds(month);
  const employees = await prisma.employee.findMany({
    where: { status: "ACTIVE" },
    include: {
      department: true,
      summaries: {
        where: { workDate: { gte: start, lte: end } },
        select: { status: true, lateMinutes: true },
      },
      payrollRecords: { where: { month: safe } },
    },
    orderBy: { name: "asc" },
  });

  const rows: PayrollRow[] = [];
  for (const employee of employees) {
    const calc = statsFor(employee.summaries, employee.monthlySalary, ctx.workingDays);
    if (safe === currentPayrollMonth()) {
      const standingPenalty = dailyAbsentPenalty(employee.monthlySalary, ctx.workingDays);
      if (employee.absentPenalty !== standingPenalty) {
        await prisma.employee.update({ where: { id: employee.id }, data: { absentPenalty: standingPenalty } });
      }
    }
    const existing = employee.payrollRecords[0];
    if (existing?.status === "PAID") {
      rows.push(toRow({ ...existing, employee }));
      continue;
    }

    const monthlySalary = existing?.salaryOverridden ? existing.monthlySalary : calc.monthlySalary;
    const dailyPenalty = dailyAbsentPenalty(monthlySalary, calc.workingDays);
    const calculatedFine = absentFineAmount(monthlySalary, calc.workingDays, calc.absentDays, calc.lateDays);
    const absentFine = existing?.fineOverridden ? existing.absentFine : calculatedFine;
    const data = {
      monthlySalary,
      workingDays: calc.workingDays,
      presentDays: calc.presentDays,
      lateDays: calc.lateDays,
      lateMinutes: calc.lateMinutes,
      absentDays: calc.absentDays,
      countedAbsentDays: calc.lateAbsences,
      dailyPenalty,
      calculatedFine,
      absentFine,
      adjustedSalary: adjustedSalaryAmount(monthlySalary, absentFine),
    };

    const saved = existing
      ? await prisma.payrollRecord.update({ where: { id: existing.id }, data })
      : await prisma.payrollRecord.create({
          data: {
            employeeId: employee.id,
            month: safe,
            ...data,
          },
        });
    rows.push(toRow({ ...saved, employee }));
  }

  const totals = rows.reduce(
    (acc, row) => ({
      monthlySalary: acc.monthlySalary + row.monthlySalary,
      lateDays: acc.lateDays + row.lateDays,
      lateMinutes: acc.lateMinutes + row.lateMinutes,
      absentDays: acc.absentDays + row.absentDays,
      lateAbsences: acc.lateAbsences + row.lateAbsences,
      absentFine: acc.absentFine + row.absentFine,
      adjustedSalary: acc.adjustedSalary + row.adjustedSalary,
      paid: acc.paid + (row.status === "PAID" ? 1 : 0),
    }),
    { monthlySalary: 0, lateDays: 0, lateMinutes: 0, absentDays: 0, lateAbsences: 0, absentFine: 0, adjustedSalary: 0, paid: 0 },
  );

  return {
    month: safe,
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
    workingDays: ctx.workingDays,
    lateAfter: ctx.shift?.lateThreshold ?? "10:10",
    weekendDays: ctx.weekendDays,
    settings: {
      formula: "every 3 late days count as 1 absence; fine = penalty × (absent days + those absences)",
    },
    rows,
    totals,
  };
}

export async function updatePayrollRecord(
  id: string,
  input: {
    absentFine?: number;
    monthlySalary?: number;
    note?: string | null;
    useCalculatedFine?: boolean;
    status?: PayrollStatus;
  },
) {
  const record = await prisma.payrollRecord.findUnique({ where: { id } });
  if (!record) return null;
  if (record.status === "PAID" && input.status !== "DRAFT") {
    throw new AppError("This salary is already marked paid. Mark it unpaid before changing the figures.", 409);
  }

  let monthlySalary = input.monthlySalary ?? record.monthlySalary;
  let salaryOverridden = record.salaryOverridden || input.monthlySalary != null;
  let fineOverridden = record.fineOverridden;
  let absentFine = record.absentFine;
  let calculatedFine = record.calculatedFine;

  let dailyPenalty = record.dailyPenalty;
  if (input.useCalculatedFine || (input.monthlySalary != null && !fineOverridden)) {
    if (input.useCalculatedFine) fineOverridden = false;
    dailyPenalty = dailyAbsentPenalty(monthlySalary, record.workingDays);
    calculatedFine = absentFineAmount(monthlySalary, record.workingDays, record.absentDays, record.lateDays);
    absentFine = calculatedFine;
  }
  if (input.absentFine != null && !input.useCalculatedFine) {
    fineOverridden = true;
    absentFine = input.absentFine;
  }
  if (input.status === "DRAFT" && input.monthlySalary == null && !record.salaryOverridden) {
    salaryOverridden = false;
  }

  const status = input.status ?? record.status;
  return prisma.payrollRecord.update({
    where: { id },
    data: {
      monthlySalary,
      salaryOverridden,
      dailyPenalty,
      calculatedFine,
      absentFine,
      fineOverridden,
      adjustedSalary: adjustedSalaryAmount(monthlySalary, absentFine),
      note: input.note === undefined ? record.note : input.note,
      status,
      paidAt: status === "PAID" ? record.paidAt ?? new Date() : null,
    },
  });
}

export async function payrollHistory(month?: string) {
  const records = await prisma.payrollRecord.findMany({
    where: {
      status: "PAID",
      ...(month ? { month } : {}),
    },
    include: { employee: { include: { department: true } } },
    orderBy: [{ paidAt: "desc" }, { employee: { name: "asc" } }],
  });
  const rows = records.map((record) => toRow(record));
  const totals = rows.reduce(
    (acc, row) => ({
      slips: acc.slips + 1,
      monthlySalary: acc.monthlySalary + row.monthlySalary,
      absentFine: acc.absentFine + row.absentFine,
      adjustedSalary: acc.adjustedSalary + row.adjustedSalary,
    }),
    { slips: 0, monthlySalary: 0, absentFine: 0, adjustedSalary: 0 },
  );
  return { month: month ?? null, rows, totals };
}
