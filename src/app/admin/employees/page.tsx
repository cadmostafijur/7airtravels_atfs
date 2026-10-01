"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog, type ConfirmState } from "@/components/ui/confirm-dialog";
import { Input, Label, Select } from "@/components/ui/field";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/time";

type Employee = {
  id: string;
  employeeCode: string;
  name: string;
  phone: string | null;
  email: string | null;
  deviceUserId: string;
  status: string;
  designation: string | null;
  joinedAt: string | null;
  nidNumber: string | null;
  nidDocumentUrl: string | null;
  monthlySalary: number;
  latePenalty: number | null;
  absentPenalty: number | null;
  departmentId: string | null;
  department: { name: string } | null;
};

type Dept = { id: string; name: string; code: string };

const emptyForm = {
  employeeCode: "",
  name: "",
  phone: "",
  email: "",
  deviceUserId: "",
  departmentId: "",
  designation: "",
  joinedAt: "",
  nidNumber: "",
  nidDocumentUrl: "",
  monthlySalary: "",
  latePenalty: "",
  absentPenalty: "",
  status: "ACTIVE",
};

function ModalShell({
  open,
  title,
  description,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy/45 p-4 backdrop-blur-[2px] sm:items-center">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div
        className={`relative z-10 my-4 w-full rounded-2xl border border-line bg-white p-5 shadow-[0_24px_60px_rgba(6,35,45,0.2)] sm:p-6 ${
          wide ? "max-w-3xl" : "max-w-lg"
        }`}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">{title}</h2>
            {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function EmployeesPage() {
  const [rows, setRows] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [q, setQ] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [status, setStatus] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const [deptOpen, setDeptOpen] = useState(false);
  const [deptName, setDeptName] = useState("");
  const [deptCode, setDeptCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  async function load() {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (departmentId) qs.set("departmentId", departmentId);
    if (status) qs.set("status", status);
    const [employees, deps] = await Promise.all([
      api<Employee[]>(`/api/employees?${qs}`),
      api<Dept[]>("/api/departments"),
    ]);
    setRows(employees);
    setDepartments(deps);
  }

  useEffect(() => {
    void load();
  }, []);

  function openAddEmployee() {
    setEditingId(null);
    setForm(emptyForm);
    setEmployeeOpen(true);
  }

  async function openEditEmployee(row: Employee) {
    try {
      const data = await api<Employee>(`/api/employees/${row.id}`);
      setEditingId(data.id);
      setForm({
        employeeCode: data.employeeCode,
        name: data.name,
        phone: data.phone ?? "",
        email: data.email ?? "",
        deviceUserId: data.deviceUserId,
        departmentId: data.departmentId ?? "",
        designation: data.designation ?? "",
        joinedAt: data.joinedAt ? data.joinedAt.slice(0, 10) : "",
        nidNumber: data.nidNumber ?? "",
        nidDocumentUrl: data.nidDocumentUrl ?? "",
        monthlySalary: data.monthlySalary ? String(data.monthlySalary) : "",
        latePenalty: data.latePenalty == null ? "" : String(data.latePenalty),
        absentPenalty: data.absentPenalty == null ? "" : String(data.absentPenalty),
        status: data.status,
      });
      setEmployeeOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load employee");
    }
  }

  async function saveEmployee() {
    if (!form.employeeCode.trim() || !form.name.trim() || !form.deviceUserId.trim()) {
      toast.error("Employee ID, Name, and K50A User ID are required");
      return;
    }
    setSaving(true);
    const payload = {
      employeeCode: form.employeeCode.trim(),
      name: form.name.trim(),
      phone: form.phone.trim() || "",
      email: form.email.trim() || "",
      deviceUserId: form.deviceUserId.trim(),
      departmentId: form.departmentId || null,
      designation: form.designation.trim() || "",
      status: form.status,
      joinedAt: form.joinedAt || null,
      nidNumber: form.nidNumber.trim() || null,
      nidDocumentUrl: form.nidDocumentUrl || null,
      monthlySalary: Number(form.monthlySalary || 0),
      latePenalty: form.latePenalty === "" ? null : Number(form.latePenalty),
      absentPenalty: form.absentPenalty === "" ? null : Number(form.absentPenalty),
    };
    try {
      if (editingId) {
        await api(`/api/employees/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast.success("Employee updated");
      } else {
        await api("/api/employees", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Employee created");
      }
      setForm(emptyForm);
      setEditingId(null);
      setEmployeeOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function uploadNid(file: File | null) {
    if (!file) return;
    try {
      const data = new FormData();
      data.append("file", file);
      const result = await api<{ url: string }>("/api/uploads/nid", { method: "POST", body: data });
      setForm((prev) => ({ ...prev, nidDocumentUrl: result.url }));
      toast.success("NID file ready — it will be saved with the employee");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    }
  }

  async function createDepartment() {
    if (!deptName.trim()) {
      toast.error("Department name is required");
      return;
    }
    setSaving(true);
    try {
      const created = await api<Dept>("/api/departments", {
        method: "POST",
        body: JSON.stringify({ name: deptName.trim(), code: deptCode.trim() || undefined }),
      });
      toast.success(`Department “${created.name}” added`);
      setDeptName("");
      setDeptCode("");
      setDeptOpen(false);
      await load();
      setForm((prev) => ({ ...prev, departmentId: created.id }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  function askDeactivate(id: string, name: string) {
    setConfirm({
      title: `Deactivate ${name}?`,
      description: "The employee becomes inactive. Attendance history is kept.",
      confirmLabel: "Deactivate",
      danger: true,
      onConfirm: async () => {
        try {
          await api(`/api/employees/${id}`, { method: "DELETE" });
          toast.success("Employee deactivated");
          await load();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Failed");
        }
      },
    });
  }

  function askDelete(id: string, name: string) {
    setConfirm({
      title: `Delete ${name} permanently?`,
      description: "This removes the employee and their attendance summaries, leaves, and linked punch history. This cannot be undone.",
      confirmLabel: "Delete forever",
      danger: true,
      onConfirm: async () => {
        try {
          await api(`/api/employees/${id}?hard=true`, { method: "DELETE" });
          toast.success("Employee deleted");
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

      <ModalShell
        open={employeeOpen}
        title={editingId ? "Edit employee" : "Add employee"}
        description={
          editingId
            ? "Update employee details. NID file is optional and stored with the employee record."
            : "Fill in employee details. NID file is optional and stored with the employee record."
        }
        onClose={() => {
          setEmployeeOpen(false);
          setEditingId(null);
        }}
        wide
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Employee ID *</Label>
            <Input value={form.employeeCode} onChange={(e) => setForm({ ...form, employeeCode: e.target.value })} />
          </div>
          <div>
            <Label>Full name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label>K50A User ID *</Label>
            <Input
              placeholder="e.g. 1001"
              value={form.deviceUserId}
              onChange={(e) => setForm({ ...form, deviceUserId: e.target.value })}
            />
            <p className="mt-1 text-xs text-muted">Must match the User ID on the K50A terminal.</p>
          </div>
          <div>
            <Label>Designation</Label>
            <Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
          </div>
          <div>
            <Label>Department</Label>
            <div className="flex gap-2">
              <Select
                className="flex-1"
                value={form.departmentId}
                onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
              >
                <option value="">Unassigned</option>
                {departments.map((dep) => (
                  <option key={dep.id} value={dep.id}>
                    {dep.name}
                  </option>
                ))}
              </Select>
              <Button type="button" variant="outline" onClick={() => setDeptOpen(true)}>
                New
              </Button>
            </div>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </Select>
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
          <div className="sm:col-span-2">
            <Label>NID file upload (optional)</Label>
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => void uploadNid(e.target.files?.[0] ?? null)}
            />
            <p className="mt-1 text-xs text-muted">JPG, PNG, WEBP, or PDF · max 5 MB · saved in database with employee</p>
            {form.nidDocumentUrl ? (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <a
                  className="text-xs font-semibold text-teal hover:underline"
                  href={form.nidDocumentUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Preview NID file
                </a>
                <Button type="button" size="sm" variant="outline" onClick={() => setForm({ ...form, nidDocumentUrl: "" })}>
                  Remove file
                </Button>
              </div>
            ) : null}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setEmployeeOpen(false);
              setEditingId(null);
            }}
          >
            Cancel
          </Button>
          <Button type="button" disabled={saving} onClick={() => void saveEmployee()}>
            {saving ? "Saving…" : editingId ? "Update employee" : "Save employee"}
          </Button>
        </div>
      </ModalShell>

      <ModalShell
        open={deptOpen}
        title="Add department"
        description="Create a new department for employee assignment."
        onClose={() => setDeptOpen(false)}
      >
        <div className="space-y-3">
          <div>
            <Label>Department name *</Label>
            <Input
              placeholder="e.g. Ticketing"
              value={deptName}
              onChange={(e) => setDeptName(e.target.value)}
            />
          </div>
          <div>
            <Label>Code (optional)</Label>
            <Input
              placeholder="Auto from name if empty"
              value={deptCode}
              onChange={(e) => setDeptCode(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDeptOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={saving} onClick={() => void createDepartment()}>
              {saving ? "Saving…" : "Add department"}
            </Button>
          </div>
        </div>
      </ModalShell>

      <PageHeader
        eyebrow="Admin · Employee records"
        title="Employees"
        description="Admin-only page. Staff never log in — they only scan on K50A."
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => setDeptOpen(true)}>
              Add department
            </Button>
            <Button type="button" onClick={openAddEmployee}>
              Add employee
            </Button>
          </>
        }
      />

      <Card className="mb-4 border-teal/30 bg-teal/5">
        <CardContent className="space-y-2 p-5 text-sm leading-relaxed">
          <p className="font-semibold text-teal">How K50A and the website connect</p>
          <ol className="list-decimal space-y-1 pl-5 text-muted">
            <li>On K50A: enroll fingerprint and set User ID (example: 1001).</li>
            <li>Click <strong>Add employee</strong> and enter the same K50A User ID.</li>
            <li>When they scan, attendance is saved for that employee.</li>
          </ol>
        </CardContent>
      </Card>

      <div className="mb-4 flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Search name, ID, NID, or device UID" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select className="w-44" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
          <option value="">All departments</option>
          {departments.map((dep) => (
            <option key={dep.id} value={dep.id}>
              {dep.name}
            </option>
          ))}
        </Select>
        <Select className="w-36" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All status</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
        </Select>
        <Button variant="outline" onClick={() => void load()}>
          Search
        </Button>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-5 py-3">Employee</th>
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3">Salary</th>
                <th className="px-5 py-3">Penalty / day</th>
                <th className="px-5 py-3">Joined</th>
                <th className="px-5 py-3">NID</th>
                <th className="px-5 py-3">Device UID</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-5 py-3">
                    <Link className="font-semibold text-teal hover:underline" href={`/admin/employees/${row.id}`}>
                      {row.name}
                    </Link>
                    <div className="text-xs text-muted">
                      {row.employeeCode} · {row.designation ?? "—"}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs">
                    <div>{row.phone ?? "—"}</div>
                    <div className="text-muted">{row.email ?? ""}</div>
                  </td>
                  <td className="px-5 py-3">{row.department?.name ?? "—"}</td>
                  <td className="px-5 py-3">{row.monthlySalary ? `Tk ${row.monthlySalary.toLocaleString("en-BD")}` : "—"}</td>
                  <td className="px-5 py-3">{row.absentPenalty != null ? `Tk ${row.absentPenalty.toLocaleString("en-BD")}` : "—"}</td>
                  <td className="px-5 py-3">{formatDate(row.joinedAt)}</td>
                  <td className="px-5 py-3 text-xs">
                    <div>{row.nidNumber ?? "—"}</div>
                    {row.nidDocumentUrl ? (
                      <a className="font-semibold text-teal hover:underline" href={row.nidDocumentUrl} target="_blank" rel="noreferrer">
                        View file
                      </a>
                    ) : null}
                  </td>
                  <td className="px-5 py-3 font-mono">{row.deviceUserId}</td>
                  <td className="px-5 py-3">
                    <Badge tone={row.status === "ACTIVE" ? "ok" : "muted"}>{row.status}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => void openEditEmployee(row)}>
                        Edit
                      </Button>
                      {row.status === "ACTIVE" ? (
                        <Button size="sm" variant="outline" onClick={() => askDeactivate(row.id, row.name)}>
                          Deactivate
                        </Button>
                      ) : null}
                      <Button size="sm" variant="danger" onClick={() => askDelete(row.id, row.name)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center text-muted">
                    No employees yet. Click <strong>Add employee</strong> to create one.
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
