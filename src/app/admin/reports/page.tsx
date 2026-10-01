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
  { id: "daily", label: "Daily detail" },
  { id: "presence", label: "Presence register" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "summary", label: "Monthly employee summary" },
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
  if (key === "dept" || key === "department") return String(row.department ?? "");
  if (key === "status" || key === "leave") {
    return String(row.status ?? row.leave ?? "");
  }
  const map: Record<string, string> = {
    date: "date",
    name: "name",
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

function markClass(value: string) {
  if (["P", "L", "E", "HD"].includes(value)) return "font-semibold text-teal";
  if (value === "A") return "font-semibold text-signal";
  if (value === "V") return "font-semibold text-brass";
  return "text-muted";
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

  function query(nextType = type) {
    const qs = new URLSearchParams({ type: nextType, from, to });
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

  async function saveDownload(url: string, filename: string) {
    const response = await fetch(url, { credentials: "include" });
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const json = (await response.json()) as { error?: string };
      throw new Error(json.error ?? "Export failed");
    }
    if (!response.ok) throw new Error("Export failed");
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }

  async function download(format: "csv" | "xlsx" | "pdf") {
    setDownloading(format);
    try {
      if (format === "csv") {
        await saveDownload(`/api/reports/export?format=csv&${query("daily")}`, "attendance-daily.csv");
        if (type !== "daily") {
          await saveDownload(`/api/reports/export?format=csv&${query()}`, `attendance-${type}.csv`);
        }
        return;
      }
      await saveDownload(
        `/api/reports/export?format=${format}&${query()}`,
        `attendance-${type}.${format === "xlsx" ? "xlsx" : format}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setDownloading(null);
    }
  }

  useEffect(() => {
    void Promise.all([api<Employee[]>("/api/employees"), api<Dept[]>("/api/departments")])
      .then(([emps, deps]) => {
        setEmployees(emps);
        setDepartments(deps);
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Failed to load filters");
      });
  }, []);

  useEffect(() => {
    void load();
  }, [type, from, to]);

  return (
    <div>
      <PageHeader
        eyebrow="Exports"
        title="Attendance reports"
        description="Monthly employee summary lists working hours, late hours, early hours, and overtime for office time 10:10 AM to 7:00 PM. Use PDF to download that table."
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
        {type !== "presence" ? (
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
        ) : null}
        <Button onClick={() => void load()}>Apply</Button>
      </div>
      {type === "summary" ? (
        <p className="mb-3 text-xs text-muted">
          Office time is 10:10 AM to 7:00 PM. Working hours are time between check-in and check-out. Late hours start
          after 10:10. Early hours are time left before 7:00 PM. OT count is the number of days worked past 7:00 PM.
          PDF downloads this table.
        </p>
      ) : null}
      {type === "presence" ? (
        <p className="mb-3 text-xs text-muted">
          P Present · L Late · A Absent · V Leave · H Holiday · W Weekend · HD Half-day · E Early · - No record
        </p>
      ) : null}
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase text-muted">
              <tr>
                {(report?.columns ?? []).map((column) => (
                  <th
                    key={column}
                    className={
                      type === "presence" && /^\d/.test(column)
                        ? "px-1.5 py-3 text-center"
                        : "px-5 py-3"
                    }
                  >
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
                    const dayMark = type === "presence" && /^\d/.test(column);
                    return (
                      <td
                        key={column}
                        className={dayMark ? `px-1.5 py-2 text-center ${markClass(value)}` : "px-5 py-3"}
                      >
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
