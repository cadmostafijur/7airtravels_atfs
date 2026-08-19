export function formatHours(minutes: number | null | undefined): string {
  const value = Math.max(0, Number(minutes ?? 0));
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  return `${hours}h ${String(mins).padStart(2, "0")}m`;
}

export function isoWeekKey(date: Date | string): string {
  const d = new Date(date);
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function monthKey(date: Date | string): string {
  const d = new Date(date);
  return d.toISOString().slice(0, 7);
}
