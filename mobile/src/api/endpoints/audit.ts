import { api } from '../client'
import { normalizeBranchId } from '@/stores/branch'

/**
 * GET /api/audit — سجل التدقيق. مبوّب خادميًا بميزة audit_log (يعيد 403 برسالة
 * عربية عند القفل)، والعميل يخفي القسم كليًا عبر useFeature('audit_log').
 */
export interface AuditLogRow {
  id: string
  action: string
  entity: string
  entityId?: string | null
  details?: string | null
  username: string | null
  branchId?: string | null
  createdAt: string
}

export interface AuditResponse {
  logs: AuditLogRow[]
  stats: { total: number; today: number; shown: number }
  filters: {
    actions: { value: string; count: number }[]
    entities: { value: string; count: number }[]
    users: { value: string; count: number }[]
  }
}

export function fetchAuditLogs(
  selectedBranchId: string | null,
  limit = 30
): Promise<AuditResponse> {
  return api<AuditResponse>('/api/audit', {
    query: { limit, branchId: normalizeBranchId(selectedBranchId) },
  })
}
