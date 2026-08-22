"use client";

import { use, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog, type ConfirmState } from "@/components/ui/confirm-dialog";
import { Input, Label } from "@/components/ui/field";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/time";
import { relativeTime } from "@/lib/utils";

type Device = {
  id: string;
  name: string;
  model: string;
  adapterType: string;
  ipAddress: string;
  port: number;
  location: string | null;
  status: string;
  lastSyncAt: string | null;
  lastConnectedAt: string | null;
  lastError: string | null;
  totalSynced: number;
  timeoutMs: number;
  commLogs: Array<{ id: string; action: string; success: boolean; message: string; createdAt: string }>;
  syncLogs: Array<{
    id: string;
    status: string;
    recordsRead: number;
    recordsInserted: number;
    recordsSkipped: number;
    recordsFailed: number;
    startedAt: string;
    errorMessage: string | null;
  }>;
};

type WebsitePunch = {
  id: string;
  when: string;
  deviceUserId: string;
  type: string;
  employee: string | null;
  employeeCode: string | null;
  mapped: boolean;
  source: string;
};

export default function DeviceDiagnosticPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [device, setDevice] = useState<Device | null>(null);
  const [ip, setIp] = useState("");
  const [port, setPort] = useState(4370);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [websitePunches, setWebsitePunches] = useState<WebsitePunch[]>([]);
  const [websiteTotal, setWebsiteTotal] = useState(0);

  async function loadPunches() {
    const data = await api<{ punches: WebsitePunch[]; totalOnWebsite: number }>(`/api/devices/${id}/punches`);
    setWebsitePunches(data.punches);
    setWebsiteTotal(data.totalOnWebsite);
  }

  async function load() {
    const data = await api<Device>(`/api/devices/${id}`);
    setDevice(data);
    setIp(data.ipAddress);
    setPort(data.port);
    await loadPunches().catch(() => {
      setWebsitePunches([]);
      setWebsiteTotal(0);
    });
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function saveNetwork() {
    await api(`/api/devices/${id}`, {
      method: "PUT",
      body: JSON.stringify({ ipAddress: ip, port }),
    });
    toast.success("Network settings saved");
    await load();
  }

  async function run(action: string, path: string, body?: unknown) {
    setBusy(action);
    try {
      const data = await api(path, {
        method: "POST",
        body: body ? JSON.stringify(body) : "{}",
      });
      setResult(data);
      if (action === "Sync now") {
        const sync = data as {
          recordsRead?: number;
          recordsInserted?: number;
          recordsSkipped?: number;
          status?: string;
        };
        toast.success(
          `Sync ${sync.status ?? "done"} · read ${sync.recordsRead ?? 0} · inserted ${sync.recordsInserted ?? 0} · skipped ${sync.recordsSkipped ?? 0}`,
        );
        if ((sync.recordsInserted ?? 0) === 0 && (sync.recordsSkipped ?? 0) > 0) {
          toast.message("Those punches were already on the website. Clear website punches to re-import.");
        }
      } else if (action === "Read punches") {
        const read = data as { count?: number };
        toast.success(`Device has ${read.count ?? 0} punch(es). Click Sync now to save them on the website.`);
      } else {
        toast.success(action);
      }
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : action;
      toast.error(message);
      setResult({ error: message });
      await load();
    } finally {
      setBusy(null);
    }
  }

  function askDelete() {
    if (!device) return;
    setConfirm({
      title: `Delete ${device.name}?`,
      description: "Removes this device and its website sync/punch logs. The physical K50A is not wiped.",
      confirmLabel: "Delete device",
      danger: true,
      onConfirm: async () => {
        try {
          await api(`/api/devices/${id}`, { method: "DELETE" });
          toast.success("Device deleted");
          router.push("/admin/devices");
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Failed");
        }
      },
    });
  }

  function askClearWebsite() {
    setConfirm({
      title: "Clear all website punches?",
      description:
        "Deletes every punch, daily register row, and SMS log on the website so you can Sync again. The K50A device itself is NOT cleared.",
      confirmLabel: "Clear website data",
      danger: true,
      onConfirm: async () => {
        try {
          const data = await api<{ deleted: { punches: number; summaries: number; smsLogs: number } }>(
            "/api/attendance/clear-website",
            { method: "POST", body: "{}" },
          );
          toast.success(
            `Cleared ${data.deleted.punches} punches · ${data.deleted.summaries} summaries · ${data.deleted.smsLogs} SMS logs`,
          );
          await load();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Clear failed");
        }
      },
    });
  }

  function askClearDevice() {
    setConfirm({
      title: "Clear punches ON the K50A device?",
      description:
        "This wipes attendance logs stored inside the physical fingerprint device. Website records stay until you also Clear website punches. This cannot be undone on the device.",
      confirmLabel: "Clear device logs",
      danger: true,
      onConfirm: async () => {
        try {
          await api(`/api/devices/${id}/clear`, {
            method: "POST",
            body: JSON.stringify({ confirm: "DELETE_DEVICE_ATTENDANCE" }),
          });
          toast.success("K50A device attendance logs cleared");
          setResult({ clearedOnDevice: true });
          await load();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Device clear failed");
        }
      },
    });
  }

  if (!device) return <p className="text-sm text-muted">Loading device…</p>;

  return (
    <div>
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
      <PageHeader
        eyebrow="Hardware diagnostic"
        title={device.name}
        description="Read punches = live list from K50A only. Sync now = save that list onto the website (attendance + SMS)."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={device.status === "ONLINE" ? "ok" : "muted"}>{device.status}</Badge>
            <Button variant="outline" size="sm" onClick={askClearWebsite}>
              Clear website punches
            </Button>
            <Button variant="danger" size="sm" onClick={askClearDevice}>
              Clear device punches
            </Button>
            <Button variant="danger" size="sm" onClick={askDelete}>
              Delete device
            </Button>
          </div>
        }
      />
      <Card className="mb-4 border-teal/30 bg-teal/5">
        <CardContent className="space-y-1 p-4 text-sm text-muted">
          <p>
            <strong className="text-ink">1. Read punches</strong> — see what is on the device (not saved yet).
          </p>
          <p>
            <strong className="text-ink">2. Sync now</strong> — import into Daily register / Dashboard / SMS.
          </p>
          <p>
            <strong className="text-ink">Clear website punches</strong> — wipe Neon DB only.
          </p>
          <p>
            <strong className="text-ink">Clear device punches</strong> — wipe logs inside the physical K50A (SUPER_ADMIN).
          </p>
        </CardContent>
      </Card>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle>Connection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>IP address</Label>
              <Input value={ip} onChange={(e) => setIp(e.target.value)} />
            </div>
            <div>
              <Label>TCP port</Label>
              <Input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} />
            </div>
            <Button variant="outline" onClick={() => void saveNetwork()}>
              Save IP / port
            </Button>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button disabled={!!busy} onClick={() => void run("Test connection", `/api/devices/${id}/test`)}>
                Test connection
              </Button>
              <Button variant="navy" disabled={!!busy} onClick={() => void run("Sync now", `/api/devices/${id}/sync`)}>
                Sync now
              </Button>
              <Button variant="outline" disabled={!!busy} onClick={() => void run("Device info", `/api/devices/${id}/info`)}>
                Get info
              </Button>
              <Button variant="outline" disabled={!!busy} onClick={() => void run("Read users", `/api/devices/${id}/users`)}>
                Read users
              </Button>
              <Button
                variant="outline"
                disabled={!!busy}
                onClick={() => void run("Read punches", `/api/devices/${id}/attendance`)}
              >
                Read punches
              </Button>
            </div>
            <p className="text-xs text-muted">
              Adapter: {device.adapterType}. Last connected {relativeTime(device.lastConnectedAt)}. Last sync{" "}
              {relativeTime(device.lastSyncAt)}.
            </p>
            {device.lastError ? <p className="text-xs text-signal">{device.lastError}</p> : null}
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Latest diagnostic result</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[420px] overflow-auto rounded-xl bg-navy p-4 font-mono text-xs text-teal-2">
              {JSON.stringify(result, null, 2) || "Run a test to see protocol output."}
            </pre>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle>Website punches from this device ({websiteTotal})</CardTitle>
          <Button size="sm" variant="outline" onClick={() => void loadPunches()}>
            Refresh list
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {websitePunches.length === 0 ? (
            <p className="p-5 text-sm text-muted">
              No punches saved on the website yet. Use <strong>Sync now</strong> after fingerprint (or after clearing).
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-paper text-left text-xs uppercase text-muted">
                <tr>
                  <th className="px-5 py-3">When</th>
                  <th className="px-5 py-3">K50A User ID</th>
                  <th className="px-5 py-3">Employee</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Mapped</th>
                </tr>
              </thead>
              <tbody>
                {websitePunches.map((row) => (
                  <tr key={row.id} className="border-t border-line">
                    <td className="px-5 py-3 font-mono text-xs">{row.when}</td>
                    <td className="px-5 py-3 font-mono">{row.deviceUserId}</td>
                    <td className="px-5 py-3">
                      {row.employee ? (
                        <>
                          <div className="font-medium">{row.employee}</div>
                          <div className="text-xs text-muted">{row.employeeCode}</div>
                        </>
                      ) : (
                        <span className="text-signal">Unmapped — set Employee K50A User ID</span>
                      )}
                    </td>
                    <td className="px-5 py-3">{row.type}</td>
                    <td className="px-5 py-3">
                      <Badge tone={row.mapped ? "ok" : "late"}>{row.mapped ? "Yes" : "No"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Communication log</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {device.commLogs.map((log) => (
              <div key={log.id} className="rounded-lg border border-line px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{log.action}</span>
                  <Badge tone={log.success ? "ok" : "late"}>{log.success ? "OK" : "ERROR"}</Badge>
                </div>
                <div className="text-muted">{log.message}</div>
                <div className="font-mono text-xs text-muted">{formatDateTime(log.createdAt)}</div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sync history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {device.syncLogs.map((log) => (
              <div key={log.id} className="rounded-lg border border-line px-3 py-2">
                <div className="flex justify-between">
                  <span>{log.status}</span>
                  <span className="font-mono text-xs">{formatDateTime(log.startedAt)}</span>
                </div>
                <div className="text-muted">
                  Read {log.recordsRead} · Inserted {log.recordsInserted} · Skipped {log.recordsSkipped} · Failed{" "}
                  {log.recordsFailed}
                </div>
                {log.errorMessage ? <div className="text-signal">{log.errorMessage}</div> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
