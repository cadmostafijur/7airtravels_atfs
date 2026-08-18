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

type Employee = {
  id: string;
  employeeCode: string;
  name: string;
  phone: string | null;
  deviceUserId: string;
  status: string;
  designation: string | null;
  department: { name: string } | null;
};

type Dept = { id: string; name: string };

export default function EmployeesPage() {
  const [rows, setRows] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({
    employeeCode: "",
    name: "",
    phone: "",
    deviceUserId: "",
    departmentId: "",
    designation: "",
  });

  async function load() {
    const [employees, deps] = await Promise.all([
      api<Employee[]>(`/api/employees${q ? `?q=${encodeURIComponent(q)}` : ""}`),
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
      setForm({ employeeCode: "", name: "", phone: "", deviceUserId: "", departmentId: "", designation: "" });
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
        description="Enroll fingerprints on the K50A with a User ID, then map the same Device User ID here. Admins cannot enroll fingerprints from the web."
      />
      <div className="mb-4 flex gap-2">
        <Input placeholder="Search name, code, or device user ID" value={q} onChange={(e) => setQ(e.target.value)} />
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
                  <th className="px-5 py-3">Department</th>
                  <th className="px-5 py-3">Device UID</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-line">
                    <td className="px-5 py-3">
                      <Link className="font-semibold text-teal hover:underline" href={`/admin/employees/${row.id}`}>
                        {row.name}
                      </Link>
                      <div className="text-xs text-muted">{row.employeeCode}</div>
                    </td>
                    <td className="px-5 py-3">{row.department?.name ?? "—"}</td>
                    <td className="px-5 py-3 font-mono">{row.deviceUserId}</td>
                    <td className="px-5 py-3">
                      <Badge tone={row.status === "ACTIVE" ? "ok" : "muted"}>{row.status}</Badge>
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
              <Label>Code</Label>
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
            <Button onClick={create}>Create employee</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
