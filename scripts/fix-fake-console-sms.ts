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
  const fields = {
    api_key: apiKey,
    type: "text",
    number: normalizeBdPhone(phone),
    senderid: senderId,
    message: flatten(message),
  };
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
  });
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
  const fake = await prisma.smsLog.updateMany({
    where: { providerResponse: { contains: "logged-to-console" } },
    data: { status: "FAILED" },
  });
  console.log("markedFailed", fake.count);

  const settings = await prisma.smsSetting.findUnique({ where: { id: "default" } });
  const phones = [settings?.adminPhone1, settings?.adminPhone2, settings?.adminPhone3]
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p))
    .map(normalizeBdPhone);

  const failed = await prisma.smsLog.findMany({
    where: {
      status: "FAILED",
      OR: [{ providerResponse: { contains: "logged-to-console" } }, { providerResponse: { contains: "1032" } }],
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  console.log("retrying", failed.length, "failed logs to", phones.length, "phones");

  for (const log of failed) {
    const result = await sendBulkSms(log.recipient, log.message);
    await prisma.smsLog.update({
      where: { id: log.id },
      data: {
        status: result.success ? "SENT" : "FAILED",
        providerResponse: result.response.slice(0, 2000),
        sentAt: result.success ? new Date() : null,
        retryCount: { increment: 1 },
      },
    });
    console.log(log.recipient.slice(-4), result.success ? "SENT" : "FAILED", result.code);
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
