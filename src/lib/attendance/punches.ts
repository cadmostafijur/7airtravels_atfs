import "server-only";

import type { Attendance, DailyAttendanceSummary } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { APP_TZ, formatTime, workDateKey } from "@/lib/time";
import { summarizeDayPunches } from "@/lib/attendance/process";

export type PunchPairView = {
  inAt: string;
  outAt: string | null;
  inLabel: string;
  outLabel: string;
};

export type PunchBundle = {
  punchCount: number;
  pairs: PunchPairView[];
  /** Compact: "03:57 pm→03:58 pm · 04:10 pm→…" */
  pairsLabel: string;
  /** All In times */
  inTimes: string[];
  /** All Out times */
  outTimes: string[];
};

export function punchesToBundle(timestamps: Date[], timeZone = APP_TZ): PunchBundle {
  const { pairs, punchCount } = summarizeDayPunches(timestamps);
  const views: PunchPairView[] = pairs.map((pair) => ({
    inAt: pair.inAt.toISOString(),
    outAt: pair.outAt?.toISOString() ?? null,
    inLabel: formatTime(pair.inAt, timeZone),
    outLabel: pair.outAt ? formatTime(pair.outAt, timeZone) : "—",
  }));
  const pairsLabel = views
    .map((pair) => (pair.outAt ? `${pair.inLabel}→${pair.outLabel}` : `${pair.inLabel}→—`))
    .join(" · ");
  return {
    punchCount,
    pairs: views,
    pairsLabel: pairsLabel || "—",
    inTimes: views.map((p) => p.inLabel),
    outTimes: views.map((p) => p.outLabel),
  };
}

export async function loadPunchBundlesForSummaries(
  summaries: Array<Pick<DailyAttendanceSummary, "employeeId" | "workDate">>,
  timeZone = APP_TZ,
): Promise<Map<string, PunchBundle>> {
  const map = new Map<string, PunchBundle>();
  if (!summaries.length) return map;

  const employeeIds = [...new Set(summaries.map((row) => row.employeeId))];
  const dates = summaries.map((row) => row.workDate.getTime());
  const min = Math.min(...dates);
  const max = Math.max(...dates);
  const from = new Date(min - 12 * 60 * 60 * 1000);
  const to = new Date(max + 36 * 60 * 60 * 1000);

  const rows = await prisma.attendance.findMany({
    where: {
      employeeId: { in: employeeIds },
      timestamp: { gte: from, lt: to },
    },
    orderBy: { timestamp: "asc" },
    select: { employeeId: true, timestamp: true },
  });

  const grouped = new Map<string, Date[]>();
  for (const row of rows) {
    if (!row.employeeId) continue;
    const key = `${row.employeeId}:${workDateKey(row.timestamp, timeZone)}`;
    const list = grouped.get(key) ?? [];
    list.push(row.timestamp);
    grouped.set(key, list);
  }

  for (const summary of summaries) {
    const dateKey = workDateKey(summary.workDate, timeZone);
    // workDate is stored as UTC midnight date — workDateKey may still work
    const key = `${summary.employeeId}:${dateKey}`;
    const stamps = grouped.get(key) ?? [];
    map.set(`${summary.employeeId}:${summary.workDate.toISOString().slice(0, 10)}`, punchesToBundle(stamps, timeZone));
  }

  return map;
}

export function summaryPunchKey(employeeId: string, workDate: Date | string) {
  const iso = typeof workDate === "string" ? workDate : workDate.toISOString();
  return `${employeeId}:${iso.slice(0, 10)}`;
}

/** Used when attaching raw Attendance rows already loaded for one employee. */
export function bundleFromAttendanceRows(rows: Array<Pick<Attendance, "timestamp">>, timeZone = APP_TZ) {
  return punchesToBundle(
    rows.map((row) => row.timestamp),
    timeZone,
  );
}
