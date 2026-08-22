/**
 * Resend attendance SMS for recent punches that have no SENT log.
 * Run: npx tsx scripts/resend-attendance-sms.ts
 */
import { PrismaClient } from "@prisma/client";
import { normalizeBdPhone } from "../src/lib/sms/phone";
import { formatDate, formatTime } from "../src/lib/time";

const prisma = new PrismaClient();

function flatten(message: string) {
  return message
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" | ");
}

async function sendBulkSms(phone: string, message: string) {
  const apiKey = process.env.SMS_API_KEY || "";
  const senderId = process.env.SMS_SENDER_ID || "";
  const apiUrl = process.env.SMS_API_URL || "http://bulksmsbd.net/api/smsapi";
  const method = (process.env.SMS_API_METHOD || "POST").toUpperCase();
  const fields = {
    api_key: apiKey,
    type: process.env.SMS_TYPE || "text",
    number: normalizeBdPhone(phone),
    senderid: senderId,
    message: flatten(message),
  };

  let response: Response;
  if (method === "GET") {
    const url = new URL(apiUrl);
    for (const [k, v] of Object.entries(fields)) url.searchParams.set(k, v);
    response = await fetch(url.toString());
  } else {
    response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields),
    });
  }
  const text = await response.text();
  let code: number | null = null;
  try {
    code = Number((JSON.parse(text) as { response_code?: number }).response_code);
  } catch {
    code = null;
  }
  return { success: code === 202, response: text, code };
}

async function main() {
  const settings = await prisma.smsSetting.findUnique({ where: { id: "default" } });
  if (!settings?.enabled) {
    console.error("SMS disabled in settings");
    process.exit(1);
  }
  const phones = [settings.adminPhone1, settings.adminPhone2, settings.adminPhone3]
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p))
    .map(normalizeBdPhone);
  if (!phones.length) {
    console.error("No admin phones");
    process.exit(1);
  }

  const punches = await prisma.attendance.findMany({
    where: { employeeId: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      employee: true,
      smsLogs: { where: { status: "SENT" }, select: { id: true } },
    },
  });

  const pending = punches.filter((p) => p.smsLogs.length === 0);
  console.log(`Found ${pending.length} punch(es) without SENT SMS (of last ${punches.length})`);

  for (const punch of pending) {
    const employee = punch.employee!;
    const summary = await prisma.dailyAttendanceSummary.findFirst({
      where: { employeeId: employee.id },
      orderBy: { workDate: "desc" },
    });
    const isOut = punch.attendanceType === "CHECK_OUT";
    const action = isOut ? "Check-out" : summary?.status === "LATE" ? "Late check-in" : "Check-in";
    const status = summary?.status ?? "PRESENT";
    const message = `7AIR ATFS | ${employee.name.trim()} (${employee.employeeCode}) | ${action}: ${formatTime(punch.timestamp)}, ${formatDate(punch.timestamp)} | Status: ${status}`;
    const eventType = isOut ? "CHECK_OUT" : status === "LATE" ? "LATE_CHECKIN" : "ATTENDANCE";

    console.log("\nPunch", punch.id, employee.name, punch.timestamp.toISOString());

    for (const recipient of phones) {
      const notificationKey = `${punch.id}:${eventType}:${recipient}`;
      const result = await sendBulkSms(recipient, message);
      await prisma.smsLog.upsert({
        where: { notificationKey },
        create: {
          notificationKey,
          recipient,
          message,
          eventType,
          status: result.success ? "SENT" : "FAILED",
          providerResponse: result.response.slice(0, 2000),
          attendanceId: punch.id,
          sentAt: result.success ? new Date() : null,
        },
        update: {
          status: result.success ? "SENT" : "FAILED",
          providerResponse: result.response.slice(0, 2000),
          sentAt: result.success ? new Date() : null,
          retryCount: { increment: 1 },
          message,
        },
      });
      console.log(" ", recipient.slice(-4), result.success ? "SENT" : "FAILED", result.code, result.response.slice(0, 120));
    }
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
