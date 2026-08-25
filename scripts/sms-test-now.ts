import { sendTestSms } from "../src/lib/sms/service";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const settings = await prisma.smsSetting.findUnique({ where: { id: "default" } });
  const phone = settings?.adminPhone1;
  if (!phone) {
    console.log(JSON.stringify({ ok: false, error: "no adminPhone1" }));
    return;
  }
  const result = await sendTestSms(phone);
  console.log(JSON.stringify({ phone, ...result }, null, 2));

  // Also retry one failed log if test works
  if (result.success) {
    const failed = await prisma.smsLog.findMany({
      where: { status: "FAILED", eventType: { not: "TEST" } },
      orderBy: { createdAt: "desc" },
      take: 3,
    });
    const { createSmsProvider } = await import("../src/lib/sms/provider");
    const provider = createSmsProvider();
    for (const log of failed) {
      const again = await provider.sendSms(log.recipient, log.message);
      await prisma.smsLog.update({
        where: { id: log.id },
        data: {
          status: again.success ? "SENT" : "FAILED",
          providerResponse: again.response,
          sentAt: again.success ? new Date() : log.sentAt,
          retryCount: { increment: 1 },
        },
      });
      console.log(JSON.stringify({ retried: log.recipient, ...again }));
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
