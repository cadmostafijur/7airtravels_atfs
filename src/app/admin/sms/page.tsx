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

type GatewayInfo = {
  provider: string;
  configured: boolean;
  senderId: string;
  method: string;
  outboundIp: string | null;
  lastBlockedIp: string | null;
  lastFailedResponse: string | null;
};

type Settings = {
  enabled: boolean;
  adminPhone1: string | null;
  adminPhone2: string | null;
  adminPhone3: string | null;
  notifyOnAttendance: boolean;
  notifyOnLate: boolean;
  gateway?: GatewayInfo;
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
  const [worker, setWorker] = useState<{ online: boolean; hint: string; syncIntervalMs: number } | null>(null);

  async function load() {
    const [s, l, w] = await Promise.all([
      api<Settings>("/api/sms/settings"),
      api<Log[]>("/api/sms/logs"),
      api<{ online: boolean; hint: string; syncIntervalMs: number }>("/api/worker/status").catch(() => null),
    ]);
    setSettings(s);
    setLogs(l);
    if (w) setWorker(w);
  }
  useEffect(() => {
    void load();
  }, []);

  async function save() {
    if (!settings) return;
    try {
      const { gateway: _gateway, ...payload } = settings;
      await api("/api/sms/settings", { method: "PUT", body: JSON.stringify(payload) });
      toast.success("SMS settings saved");
      await load();
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
      else toast.error(result.response?.slice(0, 220) || "Test SMS failed");
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

  async function retryFailed() {
    try {
      const result = await api<{ attempted: number; sent: number; stillFailed: number }>("/api/sms/retry-failed", {
        method: "POST",
        body: "{}",
      });
      if (result.sent > 0) toast.success(`Resent ${result.sent} SMS`);
      if (result.stillFailed > 0) {
        toast.error(`${result.stillFailed} still failed — whitelist IP on BulkSMSBD (code 1032)`);
      }
      if (result.attempted === 0) toast.message("No failed SMS to retry");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Retry failed");
    }
  }

  async function resendPunches() {
    try {
      const result = await api<{ punches: number; attempted: number; sent: number }>("/api/sms/resend-punches", {
        method: "POST",
        body: "{}",
      });
      if (result.attempted === 0) toast.message("No punches need SMS (already SENT or none found)");
      else toast.success(`SMS for ${result.attempted} punch(es) — check log for SENT/FAILED`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Resend failed");
    }
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

  const gateway = settings.gateway;
  const whitelistIp = gateway?.lastBlockedIp || gateway?.outboundIp || "119.15.155.70";

  return (
    <div>
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
      <PageHeader
        eyebrow="Alerts"
        title="Administrator SMS"
        description="After fingerprint sync, SMS is sent to these 3 numbers. BulkSMSBD must whitelist this PC’s public IP or every send will fail with 1032."
      />
      {worker && !worker.online ? (
        <Card className="mb-4 border-signal/40 bg-red-50/70">
          <CardContent className="space-y-2 p-4 text-sm">
            <p className="font-semibold text-signal">Worker is OFF — SMS will not send automatically after fingerprint</p>
            <p className="text-muted">
              Fingerprint alone does not send SMS. Keep this running on the office PC:
            </p>
            <pre className="rounded-lg bg-paper p-3 font-mono text-xs text-ink">npm run start:worker</pre>
            <p className="text-xs text-muted">{worker.hint}</p>
          </CardContent>
        </Card>
      ) : worker?.online ? (
        <Card className="mb-4 border-teal/30 bg-teal/5">
          <CardContent className="p-4 text-sm text-muted">
            Worker online — auto-sync about every {Math.round(worker.syncIntervalMs / 1000)}s, then SMS sends.
          </CardContent>
        </Card>
      ) : null}
      <Card className="mb-4 border-signal/30 bg-red-50/60">
        <CardContent className="space-y-2 p-4 text-sm">
          <p className="font-semibold text-signal">SMS not arriving? Do this first (required)</p>
          <ol className="list-decimal space-y-1 pl-5 text-muted">
            <li>
              Login to BulkSMSBD → <strong>Phone Book → IP White List</strong>
            </li>
            <li>
              Enable IP checking for type <strong>API</strong>, add IP:{" "}
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-ink">{whitelistIp}</code>
            </li>
            <li>
              Save → here click <strong>Test</strong> (must show SENT / 202) → then <strong>Retry failed</strong>
            </li>
            <li>
              Keep office worker running (<code>npm run start:worker</code>) so fingerprint sync can send SMS
            </li>
          </ol>
          <p className="text-xs text-muted">
            Outbound IP now: <code>{gateway?.outboundIp ?? "detecting…"}</code>
            {gateway?.lastBlockedIp ? (
              <>
                {" "}
                · Last blocked by gateway: <code>{gateway.lastBlockedIp}</code>
              </>
            ) : null}
            . ISP IP changes often — update whitelist when Test fails again.
          </p>
        </CardContent>
      </Card>
      <Card className="mb-4 border-teal/30 bg-teal/5">
        <CardContent className="space-y-2 p-4 text-sm text-muted">
          <p>
            Provider: <strong>{gateway?.provider ?? "bulksmsbd"}</strong>
            {gateway?.configured ? " · key configured" : " · missing API key"} · method{" "}
            <code>{gateway?.method ?? "POST"}</code> · success code <code>202</code>
          </p>
          <p className="font-medium text-ink">Attendance SMS format:</p>
          <pre className="overflow-x-auto rounded-lg bg-paper p-3 font-mono text-xs text-ink">
            {`7AIR ATFS | Mahin (EmP001) | Check-in: 03:58 pm, 22 Aug 2026 | Status: Present`}
          </pre>
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
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.notifyOnAttendance}
                onChange={(e) => setSettings({ ...settings, notifyOnAttendance: e.target.checked })}
              />
              Notify on every fingerprint punch
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.notifyOnLate}
                onChange={(e) => setSettings({ ...settings, notifyOnLate: e.target.checked })}
              />
              Also notify when status is Late
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
            <Button onClick={() => void save()}>Save SMS settings</Button>
            <div className="pt-4">
              <Label>Send test</Label>
              <div className="flex gap-2">
                <Input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="01XXXXXXXXX" />
                <Button variant="outline" onClick={() => void test()}>
                  Test
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle>SMS log</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => void resendPunches()}>
                Resend punch SMS
              </Button>
              {logs.some((l) => l.status === "FAILED") ? (
                <Button size="sm" variant="outline" onClick={() => void retryFailed()}>
                  Retry failed
                </Button>
              ) : null}
              {logs.length > 0 ? (
                <Button size="sm" variant="outline" onClick={() => askClearLogs()}>
                  Clear all
                </Button>
              ) : null}
            </div>
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
