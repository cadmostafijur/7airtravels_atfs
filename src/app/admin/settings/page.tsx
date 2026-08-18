"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";
import { api } from "@/lib/api";

type Settings = { name: string; email: string; role: string; timezone: string };

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    api<Settings>("/api/settings").then((data) => {
      setSettings(data);
      setName(data.name);
    });
  }, []);

  async function save() {
    try {
      await api("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          name,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
        }),
      });
      toast.success("Settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Workspace" title="Settings" />
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Administrator profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted">
            {settings?.email} · {settings?.role} · {settings?.timezone}
          </div>
          <div>
            <Label>Display name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Current password</Label>
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div>
            <Label>New password</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <Button onClick={save}>Save</Button>
        </CardContent>
      </Card>
    </div>
  );
}
