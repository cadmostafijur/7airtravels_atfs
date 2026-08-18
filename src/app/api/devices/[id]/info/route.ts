import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { readDeviceInfo } from "@/lib/devices/diagnostics";
import { AppError } from "@/lib/errors";

type Ctx = { params: Promise<{ id: string }> };

async function device(id: string) {
  const row = await prisma.device.findUnique({ where: { id } });
  if (!row) throw new AppError("Device not found", 404);
  return row;
}

export async function POST(request: Request, context: Ctx) {
  try {
    await requireApiSession(request, "devices");
    const { id } = await context.params;
    const info = await readDeviceInfo(await device(id));
    return jsonOk(info);
  } catch (error) {
    return jsonError(error);
  }
}
