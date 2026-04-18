/**
 * Edge-compatible auth utilities — no Node.js native modules.
 * Only uses `jose` which works in the Edge runtime.
 * Import this from middleware.ts instead of lib/auth.ts.
 */
import { SignJWT, jwtVerify } from 'jose'

function getAccessSecret() {
  const s = process.env.JWT_SECRET || 'change-me-to-a-secure-random-string-min-64-chars'
  if (!s) throw new Error('JWT_SECRET is not set')
  return new TextEncoder().encode(s)
}

function getBranchSecret() {
  const s = process.env.BRANCH_TOKEN_SECRET || 'change-me-branch-token-secret-64-chars'
  if (!s) throw new Error('BRANCH_TOKEN_SECRET is not set')
  return new TextEncoder().encode(s)
}

export interface TokenPayload {
  sub: string
  role: string
  tenantId?: string
  branchId?: string
  type: 'access' | 'refresh' | 'super_admin'
}

export async function verifyAccessToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, getAccessSecret())
  const raw = payload as unknown as TokenPayload
  // Backward compatibility: tokens issued before migration may contain TENANT_ADMIN
  if (raw.role === 'TENANT_ADMIN') raw.role = 'ADMIN'
  return raw
}

export interface BranchTokenPayload {
  branchId: string
  tenantId: string
  type: 'branch'
}

export async function verifyBranchToken(token: string): Promise<BranchTokenPayload> {
  const { payload } = await jwtVerify(token, getBranchSecret())
  return payload as unknown as BranchTokenPayload
}

// ─── Role Checks ──────────────────────────────────────────────────────────────

export function isSuperAdmin(role: string)    { return role === 'SUPER_ADMIN' }
export function canAccessAdmin(role: string)  { return ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER'].includes(role) }
export function canManageBranch(role: string) { return ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER'].includes(role) }
export function canManageStock(role: string)  { return ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'STOCK_KEEPER'].includes(role) }
export function canAccessPOS(role: string)    { return ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'CASHIER'].includes(role) }

// Legacy aliases — kept for backward compatibility
export function isTenantAdmin(role: string)   { return role === 'ADMIN' || role === 'SUPER_ADMIN' }
export function isBranchManager(role: string) { return ['ADMIN', 'BRANCH_MANAGER', 'SUPER_ADMIN'].includes(role) }
export function isCashier(role: string)       { return ['CASHIER', 'BRANCH_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(role) }
