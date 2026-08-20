"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog, type ConfirmState } from "@/components/ui/confirm-dialog";
import { Input, Label, Select } from "@/components/ui/field";
import { api } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/time";
import { formatHours } from "@/lib/hours";

type Row = {
  id: string;
  workDate: string;
  status: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  lateMinutes: number;
  earlyMinutes: number;
  overtimeMinutes: number;
  workedMinutes: number;
  notes: string | null;
  employee: { id: string; name: string; employeeCode: string; department: { name: string } | null };
};

type Employee = { id: string; name: string; employeeCode: string };
type Dept = { id: string; name: string };
type Me = { role: string };

const statuses = [
  "PRESENT",
  "LATE",
  "ABSENT",
  "EARLY_LEAVE",
  "HALF_DAY",
  "LEAVE",
  "HOLIDAY",
  "WEEKEND",
  "OVERTIME",
];

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AttendancePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    employeeId: "",
    workDate: new Date().toISOString().slice(0, 10),
    status: "PRESENT",
    checkInAt: "",
    checkOutAt: "",
    notes: "",
    lateMinutes: 0,
    earlyMinutes: 0,
    overtimeMinutes: 0,
  });
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const canWrite = me?.role === "SUPER_ADMIN" || me?.role === "ADMIN";

  async function load() {
    const qs = new URLSearchParams({ from, to });
    if (status) qs.set("status", status);
    if (q) qs.set("q", q);
    if (employeeId) qs.set("employeeId", employeeId);
    if (departmentId) qs.set("departmentId", departmentId);
    setRows(await api<Row[]>(`/api/attendance?${qs}`));
  }

  useEffect(() => {
    void Promise.all([
      load(),
      api<Me>("/api/auth/me"),
      api<Employee[]>("/api/employees"),
      api<Dept[]>("/api/departments"),
    ]).then(([, user, emps, deps]) => {
      setMe(user);
      setEmployees(emps);
      setDepartments(deps);
    });
  }, []);

  function openEdit(row: Row) {
    setEditing(row);
    setForm({
      employeeId: row.employee.id,
      workDate: row.workDate.slice(0, 10),
      status: row.status,
      checkInAt: toLocalInput(row.checkInAt),
      checkOutAt: toLocalInput(row.checkOutAt),
      notes: row.notes ?? "",
      lateMinutes: row.lateMinutes,
      earlyMinutes: row.earlyMinutes,
      overtimeMinutes: row.overtimeMinutes,
    });
  }

  async function saveEdit() {
    if (!editing) return;
    try {
      await api(`/api/attendance/summary/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify({
          status: form.status,
          checkInAt: form.checkInAt ? new Date(form.checkInAt).toISOString() : null,
          checkOutAt: form.checkOutAt ? new Date(form.checkOutAt).toISOString() : null,
          notes: form.notes || null,
          lateMinutes: form.lateMinutes,
          earlyMinutes: form.earlyMinutes,
          overtimeMinutes: form.overtimeMinutes,
        }),
      });
      toast.success("Daily register updated");
      setEditing(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    }
  }

  async function createEntry() {
    try {
      await api("/api/attendance/summary", {
        method: "POST",
        body: JSON.stringify({
          employeeId: form.employeeId,
          workDate: form.workDate,
          status: form.status,
          checkInAt: form.checkInAt ? new Date(form.checkInAt).toISOString() : null,
          checkOutAt: form.checkOutAt ? new Date(form.checkOutAt).toISOString() : null,
          notes: form.notes || null,
          lateMinutes: form.lateMinutes,
          earlyMinutes: form.earlyMinutes,
          overtimeMinutes: form.overtimeMinutes,
        }),
      });
      toast.success("Entry added");
      setCreating(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    }
  }

  function askRemove(id: string, name: string) {
    setConfirm({
      title: `Delete daily register for ${name}?`,
      description: "This removes the daily summary only. Raw fingerprint punches are not deleted.",
      confirmLabel: "Delete",
      danger: true,
      onConfirm: async () => {
        try {
          await api(`/api/attendance/summary/${id}`, { method: "DELETE" });
          toast.success("Entry deleted");
          await load();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Failed");
        }
      },
    });
  }

  return (
    <div>
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
      <PageHeader
        eyebrow="Processed attendance"
        title="Daily register"
        description="Summaries from K50A punches. Admins can edit status and times. Raw fingerprint logs are kept separately."
        actions={
          canWrite ? (
            <Button
              onClick={() => {
                setCreating(true);
                setForm({
                  employeeId: employees[0]?.id ?? "",
                  workDate: new Date().toISOString().slice(0, 10),
                  status: "PRESENT",
                  checkInAt: "",
                  checkOutAt: "",
                  notes: "",
                  lateMinutes: 0,
                  earlyMinutes: 0,
                  overtimeMinutes: 0,
                });
              }}
            >
              Add entry
            </Button>
          ) : null
        }
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
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
          <Input placeholder="Name or employee ID" value={q} onChange={(e) => setQ(e.target.value)} />
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
            {statuses.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </div>
        <Button onClick={() => void load()}>Apply</Button>
      </div>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Employee</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3">In</th>
                <th className="px-5 py-3">Out</th>
                <th className="px-5 py-3">Hours</th>
                <th className="px-5 py-3">Late</th>
                <th className="px-5 py-3">Early</th>
                <th className="px-5 py-3">Status</th>
                {canWrite ? <th className="px-5 py-3">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-5 py-3">{formatDate(row.workDate)}</td>
                  <td className="px-5 py-3">
                    <div className="font-medium">{row.employee.name}</div>
                    <div className="text-xs text-muted">{row.employee.employeeCode}</div>
                  </td>
                  <td className="px-5 py-3">{row.employee.department?.name ?? "—"}</td>
                  <td className="px-5 py-3 font-mono">{formatTime(row.checkInAt)}</td>
                  <td className="px-5 py-3 font-mono">{formatTime(row.checkOutAt)}</td>
                  <td className="px-5 py-3 font-mono">{formatHours(row.workedMinutes)}</td>
                  <td className="px-5 py-3">{row.lateMinutes}</td>
                  <td className="px-5 py-3">{row.earlyMinutes}</td>
                  <td className="px-5 py-3">
                    <Badge tone={statusTone(row.status)}>{row.status}</Badge>
                  </td>
                  {canWrite ? (
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => askRemove(row.id, row.employee.name)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {(editing || creating) && canWrite ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4">
          <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto">
            <CardContent className="space-y-3 p-6">
              <h2 className="text-lg font-semibold">{editing ? "Edit daily register" : "Add daily register"}</h2>
              {creating ? (
                <div>
                  <Label>Employee</Label>
                  <Select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.employeeCode})
                      </option>
                    ))}
                  </Select>
                </div>
              ) : null}
              {creating ? (
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={form.workDate} onChange={(ev) => setForm({ ...form, workDate: ev.target.value })} />
                </div>
              ) : null}
              <div>
                <Label>Status</Label>
                <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {statuses.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Check-in</Label>
                <Input type="datetime-local" value={form.checkInAt} onChange={(e) => setForm({ ...form, checkInAt: e.target.value })} />
              </div>
              <div>
                <Label>Check-out</Label>
                <Input type="datetime-local" value={form.checkOutAt} onChange={(e) => setForm({ ...form, checkOutAt: e.target.value })} />
              </div>
              <div>
                <Label>Notes</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label>Late min</Label>
                  <Input type="number" value={form.lateMinutes} onChange={(e) => setForm({ ...form, lateMinutes: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Early min</Label>
                  <Input type="number" value={form.earlyMinutes} onChange={(e) => setForm({ ...form, earlyMinutes: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>OT min</Label>
                  <Input type="number" value={form.overtimeMinutes} onChange={(e) => setForm({ ...form, overtimeMinutes: Number(e.target.value) })} />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={() => (editing ? saveEdit() : createEntry())}>Save</Button>
                <Button variant="outline" onClick={() => { setEditing(null); setCreating(false); }}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
