import { jsonError, jsonOk } from "@/lib/http";
import { getSessionAdmin } from "@/lib/auth/guards";
import { isSimulationAllowed } from "@/lib/env";
import { AuthError } from "@/lib/errors";

export async function GET() {
  try {
    const admin = await getSessionAdmin();
    if (!admin) throw new AuthError();
    return jsonOk({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      simulation: isSimulationAllowed(),
    });
  } catch (error) {
    return jsonError(error);
  }
}
