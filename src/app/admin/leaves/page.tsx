"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/field";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/time";

type Leave = {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: string;
  employee: { name: string; id: string };
};
type Employee = { id: string; name: string };

export default function LeavesPage() {
  const [rows, setRows] = useState<Leave[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [form, setForm] = useState({ employeeId: "", startDate: "", endDate: "", reason: "" });

  async function load() {
    const [leaves, people] = await Promise.all([api<Leave[]>("/api/leaves"), api<Employee[]>("/api/employees")]);
    setRows(leaves);
    setEmployees(people);
  }
  useEffect(() => {
    void load();
  }, []);

  async function create() {
    try {
      await api("/api/leaves", { method: "POST", body: JSON.stringify(form) });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    }
  }

  async function setStatus(id: string, status: string) {
    await api(`/api/leaves/${id}`, { method: "PUT", body: JSON.stringify({ status }) });
    await load();
  }

  return (
    <div>
      <PageHeader eyebrow="Absence" title="Leave records" />
      <Card className="mb-4">
        <CardContent className="grid gap-3 p-5 md:grid-cols-5">
          <div className="md:col-span-2">
            <Label>Employee</Label>
            <Select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
              <option value="">Select</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Start</Label>
            <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </div>
          <div>
            <Label>End</Label>
            <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </div>
          <div className="md:col-span-4">
            <Label>Reason</Label>
            <Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>
          <Button className="self-end" onClick={create}>
            Add leave
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="divide-y divide-line p-0">
          {rows.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
              <div>
                <div className="font-medium">{row.employee.name}</div>
                <div className="text-muted">
                  {formatDate(row.startDate)} → {formatDate(row.endDate)} · {row.reason}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={row.status === "APPROVED" ? "ok" : "muted"}>{row.status}</Badge>
                {row.status === "PENDING" ? (
                  <>
                    <Button size="sm" onClick={() => setStatus(row.id, "APPROVED")}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setStatus(row.id, "REJECTED")}>
                      Reject
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
