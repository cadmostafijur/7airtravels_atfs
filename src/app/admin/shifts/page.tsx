"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";
import { api } from "@/lib/api";

type Shift = {
  id: string;
  name: string;
  officeStart: string;
  lateThreshold: string;
  officeEnd: string;
  halfDayAfter: string;
  overtimeAfter: string;
  weekendDays: number[];
  isDefault: boolean;
};

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);

  async function load() {
    setShifts(await api<Shift[]>("/api/shifts"));
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(shift: Shift) {
    try {
      await api(`/api/shifts/${shift.id}`, { method: "PUT", body: JSON.stringify(shift) });
      toast.success("Shift saved");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Rules"
        title="Shifts"
        description="Office start, late threshold and end time are configurable. They are never hardcoded into attendance processing."
      />
      <div className="grid gap-4">
        {shifts.map((shift) => (
          <Card key={shift.id}>
            <CardContent className="grid gap-3 p-5 md:grid-cols-3">
              <div className="md:col-span-3 font-semibold">
                {shift.name} {shift.isDefault ? "· default" : ""}
              </div>
              <div>
                <Label>Office start</Label>
                <Input
                  value={shift.officeStart}
                  onChange={(e) =>
                    setShifts((rows) =>
                      rows.map((row) => (row.id === shift.id ? { ...row, officeStart: e.target.value } : row)),
                    )
                  }
                />
              </div>
              <div>
                <Label>Late after</Label>
                <Input
                  value={shift.lateThreshold}
                  onChange={(e) =>
                    setShifts((rows) =>
                      rows.map((row) => (row.id === shift.id ? { ...row, lateThreshold: e.target.value } : row)),
                    )
                  }
                />
              </div>
              <div>
                <Label>Office end</Label>
                <Input
                  value={shift.officeEnd}
                  onChange={(e) =>
                    setShifts((rows) =>
                      rows.map((row) => (row.id === shift.id ? { ...row, officeEnd: e.target.value } : row)),
                    )
                  }
                />
              </div>
              <div className="md:col-span-3 text-xs text-muted">
                Weekend: {shift.weekendDays.map((d) => dayNames[d]).join(", ")}
              </div>
              <Button onClick={() => save(shift)}>Save rules</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
