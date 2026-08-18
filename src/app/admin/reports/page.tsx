"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, statusTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";
import { api } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/time";

type Row = {
  id: string;
  workDate: string;
  status: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  lateMinutes: number;
  earlyMinutes: number;
  overtimeMinutes: number;
  employee: { name: string; employeeCode: string; department: { name: string } | null };
};

export default function ReportsPage() {
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Row[]>([]);

  async function load() {
    setRows(await api<Row[]>(`/api/reports?from=${from}&to=${to}`));
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div>
      <PageHeader
        eyebrow="Exports"
        title="Attendance reports"
        description="Daily, late, absent, early departure and overtime views. Raw punches remain in a separate table."
        actions={
          <>
            <a href={`/api/reports/export?format=csv&from=${from}&to=${to}`}>
              <Button variant="outline">CSV</Button>
            </a>
            <a href={`/api/reports/export?format=xlsx&from=${from}&to=${to}`}>
              <Button variant="outline">Excel</Button>
            </a>
            <a href={`/api/reports/export?format=pdf&from=${from}&to=${to}`}>
              <Button variant="outline">PDF</Button>
            </a>
          </>
        }
      />
      <div className="mb-4 flex gap-3">
        <div>
          <Label>From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label>To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Button className="self-end" onClick={() => void load()}>
          Refresh
        </Button>
      </div>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Employee</th>
                <th className="px-5 py-3">In / Out</th>
                <th className="px-5 py-3">Late</th>
                <th className="px-5 py-3">Early</th>
                <th className="px-5 py-3">OT</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-5 py-3">{formatDate(row.workDate)}</td>
                  <td className="px-5 py-3">
                    {row.employee.name}
                    <div className="text-xs text-muted">{row.employee.department?.name}</div>
                  </td>
                  <td className="px-5 py-3 font-mono">
                    {formatTime(row.checkInAt)} / {formatTime(row.checkOutAt)}
                  </td>
                  <td className="px-5 py-3">{row.lateMinutes}</td>
                  <td className="px-5 py-3">{row.earlyMinutes}</td>
                  <td className="px-5 py-3">{row.overtimeMinutes}</td>
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
