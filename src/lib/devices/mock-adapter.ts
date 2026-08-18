import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeviceError } from "@/lib/errors";
import type {
  DeviceAdapter,
  DeviceAttendanceLog,
  DeviceConnectionConfig,
  DeviceInfo,
  DeviceStatusSnapshot,
  DeviceUser,
} from "@/lib/devices/types";

type Store = {
  connected: boolean;
  users: DeviceUser[];
  logs: DeviceAttendanceLog[];
};

const storePath = path.join(process.cwd(), ".data", "mock-k50a.json");

async function loadStore(): Promise<Store> {
  try {
    const raw = await readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as Omit<Store, "logs"> & {
      logs: Array<Omit<DeviceAttendanceLog, "timestamp"> & { timestamp: string }>;
    };
    return {
      connected: false,
      users: parsed.users ?? [],
      logs: (parsed.logs ?? []).map((log) => ({ ...log, timestamp: new Date(log.timestamp) })),
    };
  } catch {
    return {
      connected: false,
      users: [
        { uid: 1001, userId: "1001", name: "Test Employee" },
        { uid: 1002, userId: "1002", name: "Rahim Ahmed" },
        { uid: 1003, userId: "1003", name: "Karim Hasan" },
      ],
      logs: [],
    };
  }
}

async function saveStore(store: Store) {
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(
    storePath,
    JSON.stringify(
      {
        users: store.users,
        logs: store.logs,
      },
      null,
      2,
    ),
    "utf8",
  );
}

export class MockAdapter implements DeviceAdapter {
  readonly name = "MockAdapter";
  readonly verificationStatus = "verified" as const;
  private store: Store | null = null;

  constructor(private readonly config: DeviceConnectionConfig) {}

  async connect(): Promise<void> {
    this.store = await loadStore();
    this.store.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.store) this.store.connected = false;
    this.store = null;
  }

  async getDeviceInfo(): Promise<DeviceInfo> {
    const store = this.requireConnected();
    return {
      model: "K50A-MOCK",
      firmware: "simulation",
      serialNumber: "SIM-K50A-001",
      userCount: store.users.length,
      logCount: store.logs.length,
      logCapacity: 100000,
      protocol: "mock",
      connected: store.connected,
      extra: {
        ipAddress: this.config.ipAddress,
        port: this.config.port,
        note: "Simulation adapter. Not a physical K50A connection.",
      },
    };
  }

  async getUsers(): Promise<DeviceUser[]> {
    return [...this.requireConnected().users];
  }

  async createUser(user: DeviceUser): Promise<void> {
    const store = this.requireConnected();
    store.users = store.users.filter((row) => row.userId !== user.userId);
    store.users.push(user);
    await saveStore(store);
  }

  async updateUser(user: DeviceUser): Promise<void> {
    await this.createUser(user);
  }

  async deleteUser(userId: string): Promise<void> {
    const store = this.requireConnected();
    store.users = store.users.filter((row) => row.userId !== userId);
    await saveStore(store);
  }

  async getAttendanceLogs(): Promise<DeviceAttendanceLog[]> {
    return [...this.requireConnected().logs];
  }

  async getDeviceStatus(): Promise<DeviceStatusSnapshot> {
    const store = this.store;
    return {
      reachable: true,
      connected: Boolean(store?.connected),
      protocol: "mock",
      message: store?.connected ? "Mock K50A connected (simulation)" : "Mock K50A idle",
      checkedAt: new Date(),
    };
  }

  async clearAttendanceLogs(): Promise<void> {
    const store = this.requireConnected();
    store.logs = [];
    await saveStore(store);
  }

  async pushLog(input: {
    deviceUserId: string;
    timestamp?: Date;
    verificationMethod?: DeviceAttendanceLog["verificationMethod"];
  }): Promise<DeviceAttendanceLog> {
    const store = this.store ?? (await loadStore());
    const log: DeviceAttendanceLog = {
      deviceUserId: input.deviceUserId,
      timestamp: input.timestamp ?? new Date(),
      verificationMethod: input.verificationMethod ?? "FINGERPRINT",
      attendanceType: "UNKNOWN",
      deviceTransactionId: null,
      raw: { simulated: true, deviceUserId: input.deviceUserId },
    };
    store.logs.push(log);
    await saveStore(store);
    this.store = { ...store, connected: true };
    return log;
  }

  private requireConnected(): Store {
    if (!this.store?.connected) {
      throw new DeviceError("Mock device is not connected.", "not_connected", 409);
    }
    return this.store;
  }
}
