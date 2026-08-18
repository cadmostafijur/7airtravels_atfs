import { jsonOk } from "@/lib/http";

export async function GET() {
  return jsonOk({ service: "7airtravels-atfs", time: new Date().toISOString() });
}
