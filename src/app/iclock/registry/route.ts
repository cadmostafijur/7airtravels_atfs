import { admsPlain } from "@/lib/devices/adms";
import { resolveDeviceBySerial } from "@/lib/devices/adms";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sn = new URL(request.url).searchParams.get("SN") || "";
  if (sn) await resolveDeviceBySerial(sn).catch(() => null);
  return admsPlain("OK");
}

export async function POST(request: Request) {
  const sn = new URL(request.url).searchParams.get("SN") || "";
  const body = await request.text();
  logger.info("adms_registry", { sn, bytes: body.length });
  if (sn) await resolveDeviceBySerial(sn).catch(() => null);
  return admsPlain("OK");
}
