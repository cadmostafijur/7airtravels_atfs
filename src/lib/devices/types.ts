export type DeviceConnectionConfig = {
  ipAddress: string;
  port: number;
  timeoutMs?: number;
  commKey?: number;
};

export type DeviceInfo = {
  model: string;
  firmware?: string;
  serialNumber?: string | null;
  userCount?: number;
  logCount?: number;
  logCapacity?: number;
  protocol?: string;
  connected: boolean;
  extra?: Record<string, unknown>;
};

export type DeviceUser = {
  uid: number | string;
  userId: string;
  name: string;
  role?: number | string;
  cardno?: string | number;
};

export type DeviceAttendanceLog = {
  deviceUserId: string;
  timestamp: Date;
  verificationMethod: "FINGERPRINT" | "PASSWORD" | "CARD" | "FACE" | "OTHER";
  attendanceType?: "CHECK_IN" | "CHECK_OUT" | "BREAK_IN" | "BREAK_OUT" | "OVERTIME_IN" | "OVERTIME_OUT" | "UNKNOWN";
  deviceTransactionId?: string | null;
  raw: Record<string, unknown>;
};

export type DeviceStatusSnapshot = {
  reachable: boolean;
  connected: boolean;
  protocol?: string;
  message: string;
  checkedAt: Date;
};

export type DeviceAdapter = {
  readonly name: string;
  readonly verificationStatus: "verified" | "unverified";
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getDeviceInfo(): Promise<DeviceInfo>;
  getUsers(): Promise<DeviceUser[]>;
  createUser(user: DeviceUser): Promise<void>;
  updateUser(user: DeviceUser): Promise<void>;
  deleteUser(userId: string): Promise<void>;
  getAttendanceLogs(): Promise<DeviceAttendanceLog[]>;
  getDeviceStatus(): Promise<DeviceStatusSnapshot>;
  clearAttendanceLogs(): Promise<void>;
};

/**
 * Why the probe failed. Over a VPN the difference matters: a dead tunnel and a
 * powered-off terminal look identical unless the socket error code is kept.
 */
export type TcpProbeDiagnosis =
  | "ok"
  | "tunnel_down"
  | "no_reply"
  | "port_closed"
  | "bad_address"
  | "unknown";

export type TcpProbeResult = {
  ok: boolean;
  ipAddress: string;
  port: number;
  latencyMs: number;
  error?: string;
  diagnosis?: TcpProbeDiagnosis;
  /** Operator-facing next step for `diagnosis`. */
  hint?: string;
};
