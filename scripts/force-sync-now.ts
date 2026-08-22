/**
 * Pull K50A logs into Neon and send attendance SMS (standalone, no Next server-only).
 */
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";

const require = createRequire(import.meta.url);
const ZKLib = require("node-zklib");

const prisma = new PrismaClient();

function normalizeBdPhone(input: string): string {
  let digits = input.replace(/[^\d]/g, "");
  if (digits.startsWith("880") && digits.length >= 13) return digits.slice(0, 13);
  if (digits.startsWith("0") && digits.length >= 11) return `880${digits.slice(1)}`;
  if (digits.startsWith("1") && digits.length === 10) return `880${digits}`;
  return digits;
}

async function sendBulkSms(phone: string, message: string) {
  const apiKey = process.env.SMS_API_KEY || "";
  const senderId = process.env.SMS_SENDER_ID || "";
  const apiUrl = process.env.SMS_API_URL || "http://bulksmsbd.net/api/smsapi";
  const url = new URL(apiUrl);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("type", "text");
  url.searchParams.set("number", normalizeBdPhone(phone));
  url.searchParams.set("senderid", senderId);
  url.searchParams.set("message", message);
  const res = await fetch(url.toString());
  const text = await res.text();
  let code: number | null = null;
  try {
    code = Number((JSON.parse(text) as { response_code?: number }).response_code);
  } catch {
    code = null;
  }
  return { success: code === 202, response: text };
}

async function main() {
  const device = await prisma.device.findFirst({ where: { adapterType: "k50a" } });
  if (!device) throw new Error("No k50a device");

  const ip = device.ipAddress;
  const port = device.port;
  const timeout = Math.max(device.timeoutMs || 0, 60000);
  console.log("connecting", { ip, port, timeout });

  const zk = new ZKLib(ip, port, timeout, 4000);
  await zk.createSocket();
  const info = await zk.getInfo();
  console.log("info", info);
  const att = await zk.getAttendances();
  const rows = (att?.data ?? []) as Array<{ deviceUserId?: string; recordTime?: Date | string }>;
  console.log("deviceLogs", rows.length, rows);

  let inserted = 0;
  let skipped = 0;
  for (const row of rows) {
    const deviceUserId = String(row.deviceUserId ?? "");
    const timestamp = row.recordTime ? new Date(row.recordTime) : null;
    if (!deviceUserId || !timestamp || Number.isNaN(timestamp.getTime())) continue;

    const employee = await prisma.employee.findFirst({ where: { deviceUserId } });
    try {
      const created = await prisma.attendance.create({
        data: {
          employeeId: employee?.id,
          deviceId: device.id,
          deviceUserId,
          timestamp,
          attendanceType: "UNKNOWN",
          verificationMethod: "FINGERPRINT",
          source: "DEVICE",
          rawPayload: row as object,
        },
      });
      inserted += 1;

      if (employee) {
        const settings = await prisma.smsSetting.findUnique({ where: { id: "default" } });
        if (settings?.enabled && settings.notifyOnAttendance) {
          const phones = [settings.adminPhone1, settings.adminPhone2, settings.adminPhone3]
            .map((p) => p?.trim())
            .filter((p): p is string => Boolean(p))
            .map(normalizeBdPhone);
          const message = `Attendance Alert: ${employee.name} checked in at ${timestamp.toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })}.`;
          for (const recipient of phones) {
            const notificationKey = `${created.id}:ATTENDANCE:${recipient}`;
            const result = await sendBulkSms(recipient, message);
            await prisma.smsLog.upsert({
              where: { notificationKey },
              create: {
                notificationKey,
                recipient,
                message,
                eventType: "ATTENDANCE",
                status: result.success ? "SENT" : "FAILED",
                providerResponse: result.response,
                attendanceId: created.id,
                sentAt: result.success ? new Date() : null,
              },
              update: {
                status: result.success ? "SENT" : "FAILED",
                providerResponse: result.response,
                sentAt: result.success ? new Date() : undefined,
                retryCount: { increment: 1 },
              },
            });
            console.log("sms", recipient, result.success ? "SENT" : "FAILED", result.response.slice(0, 120));
          }
        }
      }
    } catch (error) {
      if (typeof error === "object" && error && "code" in error && (error as { code: string }).code === "P2002") {
        skipped += 1;
        continue;
      }
      throw error;
    }
  }

  await prisma.device.update({
    where: { id: device.id },
    data: {
      lastSyncAt: new Date(),
      totalSynced: { increment: inserted },
      status: "ONLINE",
      lastError: null,
      timeoutMs: timeout,
    },
  });

  await zk.disconnect();
  console.log({ inserted, skipped });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
