"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/time";

type Settings = {
  enabled: boolean;
  adminPhone1: string | null;
  adminPhone2: string | null;
  adminPhone3: string | null;
  notifyOnAttendance: boolean;
  notifyOnLate: boolean;
};
type Log = {
  id: string;
  recipient: string;
  message: string;
  status: string;
  eventType: string;
  createdAt: string;
  providerResponse: string | null;
};

export default function SmsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [testPhone, setTestPhone] = useState("");

  async function load() {
    const [s, l] = await Promise.all([api<Settings>("/api/sms/settings"), api<Log[]>("/api/sms/logs")]);
    setSettings(s);
    setLogs(l);
  }
  useEffect(() => {
    void load();
  }, []);

  async function save() {
    if (!settings) return;
    try {
      await api("/api/sms/settings", { method: "PUT", body: JSON.stringify(settings) });
      toast.success("SMS settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    }
  }

  async function test() {
    try {
      await api("/api/sms/test", { method: "POST", body: JSON.stringify({ phone: testPhone }) });
      toast.success("Test SMS attempted");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    }
  }

  if (!settings) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div>
      <PageHeader
        eyebrow="Alerts"
        title="Administrator SMS"
        description="Exactly three administrator numbers. Duplicate punches never resend a successful SMS. SMS failure never blocks attendance storage."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recipients</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
              />
              Enable SMS notifications
            </label>
            <div>
              <Label>Admin SMS number 1</Label>
              <Input
                value={settings.adminPhone1 ?? ""}
                onChange={(e) => setSettings({ ...settings, adminPhone1: e.target.value })}
              />
            </div>
            <div>
              <Label>Admin SMS number 2</Label>
              <Input
                value={settings.adminPhone2 ?? ""}
                onChange={(e) => setSettings({ ...settings, adminPhone2: e.target.value })}
              />
            </div>
            <div>
              <Label>Admin SMS number 3</Label>
              <Input
                value={settings.adminPhone3 ?? ""}
                onChange={(e) => setSettings({ ...settings, adminPhone3: e.target.value })}
              />
            </div>
            <Button onClick={save}>Save SMS settings</Button>
            <div className="pt-4">
              <Label>Send test</Label>
              <div className="flex gap-2">
                <Input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="01XXXXXXXXX" />
                <Button variant="outline" onClick={test}>
                  Test
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>SMS log</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {logs.map((log) => (
              <div key={log.id} className="rounded-lg border border-line p-3">
                <div className="flex justify-between">
                  <span className="font-medium">{log.recipient}</span>
                  <Badge tone={log.status === "SENT" ? "ok" : "late"}>{log.status}</Badge>
                </div>
                <div className="text-muted">{log.message}</div>
                <div className="font-mono text-xs text-muted">{formatDateTime(log.createdAt)}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
