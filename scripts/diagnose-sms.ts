/**
 * Diagnose why attendance SMS is not sending (read-only DB + config checks).
 * Run: npx tsx scripts/diagnose-sms.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function mask(phone: string | null | undefined) {
  if (!phone) return "(empty)";
  const d = phone.replace(/\D/g, "");
  if (d.length < 4) return "***";
  return `${"*".repeat(Math.max(0, d.length - 4))}${d.slice(-4)}`;
}

async function main() {
  const provider = process.env.SMS_PROVIDER ?? "console";
  const apiUrl = process.env.SMS_API_URL ?? "";
  const hasKey = Boolean(process.env.SMS_API_KEY?.trim());
  const sender = process.env.SMS_SENDER_ID ?? "";
  const method = (process.env.SMS_API_METHOD ?? "POST").toUpperCase();

  console.log("=== ENV ===");
  console.log({ provider, apiUrl, hasKey, sender, method });

  let outboundIp: string | null = null;
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    outboundIp = ((await res.json()) as { ip?: string }).ip ?? null;
  } catch {
    outboundIp = null;
  }
  console.log("outboundPublicIp:", outboundIp);

  const settings = await prisma.smsSetting.findUnique({ where: { id: "default" } });
  console.log("\n=== SMS SETTINGS (DB) ===");
  console.log({
    enabled: settings?.enabled ?? false,
    notifyOnAttendance: settings?.notifyOnAttendance ?? false,
    notifyOnLate: settings?.notifyOnLate ?? false,
    phone1: mask(settings?.adminPhone1),
    phone2: mask(settings?.adminPhone2),
    phone3: mask(settings?.adminPhone3),
  });

  const recentAttendance = await prisma.attendance.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { employee: { select: { name: true, employeeCode: true, deviceUserId: true } }, device: { select: { name: true } } },
  });
  console.log("\n=== RECENT PUNCHES ===");
  for (const row of recentAttendance) {
    console.log({
      at: row.timestamp.toISOString(),
      createdAt: row.createdAt.toISOString(),
      type: row.attendanceType,
      employee: row.employee?.name ?? `UNMAPPED uid=${row.deviceUserId}`,
      device: row.device.name,
      id: row.id,
    });
  }

  const recentSms = await prisma.smsLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  console.log("\n=== RECENT SMS LOGS ===");
  for (const row of recentSms) {
    console.log({
      status: row.status,
      eventType: row.eventType,
      to: mask(row.recipient),
      at: row.createdAt.toISOString(),
      attendanceId: row.attendanceId,
      response: (row.providerResponse ?? "").slice(0, 180),
      message: row.message.slice(0, 100),
    });
  }

  const failed1032 = recentSms.filter((r) => r.status === "FAILED" && (r.providerResponse ?? "").includes("1032"));
  const reasons: string[] = [];
  if (provider === "console") reasons.push("SMS_PROVIDER=console — messages only log to server, not real SMS");
  if (!hasKey || !apiUrl) reasons.push("SMS_API_URL or SMS_API_KEY missing in .env");
  if (!settings?.enabled) reasons.push("SMS disabled in Admin SMS settings");
  if (!settings?.notifyOnAttendance) reasons.push("notifyOnAttendance is OFF");
  if (!settings?.adminPhone1 && !settings?.adminPhone2 && !settings?.adminPhone3) {
    reasons.push("No admin phone numbers saved in SMS settings");
  }
  if (failed1032.length) {
    const ip = failed1032[0]?.providerResponse?.match(/ip\s+([0-9.]+)/i)?.[1] ?? outboundIp;
    reasons.push(`BulkSMSBD code 1032 — IP ${ip} not whitelisted in Phone Book`);
  }
  if (!recentAttendance.length) reasons.push("No punches in DB — fingerprint not synced yet (start worker / Sync now)");
  if (recentAttendance.length && !recentSms.some((s) => s.attendanceId && recentAttendance.some((a) => a.id === s.attendanceId))) {
    const newest = recentAttendance[0];
    const related = recentSms.filter((s) => s.attendanceId === newest?.id);
    if (!related.length && newest) {
      reasons.push(
        `Newest punch ${newest.id} has no SMS log — notify may have been skipped (disabled/no phones) or sync did not call SMS`,
      );
    }
  }

  console.log("\n=== DIAGNOSIS ===");
  if (!reasons.length) {
    console.log("Config looks OK. If phones still silent, whitelist IP and Retry failed / Test SMS.");
  } else {
    for (const r of reasons) console.log("-", r);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
