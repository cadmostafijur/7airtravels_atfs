import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, readJson, clientIp } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { withDevice } from "@/lib/devices/diagnostics";
import { writeAudit } from "@/lib/audit";
import { AppError } from "@/lib/errors";

const schema = z.object({ confirm: z.literal("DELETE_DEVICE_ATTENDANCE") });
type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  try {
    const admin = await requireApiSession(request, "devices.destructive");
    const { id } = await context.params;
    schema.parse(await readJson(request));
    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) throw new AppError("Device not found", 404);
    await withDevice(device, (adapter) => adapter.clearAttendanceLogs());
    await writeAudit({
      adminId: admin.id,
      action: "DEVICE_CLEAR_ATTENDANCE",
      entity: "Device",
      entityId: id,
      ipAddress: clientIp(request),
    });
    return jsonOk({ cleared: true });
  } catch (error) {
    return jsonError(error);
  }
}
