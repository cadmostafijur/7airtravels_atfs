"use client";

import { use, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/field";
import { api } from "@/lib/api";
import { formatDate, formatDateTime, formatTime } from "@/lib/time";

type Employee = {
  id: string;
  employeeCode: string;
  name: string;
  phone: string | null;
  email: string | null;
  designation: string | null;
  deviceUserId: string;
  status: string;
  department: { name: string } | null;
  summaries: Array<{
    id: string;
    workDate: string;
    status: string;
    checkInAt: string | null;
    checkOutAt: string | null;
  }>;
  attendances: Array<{ id: string; timestamp: string; verificationMethod: string; source: string }>;
};

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [deviceUserId, setDeviceUserId] = useState("");
  const [status, setStatus] = useState("ACTIVE");

  async function load() {
    const data = await api<Employee>(`/api/employees/${id}`);
    setEmployee(data);
    setName(data.name);
    setPhone(data.phone ?? "");
    setDeviceUserId(data.deviceUserId);
    setStatus(data.status);
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function save() {
    try {
      await api(`/api/employees/${id}`, {
        method: "PUT",
        body: JSON.stringify({ name, phone, deviceUserId, status }),
      });
      toast.success("Saved");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    }
  }

  if (!employee) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div>
      <PageHeader
        eyebrow={employee.employeeCode}
        title={employee.name}
        description={`${employee.department?.name ?? "No department"} · Device user ${employee.deviceUserId}`}
        actions={
          <a className="text-sm font-semibold text-teal" href={`/api/reports/export?format=csv`}>
            Export CSV
          </a>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label>Device user ID</Label>
              <Input value={deviceUserId} onChange={(e) => setDeviceUserId(e.target.value)} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
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
          </CardContent>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Daily summaries</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">In</th>
                <th className="px-5 py-3">Out</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {employee.summaries.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-5 py-3">{formatDate(row.workDate)}</td>
                  <td className="px-5 py-3 font-mono">{formatTime(row.checkInAt)}</td>
                  <td className="px-5 py-3 font-mono">{formatTime(row.checkOutAt)}</td>
                  <td className="px-5 py-3">
                    <Badge tone={statusTone(row.status)}>{row.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
