"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";
import { api } from "@/lib/api";

type PayrollRow = {
  id: string;
  employeeCode: string;
  name: string;
  department: string;
  monthlySalary: number;
  latePenalty: number;
  absentPenalty: number;
  lateDays: number;
  absentDays: number;
  presentDays: number;
  lateDeduction: number;
  absentDeduction: number;
  netSalary: number;
};

type PayrollReport = {
  month: string;
  from: string;
  to: string;
  settings: { latePenalty: number; absentPenalty: number };
  rows: PayrollRow[];
  totals: {
    monthlySalary: number;
    lateDays: number;
    absentDays: number;
    lateDeduction: number;
    absentDeduction: number;
    netSalary: number;
  };
};

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function taka(value: number) {
  return `Tk ${Math.round(value).toLocaleString("en-BD")}`;
}

export default function PayrollPage() {
  const [month, setMonth] = useState(currentMonth);
  const [report, setReport] = useState<PayrollReport | null>(null);
  const [latePenalty, setLatePenalty] = useState("200");
  const [absentPenalty, setAbsentPenalty] = useState("500");
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  async function load(nextMonth = month) {
    const data = await api<PayrollReport>(`/api/payroll?month=${nextMonth}`);
    setReport(data);
    setLatePenalty(String(data.settings.latePenalty));
    setAbsentPenalty(String(data.settings.absentPenalty));
  }

  useEffect(() => {
    void load().catch((error) => {
      toast.error(error instanceof Error ? error.message : "Failed to load payroll");
    });
  }, [month]);

  async function saveDefaults() {
    setSaving(true);
    try {
      await api("/api/payroll", {
        method: "PUT",
        body: JSON.stringify({
          latePenalty: Number(latePenalty),
          absentPenalty: Number(absentPenalty),
        }),
      });
      toast.success("Company penalty defaults saved");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function download(format: "csv" | "xlsx" | "pdf") {
    setDownloading(format);
    try {
      const response = await fetch(`/api/payroll/export?format=${format}&month=${month}`, {
        credentials: "include",
      });
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
        title="Salary & penalties"
        description="Set each employee's monthly salary on their record. Late and absent days deduct from that salary at month end."
        actions={
          <>
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
          <div>
            <Label>Default late penalty (Tk / day)</Label>
            <Input type="number" min={0} value={latePenalty} onChange={(e) => setLatePenalty(e.target.value)} />
          </div>
          <div>
            <Label>Default absent penalty (Tk / day)</Label>
            <Input type="number" min={0} value={absentPenalty} onChange={(e) => setAbsentPenalty(e.target.value)} />
          </div>
          <Button disabled={saving} onClick={() => void saveDefaults()}>
            {saving ? "Saving…" : "Save defaults"}
          </Button>
          <p className="w-full text-xs text-muted">
            Example: salary Tk 10,000, late Tk {latePenalty || "200"}/day, absent Tk {absentPenalty || "500"}/day.
            Override per employee on Employee records if needed.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Base salary</th>
                <th className="px-4 py-3">Present</th>
                <th className="px-4 py-3">Late</th>
                <th className="px-4 py-3">Late penalty</th>
                <th className="px-4 py-3">Absent</th>
                <th className="px-4 py-3">Absent penalty</th>
                <th className="px-4 py-3">Net payable</th>
              </tr>
            </thead>
            <tbody>
              {(report?.rows ?? []).map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{row.name}</div>
                    <div className="text-xs text-muted">
                      {row.employeeCode} · {row.department || "No dept"}
                    </div>
                  </td>
                  <td className="px-4 py-3">{taka(row.monthlySalary)}</td>
                  <td className="px-4 py-3">{row.presentDays}</td>
                  <td className="px-4 py-3">{row.lateDays}</td>
                  <td className="px-4 py-3 text-signal">{row.lateDeduction ? `-${taka(row.lateDeduction)}` : "—"}</td>
                  <td className="px-4 py-3">{row.absentDays}</td>
                  <td className="px-4 py-3 text-signal">{row.absentDeduction ? `-${taka(row.absentDeduction)}` : "—"}</td>
                  <td className="px-4 py-3 font-semibold text-teal">{taka(row.netSalary)}</td>
                </tr>
              ))}
              {report ? (
                <tr className="border-t-2 border-navy/20 bg-paper font-semibold">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3">{taka(report.totals.monthlySalary)}</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3">{report.totals.lateDays}</td>
                  <td className="px-4 py-3 text-signal">-{taka(report.totals.lateDeduction)}</td>
                  <td className="px-4 py-3">{report.totals.absentDays}</td>
                  <td className="px-4 py-3 text-signal">-{taka(report.totals.absentDeduction)}</td>
                  <td className="px-4 py-3 text-teal">{taka(report.totals.netSalary)}</td>
                </tr>
              ) : null}
              {report && !report.rows.length ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted">
                    No active employees. Add salary on Employee records first.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
