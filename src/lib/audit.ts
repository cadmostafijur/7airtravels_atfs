import "server-only";

import type { AdminRole, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function writeAudit(input: {
  adminId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      adminId: input.adminId ?? undefined,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? undefined,
      ipAddress: input.ipAddress ?? undefined,
      userAgent: input.userAgent ?? undefined,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}

export type SessionAdmin = {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
};
