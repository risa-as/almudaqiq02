import * as bcrypt from 'bcrypt'
import { SignJWT, jwtVerify } from 'jose'

const BCRYPT_ROUNDS = 12

// ─── Password ─────────────────────────────────────────────────────────────────

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

// ─── JWT ──────────────────────────────────────────────────────────────────────

function getAccessSecret() {
  const s = process.env.JWT_SECRET || 'change-me-to-a-secure-random-string-min-64-chars'
  if (!s) throw new Error('JWT_SECRET is not set')
  return new TextEncoder().encode(s)
}

function getRefreshSecret() {
  const s = process.env.REFRESH_TOKEN_SECRET || 'change-me-to-another-secure-random-string-64-chars'
  if (!s) throw new Error('REFRESH_TOKEN_SECRET is not set')
  return new TextEncoder().encode(s)
}

export interface TokenPayload {
  sub: string          // userId or superAdminId
  role: string         // SUPER_ADMIN | ADMIN | BRANCH_MANAGER | CASHIER | STOCK_KEEPER
  tenantId?: string
  branchId?: string
  type: 'access' | 'refresh' | 'super_admin'
}

export async function generateAccessToken(payload: Omit<TokenPayload, 'type'>): Promise<string> {
  return new SignJWT({ ...payload, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(getAccessSecret())
}

export async function generateRefreshToken(payload: Omit<TokenPayload, 'type'>): Promise<string> {
  return new SignJWT({ ...payload, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getRefreshSecret())
}

export async function generateSuperAdminAccessToken(superAdminId: string): Promise<string> {
  return new SignJWT({ sub: superAdminId, role: 'SUPER_ADMIN', type: 'super_admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(getAccessSecret())
}

export async function generateSuperAdminRefreshToken(superAdminId: string): Promise<string> {
  return new SignJWT({ sub: superAdminId, role: 'SUPER_ADMIN', type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getRefreshSecret())
}

export async function verifyAccessToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, getAccessSecret())
  const raw = payload as unknown as TokenPayload
  // Backward compatibility: tokens issued before migration may contain TENANT_ADMIN
  if (raw.role === 'TENANT_ADMIN') raw.role = 'ADMIN'
  return raw
}

export async function verifyRefreshToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, getRefreshSecret())
  const raw = payload as unknown as TokenPayload
  if (raw.role === 'TENANT_ADMIN') raw.role = 'ADMIN'
  return raw
}

export async function generateTokenPair(payload: Omit<TokenPayload, 'type'>) {
  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(payload),
    generateRefreshToken(payload),
  ])
  return { accessToken, refreshToken }
}

// ─── Branch Token (for desktop app activation) ────────────────────────────────

function getBranchSecret() {
  const s = process.env.BRANCH_TOKEN_SECRET || 'change-me-branch-token-secret-64-chars'
  if (!s) throw new Error('BRANCH_TOKEN_SECRET is not set')
  return new TextEncoder().encode(s)
}

export async function generateBranchToken(branchId: string, tenantId: string): Promise<string> {
  return new SignJWT({ branchId, tenantId, type: 'branch' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .sign(getBranchSecret())
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

// Legacy aliases — kept for backward compatibility with existing callers
export function isTenantAdmin(role: string)   { return role === 'ADMIN' || role === 'SUPER_ADMIN' }
export function isBranchManager(role: string) { return ['ADMIN', 'BRANCH_MANAGER', 'SUPER_ADMIN'].includes(role) }
export function isCashier(role: string)       { return ['CASHIER', 'BRANCH_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(role) }
