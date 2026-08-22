import { admsPlain } from "@/lib/devices/adms";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Device polls for commands — return OK (no remote commands yet). */
export async function GET(request: Request) {
  const sn = new URL(request.url).searchParams.get("SN") || "";
  if (sn) {
    await prisma.device
      .updateMany({
        where: { serialNumber: sn },
        data: { lastConnectedAt: new Date(), status: "ONLINE" },
      })
      .catch(() => null);
  }
  return admsPlain("OK");
}
