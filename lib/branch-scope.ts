import { prisma } from '@/lib/prisma'

/**
 * Role-aware branch scoping — the single place that decides which branch a
 * request may read or write.
 *
 * Rule (see the branch-isolation convention):
 *  - ADMIN / SUPER_ADMIN are owners: they act on the branch the UI selected,
 *    whatever branchId their token happens to carry.
 *  - Everyone else (BRANCH_MANAGER, CASHIER, STOCK_KEEPER) is pinned to the
 *    branch in their token. A branchId sent in the body or query is ignored for
 *    them — otherwise a cashier could sell, refund or pay from another branch
 *    just by editing the request.
 *  - A branch-bound role whose token has no branchId behaves like an owner,
 *    which is how the schema models "manager of all branches".
 */

type Scoped = { tenantId: string; role: string; branchId?: string | null }

export function isOwnerRole(role: string): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN'
}

/** The branch the caller is locked to, or null when they may choose freely. */
export function pinnedBranchId(auth: Scoped): string | null {
  return !isOwnerRole(auth.role) && auth.branchId ? auth.branchId : null
}

/**
 * Branch id to filter a READ by, or null for "all branches".
 * Tenant scoping is still the caller's job (every query keeps `tenantId`), so
 * an owner passing a foreign branch id simply gets no rows.
 */
export function readBranchId(auth: Scoped, requested?: string | null): string | null {
  const pinned = pinnedBranchId(auth)
  if (pinned) return pinned
  return requested && requested !== 'all' ? requested : null
}

/** `{ branchId }` or `{}` — spread into a Prisma `where`. */
export function readBranchFilter(auth: Scoped, requested?: string | null): { branchId?: string } {
  const id = readBranchId(auth, requested)
  return id ? { branchId: id } : {}
}

/**
 * Branch a WRITE lands in, verified to belong to the caller's tenant.
 * Falls back to the token branch when nothing (or 'all') was requested.
 * Returns null when no valid branch can be determined — callers answer 400.
 *
 * The tenant check matters: Prisma's `connect: { id }` does not care which
 * tenant owns the row, so an unchecked id would attach a record to a branch of
 * another organisation.
 */
export async function resolveWriteBranchId(auth: Scoped, requested?: string | null): Promise<string | null> {
  const pinned = pinnedBranchId(auth)
  const candidate = pinned ?? (requested && requested !== 'all' ? requested : auth.branchId ?? null)
  if (!candidate) return null
  if (pinned) return pinned // came from the verified token
  const branch = await prisma.branch.findFirst({
    where: { id: candidate, tenantId: auth.tenantId },
    select: { id: true },
  })
  return branch?.id ?? null
}

/**
 * Like resolveWriteBranchId, for records where "no branch" is a valid answer
 * (org-level supplier ledger entries, org-wide customers/offers).
 *  - branch-bound roles → their own branch, always
 *  - owners → null for none/'all', the validated id otherwise
 *  - `undefined` → the requested id is not a branch of this tenant (answer 400)
 */
export async function resolveOptionalBranchId(auth: Scoped, requested?: string | null): Promise<string | null | undefined> {
  const pinned = pinnedBranchId(auth)
  if (pinned) return pinned
  if (!requested || requested === 'all') return null
  const branch = await prisma.branch.findFirst({
    where: { id: String(requested), tenantId: auth.tenantId },
    select: { id: true },
  })
  return branch ? branch.id : undefined
}
