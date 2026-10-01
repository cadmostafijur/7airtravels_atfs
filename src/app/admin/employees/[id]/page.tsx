"use client";

import { use, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog, type ConfirmState } from "@/components/ui/confirm-dialog";
import { Input, Label, Select } from "@/components/ui/field";
import { api } from "@/lib/api";
import { formatDate, formatDateTime, formatTime } from "@/lib/time";
import { formatHours } from "@/lib/hours";

type Dept = { id: string; name: string };

type Employee = {
  id: string;
  employeeCode: string;
  name: string;
  phone: string | null;
  email: string | null;
  designation: string | null;
  deviceUserId: string;
  status: string;
  joinedAt: string | null;
  nidNumber: string | null;
  nidDocumentUrl: string | null;
  monthlySalary: number;
  latePenalty: number | null;
  absentPenalty: number | null;
  departmentId: string | null;
  department: { name: string } | null;
  summaries: Array<{
    id: string;
    workDate: string;
    status: string;
    checkInAt: string | null;
    checkOutAt: string | null;
    workedMinutes: number;
    lateMinutes: number;
    earlyMinutes: number;
    overtimeMinutes: number;
  }>;
  attendances: Array<{ id: string; timestamp: string; verificationMethod: string; source: string }>;
  leaves: Array<{ id: string; startDate: string; endDate: string; status: string; reason: string | null }>;
};

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [form, setForm] = useState({
    employeeCode: "",
    name: "",
    phone: "",
    email: "",
    designation: "",
    deviceUserId: "",
    departmentId: "",
    status: "ACTIVE",
    joinedAt: "",
    nidNumber: "",
    nidDocumentUrl: "",
    monthlySalary: "",
    latePenalty: "",
    absentPenalty: "",
  });
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  async function load() {
    const [data, deps] = await Promise.all([
      api<Employee>(`/api/employees/${id}`),
      api<Dept[]>("/api/departments"),
    ]);
    setEmployee(data);
    setDepartments(deps);
    setForm({
      employeeCode: data.employeeCode,
      name: data.name,
      phone: data.phone ?? "",
      email: data.email ?? "",
      designation: data.designation ?? "",
      deviceUserId: data.deviceUserId,
      departmentId: data.departmentId ?? "",
      status: data.status,
      joinedAt: data.joinedAt ? data.joinedAt.slice(0, 10) : "",
      nidNumber: data.nidNumber ?? "",
      nidDocumentUrl: data.nidDocumentUrl ?? "",
      monthlySalary: data.monthlySalary ? String(data.monthlySalary) : "",
      latePenalty: data.latePenalty == null ? "" : String(data.latePenalty),
      absentPenalty: data.absentPenalty == null ? "" : String(data.absentPenalty),
    });
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function save() {
    try {
      await api(`/api/employees/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...form,
          email: form.email || "",
          phone: form.phone || "",
          departmentId: form.departmentId || null,
          joinedAt: form.joinedAt || null,
          nidNumber: form.nidNumber || null,
          nidDocumentUrl: form.nidDocumentUrl || null,
          monthlySalary: Number(form.monthlySalary || 0),
          latePenalty: form.latePenalty === "" ? null : Number(form.latePenalty),
          absentPenalty: form.absentPenalty === "" ? null : Number(form.absentPenalty),
        }),
      });
      toast.success("Saved");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    }
  }

  async function uploadNid(file: File | null) {
    if (!file) return;
    try {
      const data = new FormData();
      data.append("file", file);
      const result = await api<{ url: string }>("/api/uploads/nid", { method: "POST", body: data });
      setForm((prev) => ({ ...prev, nidDocumentUrl: result.url }));
      toast.success("NID file uploaded — click Save to keep it");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    }
  }

  function askDeactivate() {
    setConfirm({
      title: "Deactivate this employee?",
      description: "The employee becomes inactive. Attendance history is kept.",
      confirmLabel: "Deactivate",
      danger: true,
      onConfirm: async () => {
        try {
          await api(`/api/employees/${id}`, { method: "DELETE" });
          toast.success("Deactivated");
          await load();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Failed");
        }
      },
    });
  }

  function askDelete() {
    setConfirm({
      title: "Delete this employee permanently?",
      description: "Removes the employee and their attendance history from the website. This cannot be undone.",
      confirmLabel: "Delete forever",
      danger: true,
      onConfirm: async () => {
        try {
          await api(`/api/employees/${id}?hard=true`, { method: "DELETE" });
          toast.success("Employee deleted");
          window.location.href = "/admin/employees";
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Failed");
        }
      },
    });
  }

  if (!employee) return <p className="text-sm text-muted">Loading…</p>;

  const exportHref = `/api/reports/export?format=csv&type=daily&employeeId=${id}&from=2020-01-01&to=${new Date().toISOString().slice(0, 10)}`;

  return (
    <div>
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
      <PageHeader
        eyebrow={employee.employeeCode}
        title={employee.name}
        description={`${employee.department?.name ?? "No department"} · Device user ${employee.deviceUserId}`}
        actions={
          <>
            <a className="text-sm font-semibold text-teal" href={exportHref}>
              Export this employee
            </a>
            {employee.status === "ACTIVE" ? (
              <Button variant="outline" onClick={askDeactivate}>
                Deactivate
              </Button>
            ) : null}
            <Button variant="danger" onClick={askDelete}>
              Delete
            </Button>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Employee ID</Label>
              <Input value={form.employeeCode} onChange={(e) => setForm({ ...form, employeeCode: e.target.value })} />
            </div>
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Designation</Label>
              <Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
            </div>
            <div>
              <Label>Department</Label>
              <Select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                <option value="">Unassigned</option>
                {departments.map((dep) => (
                  <option key={dep.id} value={dep.id}>
                    {dep.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Joining date (optional)</Label>
              <Input type="date" value={form.joinedAt} onChange={(e) => setForm({ ...form, joinedAt: e.target.value })} />
            </div>
            <div>
              <Label>NID number (optional)</Label>
              <Input
                placeholder="National ID number"
                value={form.nidNumber}
                onChange={(e) => setForm({ ...form, nidNumber: e.target.value })}
              />
            </div>
            <div>
              <Label>NID upload (optional)</Label>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => void uploadNid(e.target.files?.[0] ?? null)}
              />
              <p className="mt-1 text-xs text-muted">JPG, PNG, WEBP, or PDF · max 5 MB</p>
              {form.nidDocumentUrl ? (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <a className="text-xs font-semibold text-teal hover:underline" href={form.nidDocumentUrl} target="_blank" rel="noreferrer">
                    View NID file
                  </a>
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() => setForm({ ...form, nidDocumentUrl: "" })}
                  >
                    Remove file
                  </Button>
                </div>
              ) : null}
            </div>
            <div>
              <Label>Monthly salary (Tk)</Label>
              <Input
                type="number"
                min={0}
                placeholder="e.g. 10000"
                value={form.monthlySalary}
                onChange={(e) => setForm({ ...form, monthlySalary: e.target.value })}
              />
            </div>
            <p className="text-xs text-muted md:col-span-2">
              Absent penalty per day is salary divided by the month’s working days, and it is filled in for everyone when
              Salary opens. Fine is that penalty times every absent day. You can change the fine there before marking the
              month paid.
            </p>
            <div>
              <Label>Device user ID</Label>
              <Input value={form.deviceUserId} onChange={(e) => setForm({ ...form, deviceUserId: e.target.value })} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </Select>
            </div>
            <Button onClick={save}>Save</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Raw fingerprint transactions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {employee.attendances.map((row) => (
              <div key={row.id} className="flex justify-between border-b border-line py-2">
                <span>{formatDateTime(row.timestamp)}</span>
                <span className="text-muted">
                  {row.verificationMethod} · {row.source}
                </span>
              </div>
            ))}
            {!employee.attendances.length ? <p className="text-muted">No device punches yet.</p> : null}
          </CardContent>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Attendance history</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">In</th>
                <th className="px-5 py-3">Out</th>
                <th className="px-5 py-3">Hours</th>
                <th className="px-5 py-3">Late</th>
                <th className="px-5 py-3">Early</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {employee.summaries.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-5 py-3">{formatDate(row.workDate)}</td>
                  <td className="px-5 py-3 font-mono">{formatTime(row.checkInAt)}</td>
                  <td className="px-5 py-3 font-mono">{formatTime(row.checkOutAt)}</td>
                  <td className="px-5 py-3 font-mono">{formatHours(row.workedMinutes)}</td>
                  <td className="px-5 py-3">{row.lateMinutes}</td>
                  <td className="px-5 py-3">{row.earlyMinutes}</td>
                  <td className="px-5 py-3">
                    <Badge tone={statusTone(row.status)}>{row.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      {employee.leaves.length ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Leave history</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-line p-0 text-sm">
            {employee.leaves.map((row) => (
              <div key={row.id} className="flex justify-between px-5 py-3">
                <span>
                  {formatDate(row.startDate)} → {formatDate(row.endDate)} · {row.reason}
                </span>
                <Badge tone={row.status === "APPROVED" ? "ok" : "muted"}>{row.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
