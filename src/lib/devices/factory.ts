import "server-only";

import { isSimulationAllowed } from "@/lib/env";
import { K50AAdapter } from "@/lib/devices/k50a-adapter";
import { MockAdapter } from "@/lib/devices/mock-adapter";
import type { DeviceAdapter, DeviceConnectionConfig } from "@/lib/devices/types";

export function createDeviceAdapter(
  adapterType: "k50a" | "mock",
  config: DeviceConnectionConfig,
): DeviceAdapter {
  if (adapterType === "mock") {
    if (!isSimulationAllowed()) {
      throw new Error("Mock adapter is disabled. Enable SIMULATION_MODE only in a controlled environment.");
    }
    return new MockAdapter(config);
  }
  return new K50AAdapter(config);
}
