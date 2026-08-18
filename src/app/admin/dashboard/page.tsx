"use client";

import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { toast } from "sonner";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/utils";
import { formatDateTime, formatTime as fmtTime } from "@/lib/time";

type Stats = {
  totals: {
    present: number;
    late: number;
    absent: number;
    leave: number;
    checkedIn: number;
    checkedOut: number;
    employees: number;
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
      { label: "Present", value: t?.present ?? "—" },
      { label: "Late", value: t?.late ?? "—" },
      { label: "Absent", value: t?.absent ?? "—" },
      { label: "Leave", value: t?.leave ?? "—" },
      { label: "Checked in", value: t?.checkedIn ?? "—" },
      { label: "Checked out", value: t?.checkedOut ?? "—" },
      { label: "Employees", value: t?.employees ?? "—" },
    ];
  }, [stats]);

  return (
    <div>
      <PageHeader
        eyebrow="Live desk"
        title="Today's operations"
        description="Attendance updates from the K50A synchronization worker. The board refreshes without a page reload."
      />
      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        {cards.map((card) => (
          <Stat key={card.label} label={card.label} value={card.value} />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Seven-day movement</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.trend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d7e1e3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="present" stroke="#0e8a96" fill="#0e8a96" fillOpacity={0.15} />
                <Area type="monotone" dataKey="late" stroke="#d61f26" fill="#d61f26" fillOpacity={0.12} />
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
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Live attendance feed</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-line">
            {(stats?.feed ?? []).map((row) => (
              <div key={row.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium">{row.employee}</div>
                  <div className="text-xs text-muted">
                    {row.employeeCode ?? `UID ${row.deviceUserId}`} · {row.device} · {row.verificationMethod}
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
  );
}
