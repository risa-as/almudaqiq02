import type { PrismaClient } from '@prisma/client';
import { PrismaClientCtor, getDbUrl } from './prisma-runtime';

// Picks the local SQLite client in Electron, the PostgreSQL client in cloud.
// When using Neon Pooler (pgbouncer=true in URL), Prisma must NOT append
// its own connection_limit — the pooler manages connections externally.
function createPrismaClient(): PrismaClient {
  return new PrismaClientCtor({
    log: ['error'],
    datasources: { db: { url: getDbUrl() } },
  });
}

// Singleton — reuse across hot-reloads in dev
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? (globalForPrisma.prisma = createPrismaClient());

// ─── Retry helper ─────────────────────────────────────────────────────────────
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 1500,
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const isConnectionError =
        err?.message?.includes("Can't reach database") ||
        err?.message?.includes('Connection refused')   ||
        err?.message?.includes('connection timeout')   ||
        err?.message?.includes('connection pool')      ||
        err?.code === 'P1001' ||
        err?.code === 'P1008' ||
        err?.code === 'P2024';

      if (isConnectionError && attempt < retries) {
        await new Promise(res => setTimeout(res, delayMs * attempt));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Max retries exceeded');
}
