"use client";

import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { toast } from "sonner";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, statusTone } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/utils";
import { formatDateTime, formatTime as fmtTime } from "@/lib/time";
import { formatHours } from "@/lib/hours";

type Stats = {
  month: string;
  totals: {
    present: number;
    late: number;
    absent: number;
    leave: number;
    halfDay: number;
    checkedIn: number;
    checkedOut: number;
    employees: number;
    todayHours: string;
    monthHours: string;
  };
  device: {
    id: string;
    name: string;
    model: string;
    status: string;
    lastSyncAt: string | null;
    ipAddress: string;
    port: number;
    totalSynced: number;
  } | null;
  today: Array<{
    id: string;
    employee: string;
    employeeCode: string;
    department: string | null;
    status: string;
    checkInAt: string | null;
    checkOutAt: string | null;
    workedMinutes: number;
    lateMinutes: number;
    earlyMinutes: number;
  }>;
  feed: Array<{
    id: string;
    employee: string;
    employeeCode: string | null;
    timestamp: string;
    verificationMethod: string;
    device: string;
    deviceUserId: string;
  }>;
  trend: Array<{ date: string; present: number; late: number; absent: number }>;
  monthly: Array<{ date: string; present: number; late: number; absent: number; hours: number }>;
};

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{label}</div>
        <div className="mt-2 font-mono text-3xl font-semibold text-navy">{value}</div>
        {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  async function load() {
    const data = await api<Stats>("/api/dashboard/stats");
    setStats(data);
  }

  useEffect(() => {
    void load();
    const poll = setInterval(() => void load(), 20000);
    const url = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001";
    const socket = io(url, { transports: ["websocket", "polling"] });
    socket.on("attendance:new", (payload: { employee: string; timestamp: string; status: string }) => {
      toast.success(`${payload.employee} · ${payload.status}`);
      void load();
    });
    return () => {
      clearInterval(poll);
      socket.close();
    };
  }, []);

  const cards = useMemo(() => {
    const t = stats?.totals;
    return [
      { label: "Total employees", value: t?.employees ?? "—" },
      { label: "Present", value: t?.present ?? "—" },
      { label: "Late", value: t?.late ?? "—" },
      { label: "Absent", value: t?.absent ?? "—" },
      { label: "Leave", value: t?.leave ?? "—" },
      { label: "Today hours", value: t?.todayHours ?? "—" },
      { label: "Month hours", value: t?.monthHours ?? "—" },
    ];
  }, [stats]);

  return (
    <div>
      <PageHeader
        eyebrow="Live desk"
        title="Today's operations"
        description="Today's attendance summary, monthly overview, working hours, and live K50A punches."
      />
      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        {cards.map((card) => (
          <Stat key={card.label} label={card.label} value={card.value} />
        ))}
      </div>
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Stat label="Checked in" value={stats?.totals.checkedIn ?? "—"} hint="On site now" />
        <Stat label="Checked out" value={stats?.totals.checkedOut ?? "—"} />
        <Stat label="Half day" value={stats?.totals.halfDay ?? "—"} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Monthly attendance · {stats?.month ?? ""}</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.monthly ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d7e1e3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="present" stroke="#0e8a96" fill="#0e8a96" fillOpacity={0.15} />
                <Area type="monotone" dataKey="late" stroke="#d61f26" fill="#d61f26" fillOpacity={0.12} />
                <Area type="monotone" dataKey="absent" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>K50A status</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.device ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{stats.device.name}</span>
                  <Badge tone={stats.device.status === "ONLINE" ? "ok" : "muted"}>{stats.device.status}</Badge>
                </div>
                <div className="font-mono text-muted">
                  {stats.device.ipAddress}:{stats.device.port}
                </div>
                <div>Last sync: {relativeTime(stats.device.lastSyncAt)}</div>
                <div>Transactions synchronized: {stats.device.totalSynced.toLocaleString()}</div>
                <div className="text-xs text-muted">
                  Device stays on the LAN. This console never publishes the K50A TCP port.
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">No device configured yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Today's attendance</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-paper text-left text-xs uppercase text-muted">
                <tr>
                  <th className="px-5 py-3">Employee</th>
                  <th className="px-5 py-3">In</th>
                  <th className="px-5 py-3">Out</th>
                  <th className="px-5 py-3">Hours</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.today ?? []).map((row) => (
                  <tr key={row.id} className="border-t border-line">
                    <td className="px-5 py-3">
                      <div className="font-medium">{row.employee}</div>
                      <div className="text-xs text-muted">
                        {row.employeeCode} · {row.department ?? "—"}
                      </div>
                    </td>
                    <td className="px-5 py-3 font-mono">{fmtTime(row.checkInAt)}</td>
                    <td className="px-5 py-3 font-mono">{fmtTime(row.checkOutAt)}</td>
                    <td className="px-5 py-3 font-mono">{formatHours(row.workedMinutes)}</td>
                    <td className="px-5 py-3">
                      <Badge tone={statusTone(row.status)}>{row.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!stats?.today?.length ? <p className="p-6 text-center text-sm text-muted">No daily register yet today.</p> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-line">
              {(stats?.feed ?? []).map((row) => (
                <div key={row.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium">{row.employee}</div>
                    <div className="text-xs text-muted">
                      {row.employeeCode ?? `UID ${row.deviceUserId}`} · {row.device}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm">{fmtTime(row.timestamp)}</div>
                    <div className="text-xs text-muted">{formatDateTime(row.timestamp)}</div>
                  </div>
                </div>
              ))}
              {!stats?.feed?.length ? <p className="py-8 text-center text-sm text-muted">No scans yet today.</p> : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
