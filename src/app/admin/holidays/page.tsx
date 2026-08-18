"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/time";

type Holiday = { id: string; date: string; name: string };

export default function HolidaysPage() {
  const [rows, setRows] = useState<Holiday[]>([]);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");

  async function load() {
    setRows(await api<Holiday[]>("/api/holidays"));
  }
  useEffect(() => {
    void load();
  }, []);

  async function add() {
    try {
      await api("/api/holidays", { method: "POST", body: JSON.stringify({ name, date }) });
      setName("");
      setDate("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Calendar" title="Holidays" />
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-5">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <Button onClick={add}>Add holiday</Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="divide-y divide-line p-0">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <span>{row.name}</span>
              <span className="font-mono text-muted">{formatDate(row.date)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
