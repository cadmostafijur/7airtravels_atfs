import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk, readJson, clientIp } from "@/lib/http";
import { requireApiSession } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/audit";

const schema = z.object({
  name: z.string().min(2),
  model: z.string().default("K50A"),
  adapterType: z.enum(["k50a", "mock"]).default("k50a"),
  ipAddress: z.string().min(7),
  port: z.number().int().min(1).max(65535),
  location: z.string().optional(),
  timeoutMs: z.number().int().min(1000).max(120000).optional(),
  commKey: z.number().int().optional(),
});

export async function GET(request: Request) {
  try {
    await requireApiSession(request, "devices");
    const devices = await prisma.device.findMany({ orderBy: { createdAt: "asc" } });
    return jsonOk(devices);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireApiSession(request, "devices");
    const body = schema.parse(await readJson(request));
    const device = await prisma.device.create({
      data: {
        ...body,
        timeoutMs: body.timeoutMs ?? 60000,
      },
    });
    await writeAudit({
      adminId: admin.id,
      action: "DEVICE_CREATE",
      entity: "Device",
      entityId: device.id,
      ipAddress: clientIp(request),
      metadata: { ipAddress: device.ipAddress, port: device.port },
    });
    return jsonOk(device, 201);
  } catch (error) {
    return jsonError(error);
  }
}
