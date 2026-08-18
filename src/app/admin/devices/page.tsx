"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/field";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/utils";

type Device = {
  id: string;
  name: string;
  model: string;
  adapterType: "k50a" | "mock";
  ipAddress: string;
  port: number;
  location: string | null;
  status: string;
  lastSyncAt: string | null;
  lastConnectedAt: string | null;
  totalSynced: number;
};

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [form, setForm] = useState({
    name: "K50A-002",
    adapterType: "k50a" as "k50a" | "mock",
    ipAddress: "192.168.1.201",
    port: 4370,
    location: "Main Office",
  });

  async function load() {
    setDevices(await api<Device[]>("/api/devices"));
  }

  useEffect(() => {
    void load();
  }, []);

  async function createDevice() {
    try {
      await api("/api/devices", { method: "POST", body: JSON.stringify({ ...form, model: "K50A" }) });
      toast.success("Device added");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Hardware"
        title="K50A devices"
        description="Configure LAN IP and TCP port. Never expose the terminal to the public internet — use VPN if remote access is required."
      />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-paper text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-3">Device</th>
                  <th className="px-5 py-3">Network</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Last sync</th>
                  <th className="px-5 py-3">Synced</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => (
                  <tr key={device.id} className="border-t border-line">
                    <td className="px-5 py-4">
                      <Link href={`/admin/devices/${device.id}`} className="font-semibold text-teal hover:underline">
                        {device.name}
                      </Link>
                      <div className="text-xs text-muted">
                        {device.model} · {device.adapterType}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono">
                      {device.ipAddress}:{device.port}
                      <div className="text-xs text-muted">{device.location}</div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone={device.status === "ONLINE" ? "ok" : "muted"}>{device.status}</Badge>
                    </td>
                    <td className="px-5 py-4">{relativeTime(device.lastSyncAt)}</td>
                    <td className="px-5 py-4 font-mono">{device.totalSynced.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-5">
            <h2 className="font-semibold">Add device</h2>
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Adapter</Label>
              <Select
                value={form.adapterType}
                onChange={(e) => setForm({ ...form, adapterType: e.target.value as "k50a" | "mock" })}
              >
                <option value="k50a">K50A (node-zklib, unverified on hardware)</option>
                <option value="mock">Mock (simulation only)</option>
              </Select>
            </div>
            <div>
              <Label>IP address</Label>
              <Input value={form.ipAddress} onChange={(e) => setForm({ ...form, ipAddress: e.target.value })} />
            </div>
            <div>
              <Label>TCP port</Label>
              <Input
                type="number"
                value={form.port}
                onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Location</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <Button onClick={createDevice}>Save device</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
