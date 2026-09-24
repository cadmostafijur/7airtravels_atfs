"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/field";
import { api } from "@/lib/api";

type Report = {
  type: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
};

type Employee = { id: string; name: string; employeeCode: string };
type Dept = { id: string; name: string };

const types = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "employee", label: "Employee-wise" },
  { id: "department", label: "Department-wise" },
  { id: "late", label: "Late" },
  { id: "absent", label: "Absent" },
  { id: "hours", label: "Working hours" },
  { id: "leave", label: "Leave" },
  { id: "raw", label: "Raw punches" },
];

function cell(row: Record<string, unknown>, column: string) {
  const key = column.toLowerCase();
  if (key === "employee") return String(row.name ?? "");
  if (key === "code") return String(row.employeeCode ?? "");
  if (key === "in") return String(row.checkIn ?? "");
  if (key === "out") return String(row.checkOut ?? "");
  if (key === "punches") return String(row.punches ?? "");
  if (key === "late") return String(row.lateMinutes ?? row.late ?? "");
  if (key === "early") return String(row.earlyMinutes ?? "");
  if (key === "ot") return String(row.overtimeMinutes ?? "");
  if (key === "hours") return String(row.hours ?? "");
  if (key === "status" || key === "leave") {
    return String(row.status ?? row.leave ?? "");
  }
  const map: Record<string, string> = {
    date: "date",
    name: "name",
    department: "department",
    from: "from",
    to: "to",
    reason: "reason",
    time: "time",
    device: "device",
    method: "method",
    source: "source",
    week: "week",
    month: "month",
    present: "present",
    absent: "absent",
  };
  return String(row[map[key] ?? key] ?? row[column] ?? "");
}

export default function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  const [type, setType] = useState("daily");
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [q, setQ] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [status, setStatus] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);

  function query() {
    const qs = new URLSearchParams({ type, from, to });
    if (q) qs.set("q", q);
    if (employeeId) qs.set("employeeId", employeeId);
    if (departmentId) qs.set("departmentId", departmentId);
    if (status) qs.set("status", status);
    return qs.toString();
  }

  async function load() {
    try {
      setReport(await api<Report>(`/api/reports?${query()}`));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load report");
    }
  }

  async function download(format: "csv" | "xlsx" | "pdf") {
    setDownloading(format);
    try {
      const response = await fetch(`/api/reports/export?format=${format}&${query()}`, {
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
      link.download = `attendance-${type}.${format === "xlsx" ? "xlsx" : format}`;
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

  useEffect(() => {
    void Promise.all([load(), api<Employee[]>("/api/employees"), api<Dept[]>("/api/departments")]).then(
      ([, emps, deps]) => {
        setEmployees(emps);
        setDepartments(deps);
      },
    );
  }, []);

  return (
    <div>
      <PageHeader
        eyebrow="Exports"
        title="Attendance reports"
        description="Daily, weekly, monthly, employee, department, late, absent, hours, and leave reports. Filter and export."
        actions={
          <>
            <Button variant="outline" disabled={downloading !== null} onClick={() => void download("csv")}>
              {downloading === "csv" ? "CSV…" : "CSV"}
            </Button>
            <Button variant="outline" disabled={downloading !== null} onClick={() => void download("xlsx")}>
              {downloading === "xlsx" ? "Excel…" : "Excel"}
            </Button>
            <Button variant="outline" disabled={downloading !== null} onClick={() => void download("pdf")}>
              {downloading === "pdf" ? "PDF…" : "PDF"}
            </Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <Label>Report</Label>
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            {types.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label>To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <Label>Search</Label>
          <Input placeholder="Name or ID" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div>
          <Label>Employee</Label>
          <Select className="min-w-40" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">All</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Department</Label>
          <Select className="min-w-40" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">All</option>
            {departments.map((dep) => (
              <option key={dep.id} value={dep.id}>
                {dep.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            {["PRESENT", "LATE", "ABSENT", "EARLY_LEAVE", "HALF_DAY", "LEAVE", "HOLIDAY", "WEEKEND", "OVERTIME"].map(
              (value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ),
            )}
          </Select>
        </div>
        <Button onClick={() => void load()}>Apply</Button>
      </div>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase text-muted">
              <tr>
                {(report?.columns ?? []).map((column) => (
                  <th key={column} className="px-5 py-3">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(report?.rows ?? []).map((row) => (
                <tr key={String(row.id)} className="border-t border-line">
                  {(report?.columns ?? []).map((column) => {
                    const value = cell(row, column);
                    return (
                      <td key={column} className="px-5 py-3">
                        {column === "Status" ? <Badge tone={statusTone(value)}>{value}</Badge> : value}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
