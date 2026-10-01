import { z } from "zod";
import { jsonError, jsonOk, readJson, clientIp } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { updatePayrollRecord } from "@/lib/payroll";

const schema = z.object({
  absentFine: z.coerce.number().int().min(0).max(20_000_000).optional(),
  monthlySalary: z.coerce.number().int().min(0).max(20_000_000).optional(),
  note: z.string().max(500).nullable().optional(),
  useCalculatedFine: z.boolean().optional(),
  status: z.enum(["DRAFT", "PAID"]).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Ctx) {
  try {
    const admin = await requireApiSession(request, "payroll");
    const { id } = await context.params;
    const body = schema.parse(await readJson(request));
    const saved = await updatePayrollRecord(id, body);
    if (!saved) throw new AppError("Payroll record not found", 404);
    await writeAudit({
      adminId: admin.id,
      action: body.status === "PAID" ? "PAYROLL_MARK_PAID" : body.status === "DRAFT" ? "PAYROLL_MARK_UNPAID" : "PAYROLL_RECORD_UPDATE",
      entity: "PayrollRecord",
      entityId: id,
      ipAddress: clientIp(request),
      metadata: body,
    });
    return jsonOk(saved);
  } catch (error) {
    return jsonError(error);
  }
}
