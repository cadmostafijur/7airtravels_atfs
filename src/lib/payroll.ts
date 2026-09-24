import "server-only";

import { prisma } from "@/lib/prisma";

export function taka(value: number) {
  return `Tk ${Math.round(value).toLocaleString("en-BD")}`;
}

export function currentPayrollMonth(at = new Date()) {
  const year = at.getFullYear();
  const month = String(at.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function monthBounds(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) {
    const fallback = currentPayrollMonth();
    return monthBounds(fallback);
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]);
  const start = new Date(Date.UTC(year, monthIndex - 1, 1));
  const end = new Date(Date.UTC(year, monthIndex, 0));
  return { start, end };
}

export async function getPayrollSettings() {
  return prisma.payrollSetting.upsert({
    where: { id: "default" },
    create: { id: "default", latePenalty: 200, absentPenalty: 500 },
    update: {},
  });
}

export type PayrollRow = {
  id: string;
  employeeCode: string;
  name: string;
  department: string;
  monthlySalary: number;
  latePenalty: number;
  absentPenalty: number;
  usingDefaultLate: boolean;
  usingDefaultAbsent: boolean;
  lateDays: number;
  absentDays: number;
  presentDays: number;
  lateDeduction: number;
  absentDeduction: number;
  netSalary: number;
};

export async function buildMonthlyPayroll(month: string) {
  const settings = await getPayrollSettings();
  const { start, end } = monthBounds(month);
  const employees = await prisma.employee.findMany({
    where: { status: "ACTIVE" },
    include: {
      department: true,
      summaries: {
        where: { workDate: { gte: start, lte: end } },
        select: { status: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const rows: PayrollRow[] = employees.map((employee) => {
    const lateDays = employee.summaries.filter((row) => row.status === "LATE").length;
    const absentDays = employee.summaries.filter((row) => row.status === "ABSENT").length;
    const presentDays = employee.summaries.filter((row) =>
      ["PRESENT", "LATE", "OVERTIME", "EARLY_LEAVE", "HALF_DAY"].includes(row.status),
    ).length;
    const latePenalty = employee.latePenalty ?? settings.latePenalty;
    const absentPenalty = employee.absentPenalty ?? settings.absentPenalty;
    const lateDeduction = lateDays * latePenalty;
    const absentDeduction = absentDays * absentPenalty;
    const monthlySalary = employee.monthlySalary;
    return {
      id: employee.id,
      employeeCode: employee.employeeCode,
      name: employee.name,
      department: employee.department?.name ?? "",
      monthlySalary,
      latePenalty,
      absentPenalty,
      usingDefaultLate: employee.latePenalty == null,
      usingDefaultAbsent: employee.absentPenalty == null,
      lateDays,
      absentDays,
      presentDays,
      lateDeduction,
      absentDeduction,
      netSalary: Math.max(0, monthlySalary - lateDeduction - absentDeduction),
    };
  });

  const totals = rows.reduce(
    (acc, row) => ({
      monthlySalary: acc.monthlySalary + row.monthlySalary,
      lateDays: acc.lateDays + row.lateDays,
      absentDays: acc.absentDays + row.absentDays,
      lateDeduction: acc.lateDeduction + row.lateDeduction,
      absentDeduction: acc.absentDeduction + row.absentDeduction,
      netSalary: acc.netSalary + row.netSalary,
    }),
    { monthlySalary: 0, lateDays: 0, absentDays: 0, lateDeduction: 0, absentDeduction: 0, netSalary: 0 },
  );

  return { month, settings, rows, totals, from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}
