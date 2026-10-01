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

type PayrollRow = {
  id: string;
  name: string;
  employeeCode: string;
  department: string;
  monthlySalary: number;
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
  status: "DRAFT" | "PAID";
};

type PayrollReport = {
  month: string;
  from: string;
  to: string;
  workingDays: number;
  lateAfter: string;
  rows: PayrollRow[];
  totals: {
    monthlySalary: number;
    lateDays: number;
    lateMinutes: number;
    absentDays: number;
    lateAbsences: number;
    absentFine: number;
    adjustedSalary: number;
    paid: number;
  };
};

function currentMonth() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit" }).format(new Date());
}

function taka(value: number) {
  return `Tk ${Math.round(value).toLocaleString("en-BD")}`;
}

export default function PayrollPage() {
  const [month, setMonth] = useState(currentMonth);
  const [report, setReport] = useState<PayrollReport | null>(null);
  const [fines, setFines] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  async function load(nextMonth = month) {
    const data = await api<PayrollReport>(`/api/payroll?month=${nextMonth}`);
    setReport(data);
    setFines(Object.fromEntries(data.rows.map((row) => [row.id, String(row.absentFine)])));
  }

  useEffect(() => {
    void load().catch((error) => {
      toast.error(error instanceof Error ? error.message : "Failed to load payroll");
    });
  }, [month]);

  async function patch(id: string, body: Record<string, unknown>, ok: string) {
    setBusyId(id);
    try {
      await api(`/api/payroll/records/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      toast.success(ok);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  async function download(format: "csv" | "xlsx" | "pdf") {
    setDownloading(format);
    try {
      const response = await fetch(`/api/payroll/export?format=${format}&month=${month}`, { credentials: "include" });
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const json = (await response.json()) as { error?: string };
        throw new Error(json.error ?? "Export failed");
      }
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `payroll-${month}.${format === "xlsx" ? "xlsx" : format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Month-end"
        title="Monthly payroll"
        description="Each month is recalculated from attendance. Every 3 late days count as 1 absence, and that absence is added to the fine. Adjusted salary updates with the fine. A typed fine stays until you reset it."
        actions={
          <>
            <Link href="/admin/payroll/history">
              <Button variant="navy">Salary summary</Button>
            </Link>
            <Button variant="outline" disabled={downloading !== null} onClick={() => void download("csv")}>
              CSV
            </Button>
            <Button variant="outline" disabled={downloading !== null} onClick={() => void download("xlsx")}>
              Excel
            </Button>
            <Button variant="outline" disabled={downloading !== null} onClick={() => void download("pdf")}>
              PDF
            </Button>
          </>
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-5">
          <div>
            <Label>Month</Label>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <p className="w-full text-xs text-muted">
            A day is late when check-in is after {report?.lateAfter ?? "10:10"}. Every 3 late days count as 1 absence. This
            month has {report?.workingDays ?? "—"} working days. Penalty per day = monthly salary / working days. Fine = penalty ×
            (absent days + absences from lates). Opening this page refreshes every unpaid row.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-paper text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Salary</th>
                <th className="px-4 py-3">Penalty / day</th>
                <th className="px-4 py-3">Present</th>
                <th className="px-4 py-3">Late</th>
                <th className="px-4 py-3">Late hours</th>
                <th className="px-4 py-3">Absent</th>
                <th className="px-4 py-3">From 3 lates</th>
                <th className="px-4 py-3">Fine</th>
                <th className="px-4 py-3">Adjusted</th>
                <th className="px-4 py-3">Paid</th>
              </tr>
            </thead>
            <tbody>
              {(report?.rows ?? []).map((row) => {
                const locked = row.status === "PAID";
                return (
                  <tr key={row.id} className="border-t border-line">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{row.name}</div>
                      <div className="text-xs text-muted">
                        {row.employeeCode}
                        {row.department ? ` · ${row.department}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">{taka(row.monthlySalary)}</td>
                    <td className="px-4 py-3">{taka(row.dailyPenalty)}</td>
                    <td className="px-4 py-3">{row.presentDays}</td>
                    <td className="px-4 py-3">{row.lateDays}</td>
                    <td className="px-4 py-3 font-mono">{formatHours(row.lateMinutes)}</td>
                    <td className="px-4 py-3">{row.absentDays}</td>
                    <td className="px-4 py-3">{row.lateAbsences}</td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        min={0}
                        className="h-8 w-28"
                        disabled={locked || busyId === row.id}
                        value={fines[row.id] ?? String(row.absentFine)}
                        onChange={(e) => setFines((current) => ({ ...current, [row.id]: e.target.value }))}
                      />
                      <div className="mt-1 flex gap-2 text-[11px]">
                        {row.fineOverridden ? <span className="text-brass">Manual</span> : <span className="text-muted">Calculated {taka(row.calculatedFine)}</span>}
                        {!locked ? (
                          <>
                            <button
                              className="text-teal"
                              onClick={() => void patch(row.id, { absentFine: Number(fines[row.id] ?? row.absentFine) }, "Fine saved")}
                            >
                              Save
                            </button>
                            {row.fineOverridden ? (
                              <button className="text-muted" onClick={() => void patch(row.id, { useCalculatedFine: true }, "Fine reset")}>
                                Reset
                              </button>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-teal">{taka(row.adjustedSalary)}</td>
                    <td className="px-4 py-3">
                      {locked ? (
                        <Button size="sm" variant="outline" disabled={busyId === row.id} onClick={() => void patch(row.id, { status: "DRAFT" }, "Marked unpaid")}>
                          Paid
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          disabled={busyId === row.id}
                          onClick={() => {
                            const typed = Number(fines[row.id] ?? row.absentFine);
                            const body: Record<string, unknown> = { status: "PAID" };
                            if (Number.isFinite(typed) && typed !== row.absentFine) body.absentFine = typed;
                            void patch(row.id, body, "Marked paid");
                          }}
                        >
                          Mark paid
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {report ? (
                <tr className="border-t-2 border-navy/20 bg-paper font-semibold">
                  <td className="px-4 py-3">Total · {report.totals.paid} paid</td>
                  <td className="px-4 py-3">{taka(report.totals.monthlySalary)}</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3">{report.totals.lateDays}</td>
                  <td className="px-4 py-3 font-mono">{formatHours(report.totals.lateMinutes)}</td>
                  <td className="px-4 py-3">{report.totals.absentDays}</td>
                  <td className="px-4 py-3">{report.totals.lateAbsences}</td>
                  <td className="px-4 py-3 text-signal">{taka(report.totals.absentFine)}</td>
                  <td className="px-4 py-3 text-teal">{taka(report.totals.adjustedSalary)}</td>
                  <td className="px-4 py-3" />
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
