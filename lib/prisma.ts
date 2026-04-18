import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        log: process.env.NODE_ENV === 'production' ? ['error'] : ['error'],
        datasources: {
            db: {
                url: process.env.DATABASE_URL,
            },
        },
    });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Executes a Prisma query with automatic retry on connection failure.
 * Handles Neon cold-start latency (free tier sleeps after 5min idle).
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    retries = 3,
    delayMs = 1500
): Promise<T> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (err: any) {
            const isConnectionError =
                err?.message?.includes("Can't reach database") ||
                err?.message?.includes('Connection refused') ||
                err?.message?.includes('connection timeout') ||
                err?.code === 'P1001' ||
                err?.code === 'P1008';

            if (isConnectionError && attempt < retries) {
                await new Promise(res => setTimeout(res, delayMs * attempt));
                continue;
            }
            throw err;
        }
    }
    throw new Error('Max retries exceeded');
}
