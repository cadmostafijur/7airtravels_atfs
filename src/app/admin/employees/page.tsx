"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  joinedAt: string;
  department: { name: string } | null;
};

type Dept = { id: string; name: string };

const emptyForm = {
  employeeCode: "",
  name: "",
  phone: "",
  email: "",
  deviceUserId: "",
  departmentId: "",
  designation: "",
  joinedAt: new Date().toISOString().slice(0, 10),
};

export default function EmployeesPage() {
  const [rows, setRows] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [q, setQ] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [status, setStatus] = useState("");
  const [form, setForm] = useState(emptyForm);

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

  async function create() {
    try {
      await api("/api/employees", {
        method: "POST",
        body: JSON.stringify({ ...form, departmentId: form.departmentId || null }),
      });
      toast.success("Employee created");
      setForm(emptyForm);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    }
  }

  async function deactivate(id: string, name: string) {
    if (!window.confirm(`Deactivate ${name}? Attendance history is kept.`)) return;
    try {
      await api(`/api/employees/${id}`, { method: "DELETE" });
      toast.success("Employee deactivated");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Directory"
        title="Employees"
        description="Add people, map K50A Device User IDs, and manage status. Fingerprints stay on the terminal."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Search name, ID, or device UID" value={q} onChange={(e) => setQ(e.target.value)} />
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
      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.8fr]">
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-paper text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-3">Employee</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Department</th>
                  <th className="px-5 py-3">Joined</th>
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
                    <td className="px-5 py-3">{formatDate(row.joinedAt)}</td>
                    <td className="px-5 py-3 font-mono">{row.deviceUserId}</td>
                    <td className="px-5 py-3">
                      <Badge tone={row.status === "ACTIVE" ? "ok" : "muted"}>{row.status}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      {row.status === "ACTIVE" ? (
                        <Button size="sm" variant="outline" onClick={() => deactivate(row.id, row.name)}>
                          Deactivate
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-5">
            <h2 className="font-semibold">Add employee</h2>
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
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Device user ID</Label>
              <Input value={form.deviceUserId} onChange={(e) => setForm({ ...form, deviceUserId: e.target.value })} />
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
              <Label>Joining date</Label>
              <Input type="date" value={form.joinedAt} onChange={(e) => setForm({ ...form, joinedAt: e.target.value })} />
            </div>
            <Button onClick={create}>Create employee</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
