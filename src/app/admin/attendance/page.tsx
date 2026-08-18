"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/field";
import { api } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/time";

type Row = {
  id: string;
  workDate: string;
  status: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  lateMinutes: number;
  employee: { name: string; employeeCode: string; department: { name: string } | null };
};

export default function AttendancePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState("");

  async function load() {
    const qs = new URLSearchParams({ from, to });
    if (status) qs.set("status", status);
    setRows(await api<Row[]>(`/api/attendance?${qs}`));
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div>
      <PageHeader
        eyebrow="Processed attendance"
        title="Daily register"
        description="Summaries are calculated from raw K50A punches. Original fingerprint transactions are never modified."
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
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Employee</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3">In</th>
                <th className="px-5 py-3">Out</th>
                <th className="px-5 py-3">Status</th>
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
