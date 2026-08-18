import type { AdminRole } from "@prisma/client";
import { AuthError } from "@/lib/errors";

export type Permission =
  | "dashboard"
  | "attendance"
  | "attendance.write"
  | "reports"
  | "employees"
  | "employees.write"
  | "devices"
  | "devices.sync"
  | "devices.destructive"
  | "sms"
  | "shifts"
  | "holidays"
  | "leaves"
  | "settings"
  | "audit"
  | "simulation";

const matrix: Record<Permission, AdminRole[]> = {
  dashboard: ["SUPER_ADMIN", "ADMIN", "VIEWER"],
  attendance: ["SUPER_ADMIN", "ADMIN", "VIEWER"],
  "attendance.write": ["SUPER_ADMIN", "ADMIN"],
  reports: ["SUPER_ADMIN", "ADMIN", "VIEWER"],
  employees: ["SUPER_ADMIN", "ADMIN"],
  "employees.write": ["SUPER_ADMIN", "ADMIN"],
  devices: ["SUPER_ADMIN", "ADMIN"],
  "devices.sync": ["SUPER_ADMIN", "ADMIN"],
  "devices.destructive": ["SUPER_ADMIN"],
  sms: ["SUPER_ADMIN", "ADMIN"],
  shifts: ["SUPER_ADMIN", "ADMIN"],
  holidays: ["SUPER_ADMIN", "ADMIN"],
  leaves: ["SUPER_ADMIN", "ADMIN"],
  settings: ["SUPER_ADMIN", "ADMIN", "VIEWER"],
  audit: ["SUPER_ADMIN"],
  simulation: ["SUPER_ADMIN", "ADMIN"],
};

export function can(role: AdminRole, permission: Permission): boolean {
  return matrix[permission].includes(role);
}

export function assertCan(role: AdminRole, permission: Permission) {
  if (!can(role, permission)) {
    throw new AuthError("You do not have permission to perform this action.", 403);
  }
}
