export const APP_TZ =
  process.env.APP_TIMEZONE ?? process.env.NEXT_PUBLIC_APP_TIMEZONE ?? "Asia/Dhaka";

export function zonedParts(date: Date, timeZone = APP_TZ) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const map = Object.fromEntries(
    fmt.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: map.weekday,
  };
}

export function workDateKey(date: Date, timeZone = APP_TZ): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function workDateUtc(date: Date, timeZone = APP_TZ): Date {
  return new Date(`${workDateKey(date, timeZone)}T00:00:00.000Z`);
}

export function weekdayIndex(date: Date, timeZone = APP_TZ): number {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const short = zonedParts(date, timeZone).weekday?.slice(0, 3) ?? "Sun";
  const idx = names.indexOf(short);
  return idx === -1 ? 0 : idx;
}

export function parseHm(hm: string): number {
  const [h, m] = hm.split(":").map((v) => Number(v));
  return h * 60 + m;
}

export function minutesOfDay(date: Date, timeZone = APP_TZ): number {
  const p = zonedParts(date, timeZone);
  return p.hour * 60 + p.minute;
}

export function formatTime(date: Date | string | null | undefined, timeZone = APP_TZ): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date));
}

export function formatDate(date: Date | string | null | undefined, timeZone = APP_TZ): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string | null | undefined, timeZone = APP_TZ): string {
  if (!date) return "—";
  return `${formatDate(date, timeZone)} ${formatTime(date, timeZone)}`;
}

export function startOfZonedDay(date: Date, timeZone = APP_TZ): Date {
  const key = workDateKey(date, timeZone);
  let utc = new Date(`${key}T00:00:00.000Z`);
  const p = zonedParts(utc, timeZone);
  utc = new Date(utc.getTime() - (p.hour * 60 + p.minute) * 60000 - p.second * 1000);
  return utc;
}

export function endOfZonedDay(date: Date, timeZone = APP_TZ): Date {
  return new Date(startOfZonedDay(date, timeZone).getTime() + 24 * 60 * 60 * 1000 - 1);
}

export function addDaysKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}
