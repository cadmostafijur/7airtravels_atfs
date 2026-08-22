import { admsPlain, buildOptionsReply, ingestAdmsAttLogs } from "@/lib/devices/adms";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ZKTeco ADMS / iClock data channel.
 * GET  ?SN=&options=all  → server options (enable realtime push)
 * POST ?SN=&table=ATTLOG → attendance lines
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sn = searchParams.get("SN") || searchParams.get("sn") || "";
  const options = searchParams.get("options");

  if (sn) {
    await prisma.device
      .updateMany({
        where: { serialNumber: sn },
        data: { lastConnectedAt: new Date(), status: "ONLINE" },
      })
      .catch(() => null);
  }

  if (options === "all" || searchParams.has("options")) {
    return admsPlain(buildOptionsReply(sn || "UNKNOWN"));
  }

  return admsPlain("OK");
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const sn = searchParams.get("SN") || searchParams.get("sn") || "";
  const table = (searchParams.get("table") || "").toUpperCase();
  const body = await request.text();

  logger.info("adms_cdata_post", {
    sn,
    table,
    bytes: body.length,
    stamp: searchParams.get("Stamp"),
  });

  if (!sn) return admsPlain("OK");

  try {
    if (table === "ATTLOG") {
      await ingestAdmsAttLogs(sn, body);
      return admsPlain("OK");
    }

    // Heartbeat / options / operlog — acknowledge so device stays happy
    if (table === "OPERLOG" || table === "options" || table === "OPTIONS" || !table) {
      await prisma.device
        .updateMany({
          where: { serialNumber: sn },
          data: { lastConnectedAt: new Date(), status: "ONLINE" },
        })
        .catch(() => null);
      return admsPlain("OK");
    }

    return admsPlain("OK");
  } catch (error) {
    logger.error("adms_cdata_failed", {
      sn,
      table,
      error: error instanceof Error ? error.message : String(error),
    });
    // Still OK — avoid device retry storms for parse bugs
    return admsPlain("OK");
  }
}
