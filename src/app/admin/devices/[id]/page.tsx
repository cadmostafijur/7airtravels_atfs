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

export default function DeviceDiagnosticPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [device, setDevice] = useState<Device | null>(null);
  const [ip, setIp] = useState("");
  const [port, setPort] = useState(4370);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  async function load() {
    const data = await api<Device>(`/api/devices/${id}`);
    setDevice(data);
    setIp(data.ipAddress);
    setPort(data.port);
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
      toast.success(action);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : action);
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

  if (!device) return <p className="text-sm text-muted">Loading device…</p>;

  return (
    <div>
      <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
      <PageHeader
        eyebrow="Hardware diagnostic"
        title={device.name}
        description="Phase 1 connectivity test: TCP probe first, then ZK protocol handshake. The K50A adapter is isolated and replaceable."
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={device.status === "ONLINE" ? "ok" : "muted"}>{device.status}</Badge>
            <Button variant="danger" size="sm" onClick={askDelete}>
              Delete device
            </Button>
          </div>
        }
      />
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
            <Button variant="outline" onClick={saveNetwork}>
              Save IP / port
            </Button>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button disabled={!!busy} onClick={() => run("Test connection", `/api/devices/${id}/test`)}>
                Test connection
              </Button>
              <Button variant="navy" disabled={!!busy} onClick={() => run("Sync now", `/api/devices/${id}/sync`)}>
                Sync now
              </Button>
              <Button variant="outline" disabled={!!busy} onClick={() => run("Device info", `/api/devices/${id}/info`)}>
                Get info
              </Button>
              <Button variant="outline" disabled={!!busy} onClick={() => run("Read users", `/api/devices/${id}/users`)}>
                Read users
              </Button>
              <Button
                variant="outline"
                disabled={!!busy}
                onClick={() => run("Read punches", `/api/devices/${id}/attendance`)}
              >
                Read transactions
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
