import "server-only";

import { isSimulationAllowed } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { MockAdapter } from "@/lib/devices/mock-adapter";
import { ingestAttendanceLog } from "@/lib/attendance/sync";
import { startOfZonedDay } from "@/lib/time";

function assertSim() {
  if (!isSimulationAllowed()) {
    throw new AppError("Simulation mode is disabled.", 403, "SIMULATION_DISABLED");
  }
}

export async function simulateScenario(input: {
  scenario: "check-in" | "check-out" | "late" | "duplicate" | "offline-sync" | "sms-failure";
  employeeId?: string;
}) {
  assertSim();
  const employee = input.employeeId
    ? await prisma.employee.findUnique({ where: { id: input.employeeId } })
    : await prisma.employee.findFirst({ where: { employeeCode: "EMP001" } });
  if (!employee) throw new AppError("Employee not found", 404);

  const device = await prisma.device.findFirst({ where: { adapterType: "mock" } });
  if (!device) throw new AppError("No mock device is configured.", 400);

  const adapter = new MockAdapter({ ipAddress: device.ipAddress, port: device.port });
  await adapter.connect();

  const now = new Date();
  const base = startOfZonedDay(now);
  const atHour = (h: number, m: number) => new Date(base.getTime() + (h * 60 + m) * 60000);

  if (input.scenario === "sms-failure") {
    const previous = process.env.SMS_PROVIDER;
    process.env.SMS_PROVIDER = "failing";
    const log = await adapter.pushLog({ deviceUserId: employee.deviceUserId, timestamp: atHour(9, 2) });
    const result = await ingestAttendanceLog({ device, log, source: "SIMULATION" });
    process.env.SMS_PROVIDER = previous;
    await adapter.disconnect();
    return { result, note: "Attendance is saved even if SMS fails." };
  }

  if (input.scenario === "offline-sync") {
    await adapter.pushLog({ deviceUserId: employee.deviceUserId, timestamp: atHour(8, 58) });
    await adapter.pushLog({ deviceUserId: "1002", timestamp: atHour(9, 18) });
    await adapter.disconnect();
    const { syncDeviceAttendance } = await import("@/lib/attendance/sync");
    const sync = await syncDeviceAttendance(device.id);
    return { sync, note: "Offline punches were stored on the mock device, then synchronized with deduplication." };
  }

  const timestamp =
    input.scenario === "late"
      ? atHour(9, 20)
      : input.scenario === "check-out"
        ? atHour(18, 2)
        : atHour(8, 55);

  const log = await adapter.pushLog({ deviceUserId: employee.deviceUserId, timestamp });
  const first = await ingestAttendanceLog({ device, log, source: "SIMULATION" });
  let duplicate = null;
  if (input.scenario === "duplicate") {
    duplicate = await ingestAttendanceLog({ device, log, source: "SIMULATION" });
  }
  await adapter.disconnect();
  return { first, duplicate };
}
