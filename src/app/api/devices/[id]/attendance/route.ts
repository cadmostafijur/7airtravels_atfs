import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { readDeviceAttendance } from "@/lib/devices/diagnostics";
import { AppError } from "@/lib/errors";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  try {
    await requireApiSession(request, "devices");
    const { id } = await context.params;
    const device = await prisma.device.findUnique({ where: { id } });
    if (!device) throw new AppError("Device not found", 404);
    const logs = await readDeviceAttendance(device);
    const latest = [...logs].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0] ?? null;
    return jsonOk({
      count: logs.length,
      latest,
      logs: logs.slice(-50).reverse(),
    });
  } catch (error) {
    return jsonError(error);
  }
}
