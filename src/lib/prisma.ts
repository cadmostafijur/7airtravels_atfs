import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createPrismaClient> };

function isTransientDbError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
  return (
    code === "P1001" ||
    code === "P1017" ||
    message.includes("Server has closed the connection") ||
    message.includes("Closed") ||
    message.includes("Can't reach database") ||
    message.includes("Connection reset") ||
    message.includes("ECONNRESET") ||
    message.includes("Connection terminated") ||
    message.includes("Connection refused") ||
    message.includes("Timed out fetching a new connection")
  );
}

function createPrismaClient() {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  // Neon / PgBouncer often drops idle sockets. Retry once after reconnect.
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          try {
            return await query(args);
          } catch (error) {
            if (!isTransientDbError(error)) throw error;
            try {
              await client.$disconnect();
            } catch {
              // ignore
            }
            await client.$connect();
            return await query(args);
          }
        },
      },
    },
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/** Neon/pgbouncer often drops idle connections — reconnect once and retry. */
export async function withPrisma<T>(fn: (db: typeof prisma) => Promise<T>): Promise<T> {
  try {
    return await fn(prisma);
  } catch (error) {
    if (!isTransientDbError(error)) throw error;
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
    await prisma.$connect();
    return await fn(prisma);
  }
}
