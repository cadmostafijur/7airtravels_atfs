"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog, type ConfirmState } from "@/components/ui/confirm-dialog";
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
  const [confirm, setConfirm] = useState<ConfirmState>(null);

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
      const result = await api<{ success: boolean; response?: string }>("/api/sms/test", {
        method: "POST",
        body: JSON.stringify({ phone: testPhone }),
      });
      if (result.success) toast.success("Test SMS sent (code 202)");
      else toast.error(result.response?.slice(0, 180) || "Test SMS failed");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    }
  }

  function askDeleteLog(id: string) {
    setConfirm({
      title: "Delete SMS log?",
      description: "This removes the log entry from the admin console. It does not recall an SMS already delivered.",
      confirmLabel: "Delete",
      danger: true,
      onConfirm: async () => {
        try {
          await api(`/api/sms/logs/${id}`, { method: "DELETE" });
          toast.success("SMS log deleted");
          await load();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Failed");
        }
      },
    });
  }

  function askClearLogs() {
    setConfirm({
      title: "Clear all SMS logs?",
      description: "This permanently deletes every SMS log entry. This cannot be undone.",
      confirmLabel: "Clear all",
      danger: true,
      onConfirm: async () => {
        try {
          const result = await api<{ deletedCount: number }>("/api/sms/logs", { method: "DELETE" });
          toast.success(`Deleted ${result.deletedCount} SMS log(s)`);
          await load();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Failed");
        }
      },
    });
  }

  if (!settings) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div>
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
      <PageHeader
        eyebrow="Alerts"
        title="Administrator SMS"
        description="BulkSMSBD gateway. Enable SMS, set 3 admin numbers (017… or 88017…), then Test. Attendance SMS never blocks saving punches."
      />
      <Card className="mb-4 border-teal/30 bg-teal/5">
        <CardContent className="space-y-2 p-4 text-sm text-muted">
          <p>
            Provider: <strong>BulkSMSBD</strong> · Sender ID from env · Success code <code>202</code>.
          </p>
          <p>
            If test fails with code <strong>1032</strong>, whitelist your PC/server IP in BulkSMSBD → Phone Book / IP
            whitelist, then try again. For Vercel, whitelist Vercel egress IPs or run SMS from the office Worker.
          </p>
        </CardContent>
      </Card>
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
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle>SMS log</CardTitle>
            {logs.length > 0 ? (
              <Button size="sm" variant="outline" onClick={() => askClearLogs()}>
                Clear all
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {logs.length === 0 ? <p className="text-muted">No SMS logs yet.</p> : null}
            {logs.map((log) => (
              <div key={log.id} className="rounded-lg border border-line p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{log.recipient}</span>
                  <div className="flex items-center gap-2">
                    <Badge tone={log.status === "SENT" ? "ok" : "late"}>{log.status}</Badge>
                    <Button size="sm" variant="outline" onClick={() => askDeleteLog(log.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
                <div className="text-muted">{log.message}</div>
                {log.providerResponse ? (
                  <div className="mt-1 break-all font-mono text-xs text-signal">{log.providerResponse}</div>
                ) : null}
                <div className="font-mono text-xs text-muted">{formatDateTime(log.createdAt)}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
