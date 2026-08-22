import { admsPlain } from "@/lib/devices/adms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return admsPlain("OK");
}

export async function GET() {
  return admsPlain("OK");
}
