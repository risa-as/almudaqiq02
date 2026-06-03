/**
 * Runtime Prisma client selector.
 *
 *   - Electron desktop (IS_ELECTRON=1) → local SQLite client (@prisma/client-local)
 *   - Cloud / web                      → PostgreSQL client   (@prisma/client)
 *
 * The cloud client is imported statically (always present). The local SQLite
 * client is loaded at runtime through a Node require created with
 * `createRequire`, so the bundler never tries to resolve it and the cloud build
 * does not need @prisma/client-local to be generated. For the desktop build the
 * package is copied into the standalone server's node_modules by the packaging
 * scripts, and is only loaded when IS_ELECTRON=1.
 */
import { PrismaClient as CloudPrismaClient } from '@prisma/client'
import { createRequire } from 'module'
import { resolve, isAbsolute } from 'path'

type PrismaClientConstructor = new (...args: any[]) => CloudPrismaClient

export const IS_ELECTRON = process.env.IS_ELECTRON === '1'

/** The DB URL for the active runtime (SQLite file in Electron, Postgres in cloud). */
export function getDbUrl(): string {
  if (IS_ELECTRON) {
    const raw = process.env.LOCAL_DATABASE_URL ?? process.env.DATABASE_URL ?? ''
    // SQLite requires an absolute path — resolve relative file: URLs against CWD
    if (raw.startsWith('file:')) {
      const filePath = raw.slice(5) // strip "file:"
      return isAbsolute(filePath) ? raw : `file:${resolve(process.cwd(), filePath)}`
    }
    return raw
  }
  // Cloud (Neon pooler): give Prisma a longer pool_timeout so a transient Neon
  // slowdown / idle-connection reset doesn't immediately surface as P2024
  // ("Timed out fetching a new connection") under bursts of parallel requests.
  const url = process.env.DATABASE_URL ?? ''
  if (!url || url.includes('pool_timeout=')) return url
  return `${url}${url.includes('?') ? '&' : '?'}pool_timeout=20`
}

function resolveCtor(): PrismaClientConstructor {
  if (IS_ELECTRON) {
    const nodeRequire = createRequire(import.meta.url)
    return nodeRequire('@prisma/client-local').PrismaClient
  }
  return CloudPrismaClient as unknown as PrismaClientConstructor
}

/** PrismaClient constructor for the active runtime. Use instead of importing directly. */
export const PrismaClientCtor: PrismaClientConstructor = resolveCtor()
