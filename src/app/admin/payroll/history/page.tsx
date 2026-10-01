"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";
import { api } from "@/lib/api";
import { formatHours } from "@/lib/hours";
import { formatDateTime } from "@/lib/time";

type HistoryRow = {
  id: string;
  month: string;
  name: string;
  employeeCode: string;
  department: string;
  monthlySalary: number;
  lateMinutes: number;
  absentDays: number;
  dailyPenalty: number;
  absentFine: number;
  fineOverridden: boolean;
  adjustedSalary: number;
  paidAt: string | null;
};

type History = {
  month: string | null;
  rows: HistoryRow[];
  totals: { slips: number; monthlySalary: number; absentFine: number; adjustedSalary: number };
};

function taka(value: number) {
  return `Tk ${Math.round(value).toLocaleString("en-BD")}`;
}

export default function PayrollHistoryPage() {
  const [month, setMonth] = useState("");
  const [report, setReport] = useState<History | null>(null);

  async function load(nextMonth = month) {
    const query = nextMonth ? `?month=${nextMonth}` : "";
    setReport(await api<History>(`/api/payroll/history${query}`));
  }

  useEffect(() => {
    void load().catch((error) => {
      toast.error(error instanceof Error ? error.message : "Failed to load salary history");
    });
  }, [month]);

  const byEmployee = new Map<string, { name: string; code: string; paid: number; fine: number; slips: number }>();
  for (const row of report?.rows ?? []) {
    const current = byEmployee.get(row.employeeCode) ?? { name: row.name, code: row.employeeCode, paid: 0, fine: 0, slips: 0 };
    current.paid += row.adjustedSalary;
    current.fine += row.absentFine;
    current.slips += 1;
    byEmployee.set(row.employeeCode, current);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Paid salaries"
        title="Salary summary"
        description="History of every salary marked paid. Figures stay as they were on the day you marked them."
        actions={
          <Link href="/admin/payroll">
            <Button variant="outline">Back to payroll</Button>
          </Link>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="text-xs uppercase text-muted">Paid slips</div>
            <div className="mt-1 text-2xl font-semibold">{report?.totals.slips ?? "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs uppercase text-muted">Fines deducted</div>
            <div className="mt-1 text-2xl font-semibold text-signal">{report ? taka(report.totals.absentFine) : "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs uppercase text-muted">Adjusted salary paid</div>
            <div className="mt-1 text-2xl font-semibold text-teal">{report ? taka(report.totals.adjustedSalary) : "—"}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-5">
          <div>
            <Label>Month</Label>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          {month ? (
            <Button variant="outline" onClick={() => setMonth("")}>
              All months
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Slips</th>
                <th className="px-4 py-3">Fines</th>
                <th className="px-4 py-3">Paid</th>
              </tr>
            </thead>
            <tbody>
              {[...byEmployee.values()].map((row) => (
                <tr key={row.code} className="border-t border-line">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{row.name}</div>
                    <div className="text-xs text-muted">{row.code}</div>
                  </td>
                  <td className="px-4 py-3">{row.slips}</td>
                  <td className="px-4 py-3">{taka(row.fine)}</td>
                  <td className="px-4 py-3 font-semibold text-teal">{taka(row.paid)}</td>
                </tr>
              ))}
              {report && byEmployee.size === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted">
                    No paid salaries yet. Mark a month paid on the payroll page.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-paper text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Paid at</th>
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Salary</th>
                <th className="px-4 py-3">Penalty / day</th>
                <th className="px-4 py-3">Late hours</th>
                <th className="px-4 py-3">Absent</th>
                <th className="px-4 py-3">Fine</th>
                <th className="px-4 py-3">Adjusted</th>
              </tr>
            </thead>
            <tbody>
              {(report?.rows ?? []).map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-4 py-3 text-muted">{formatDateTime(row.paidAt)}</td>
                  <td className="px-4 py-3">{row.month}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{row.name}</div>
                    <div className="text-xs text-muted">{row.employeeCode}</div>
                  </td>
                  <td className="px-4 py-3">{taka(row.monthlySalary)}</td>
                  <td className="px-4 py-3">{taka(row.dailyPenalty)}</td>
                  <td className="px-4 py-3 font-mono">{formatHours(row.lateMinutes)}</td>
                  <td className="px-4 py-3">{row.absentDays}</td>
                  <td className="px-4 py-3">
                    {taka(row.absentFine)}
                    {row.fineOverridden ? <div className="text-[11px] text-brass">Manual</div> : null}
                  </td>
                  <td className="px-4 py-3 font-semibold text-teal">{taka(row.adjustedSalary)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
