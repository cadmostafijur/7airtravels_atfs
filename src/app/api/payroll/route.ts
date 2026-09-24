import { z } from "zod";
import { jsonError, jsonOk, readJson, clientIp } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { buildMonthlyPayroll, currentPayrollMonth } from "@/lib/payroll";

const settingsSchema = z.object({
  latePenalty: z.coerce.number().int().min(0).max(20_000_000),
  absentPenalty: z.coerce.number().int().min(0).max(20_000_000),
});

export async function GET(request: Request) {
  try {
    await requireApiSession(request, "payroll");
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month") || currentPayrollMonth();
    return jsonOk(await buildMonthlyPayroll(month));
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const admin = await requireApiSession(request, "payroll");
    const body = settingsSchema.parse(await readJson(request));
    const settings = await prisma.payrollSetting.upsert({
      where: { id: "default" },
      create: { id: "default", latePenalty: body.latePenalty, absentPenalty: body.absentPenalty },
      update: { latePenalty: body.latePenalty, absentPenalty: body.absentPenalty },
    });
    await writeAudit({
      adminId: admin.id,
      action: "PAYROLL_SETTINGS_UPDATE",
      entity: "PayrollSetting",
      entityId: "default",
      ipAddress: clientIp(request),
      metadata: body,
    });
    return jsonOk(settings);
  } catch (error) {
    return jsonError(error);
  }
}
