"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";

const scenarios = [
  { id: "check-in", title: "On-time check-in", body: "Fake fingerprint at 08:55 → PRESENT" },
  { id: "late", title: "Late arrival", body: "Fake fingerprint at 09:20 → LATE" },
  { id: "check-out", title: "Check-out", body: "Fake fingerprint at 18:02" },
  { id: "duplicate", title: "Duplicate punch", body: "Same transaction ingested twice — only one row stored" },
  { id: "offline-sync", title: "Offline catch-up", body: "Store punches on the mock device, then sync with dedupe" },
  { id: "sms-failure", title: "SMS failure", body: "Attendance still saves if the SMS gateway fails" },
] as const;

export default function SimulationPage() {
  const [out, setOut] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(scenario: (typeof scenarios)[number]["id"]) {
    setBusy(scenario);
    try {
      const data = await api("/api/simulation", {
        method: "POST",
        body: JSON.stringify({ scenario }),
      });
      setOut(data);
      toast.success("Simulation completed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Development"
        title="Simulation mode"
        description="This page is hidden unless SIMULATION_MODE=true. It cannot be used in production unless ALLOW_SIMULATION_IN_PRODUCTION=true."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {scenarios.map((item) => (
          <Card key={item.id}>
            <CardContent className="space-y-3 p-5">
              <h2 className="font-semibold">{item.title}</h2>
              <p className="text-sm text-muted">{item.body}</p>
              <Button disabled={!!busy} onClick={() => run(item.id)}>
                {busy === item.id ? "Running…" : "Run"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <pre className="mt-6 overflow-auto rounded-2xl bg-navy p-4 font-mono text-xs text-teal-2">
        {JSON.stringify(out, null, 2) || "Run a scenario to inspect the ingest result."}
      </pre>
    </div>
  );
}
