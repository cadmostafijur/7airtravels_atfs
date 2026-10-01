"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";
import { api } from "@/lib/api";

type Holiday = { id: string; date: string; name: string };
type Shift = { isDefault: boolean; weekendDays: number[] };

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit" }).format(date);
}

function dateKey(value: string) {
  return value.slice(0, 10);
}

function daysInMonth(month: string) {
  const [year, mon] = month.split("-").map(Number);
  const count = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(year, mon - 1, 1)).getUTCDay();
  return { year, mon, count, firstWeekday };
}

export default function HolidaysPage() {
  const [rows, setRows] = useState<Holiday[]>([]);
  const [weekendDays, setWeekendDays] = useState<number[]>([5]);
  const [month, setMonth] = useState(monthKey);
  const [name, setName] = useState("Holiday");
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const [holidays, shifts] = await Promise.all([api<Holiday[]>("/api/holidays"), api<Shift[]>("/api/shifts")]);
    setRows(holidays);
    const office = shifts.find((shift) => shift.isDefault) ?? shifts[0];
    if (office) setWeekendDays(office.weekendDays);
  }

  useEffect(() => {
    void load().catch((error) => toast.error(error instanceof Error ? error.message : "Failed to load holidays"));
  }, []);

  const byDate = useMemo(() => {
    const map = new Map<string, Holiday>();
    for (const row of rows) map.set(dateKey(row.date), row);
    return map;
  }, [rows]);

  const grid = useMemo(() => {
    const { count, firstWeekday } = daysInMonth(month);
    const cells: Array<{ key: string; day: number } | null> = Array.from({ length: firstWeekday }, () => null);
    for (let day = 1; day <= count; day += 1) {
      cells.push({ key: `${month}-${String(day).padStart(2, "0")}`, day });
    }
    return cells;
  }, [month]);

  async function toggle(key: string, weekday: number) {
    if (weekendDays.includes(weekday)) return;
    const existing = byDate.get(key);
    setBusy(key);
    try {
      if (existing) {
        await api(`/api/holidays/${existing.id}`, { method: "DELETE" });
        toast.success("Holiday removed");
      } else {
        const label = name.trim() || "Holiday";
        await api("/api/holidays", { method: "POST", body: JSON.stringify({ name: label, date: key }) });
        toast.success("Holiday marked");
      }
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Calendar"
        title="Holidays"
        description="Friday is already a closed day from the shift. Click any other open day to mark or clear a holiday. Closed days are not working days in the salary fine."
      />
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-5">
          <div>
            <Label>Month</Label>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div>
            <Label>Holiday name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Holiday" />
          </div>
          <p className="text-xs text-muted">
            Closed every week: {weekendDays.map((day) => dayNames[day]).join(", ") || "none"}. Change that on Shifts.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase text-muted">
            {dayNames.map((name) => (
              <div key={name}>{name}</div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-2">
            {grid.map((cell, index) => {
              if (!cell) return <div key={`empty-${index}`} />;
              const weekday = new Date(`${cell.key}T00:00:00.000Z`).getUTCDay();
              const weekend = weekendDays.includes(weekday);
              const holiday = byDate.get(cell.key);
              return (
                <button
                  key={cell.key}
                  type="button"
                  disabled={weekend || busy === cell.key}
                  onClick={() => void toggle(cell.key, weekday)}
                  className={`min-h-16 rounded-xl border px-2 py-2 text-left text-sm ${
                    weekend
                      ? "cursor-default border-line bg-paper text-muted"
                      : holiday
                        ? "border-teal bg-teal text-white"
                        : "border-line bg-white hover:border-teal"
                  }`}
                >
                  <div className="font-semibold">{cell.day}</div>
                  <div className="text-[11px] leading-tight">{weekend ? "Closed" : holiday ? holiday.name : "Open"}</div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
