import { PrismaClient } from "@prisma/client";

// Singleton Prisma client. In dev, Next.js hot-reload re-evaluates modules,
// which would otherwise create a new client (and connection pool) on every
// reload. Caching on globalThis prevents connection exhaustion.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
