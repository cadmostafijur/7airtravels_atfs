import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, clientIp } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { syncDeviceAttendance } from "@/lib/attendance/sync";
import { writeAudit } from "@/lib/audit";
import { AppError } from "@/lib/errors";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  try {
    const admin = await requireApiSession(request, "devices.sync");
    const { id } = await context.params;
    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) throw new AppError("Device not found", 404);
    const result = await syncDeviceAttendance(id);
    await writeAudit({
      adminId: admin.id,
      action: "DEVICE_SYNC",
      entity: "Device",
      entityId: id,
      ipAddress: clientIp(request),
      metadata: result,
    });
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
