import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/** Neon/pgbouncer often drops idle connections — reconnect once and retry. */
export async function withPrisma<T>(fn: (db: PrismaClient) => Promise<T>): Promise<T> {
  try {
    return await fn(prisma);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const closed =
      message.includes("Closed") ||
      message.includes("P1001") ||
      message.includes("Can't reach database") ||
      message.includes("Connection reset") ||
      message.includes("ECONNRESET");
    if (!closed) throw error;
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
    await prisma.$connect();
    return await fn(prisma);
  }
}
