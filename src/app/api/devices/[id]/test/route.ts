import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, clientIp } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { testDeviceConnection } from "@/lib/devices/diagnostics";
import { writeAudit } from "@/lib/audit";
import { AppError } from "@/lib/errors";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  try {
    const admin = await requireApiSession(request, "devices");
    const { id } = await context.params;
    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) throw new AppError("Device not found", 404);
    const result = await testDeviceConnection(device);
    await writeAudit({
      adminId: admin.id,
      action: "DEVICE_TEST",
      entity: "Device",
      entityId: id,
      ipAddress: clientIp(request),
      metadata: { connected: result.connected, message: result.message },
    });
    return jsonOk(result);
  } catch (error) {
    return jsonError(error);
  }
}
