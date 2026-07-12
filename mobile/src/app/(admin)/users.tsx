import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { fetchAuditLogs } from '@/api/endpoints/audit'
import { fetchUsers } from '@/api/endpoints/users'
import { Card, SectionTitle } from '@/components/admin/Card'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { LoadingView } from '@/components/LoadingView'
import { Screen } from '@/components/Screen'
import { useFeature } from '@/hooks/useFeature'
import { useBranchSelection } from '@/stores/branch'
import { colors, fontSize, radius, spacing } from '@/theme'
import { formatDateTime } from '@/utils/format'

const t = {
  title: 'المستخدمون',
  subtitle: 'قائمة الموظفين وسجل التدقيق',
  staff: 'الموظفون',
  noStaff: 'لا يوجد موظفون',
  orgWide: 'كل الفروع',
  audit: 'سجل التدقيق (آخر العمليات)',
  noAudit: 'لا توجد عمليات مسجلة',
  total: 'الإجمالي',
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'مدير المنظمة',
  BRANCH_MANAGER: 'مدير فرع',
  CASHIER: 'كاشير',
  STOCK_KEEPER: 'أمين مخزن',
}

const ROLE_TINTS: Record<string, { tint: string; tintSoft: string }> = {
  ADMIN: { tint: colors.violet, tintSoft: colors.violetSoft },
  BRANCH_MANAGER: { tint: colors.primary, tintSoft: colors.primarySoft },
  CASHIER: { tint: colors.success, tintSoft: colors.successSoft },
  STOCK_KEEPER: { tint: colors.warning, tintSoft: colors.warningSoft },
}

/** تعريب أشهر أفعال سجل التدقيق؛ ما عداها يظهر كما هو. */
const ACTION_LABELS: Record<string, string> = {
  SALE: 'عملية بيع',
  RETURN: 'إرجاع',
  REFUND: 'استرداد',
  APPLY_DISCOUNT: 'تطبيق خصم',
  EDIT_PRICE: 'تعديل سعر',
  CREATE_EXPENSE: 'إضافة مصروف',
  DELETE_EXPENSE: 'حذف مصروف',
  CREATE_TRANSFER: 'إنشاء تحويل',
  TRANSFER_APPROVED: 'موافقة على تحويل',
  TRANSFER_COMPLETED: 'إتمام تحويل',
  TRANSFER_CANCELLED: 'إلغاء تحويل',
  CREATE_PURCHASE_ORDER: 'إنشاء أمر شراء',
  ORDER_PURCHASE_ORDER: 'اعتماد أمر شراء',
  CANCEL_PURCHASE_ORDER: 'إلغاء أمر شراء',
  RECEIVE_PURCHASE_ORDER: 'استلام أمر شراء',
  LOGIN: 'تسجيل دخول',
}

// قسم سجل التدقيق — يُركَّب فقط عندما تكون ميزة audit_log مفعّلة، فلا يُستدعى
// المسار المحمي إطلاقًا عند القفل (يُخفى القسم كليًا، وليس UpgradeState).
function AuditSection({ bid }: { bid: string | null }) {
  const q = useQuery({
    queryKey: ['admin-audit', bid],
    queryFn: () => fetchAuditLogs(bid, 30),
  })

  return (
    <>
      <SectionTitle>{t.audit}</SectionTitle>
      <Card>
        {q.isPending ? (
          <LoadingView />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        ) : q.data.logs.length === 0 ? (
          <EmptyState message={t.noAudit} icon="shield-checkmark-outline" />
        ) : (
          q.data.logs.map((log, i) => (
            <View key={log.id} style={[styles.row, i > 0 && styles.rowDivider]}>
              <View style={styles.auditIcon}>
                <Ionicons name="document-text-outline" size={16} color={colors.textSecondary} />
              </View>
              <View style={styles.rowInfo}>
                <Text style={styles.rowTitle}>{ACTION_LABELS[log.action] ?? log.action}</Text>
                <Text style={styles.rowMeta}>
                  {log.username ?? 'النظام'} • {formatDateTime(log.createdAt)}
                </Text>
              </View>
            </View>
          ))
        )}
      </Card>
    </>
  )
}

export default function AdminUsers() {
  const auditEnabled = useFeature('audit_log')
  const { branches, selectedBranchId } = useBranchSelection()
  const bid = selectedBranchId

  const usersQ = useQuery({ queryKey: ['admin-users', bid], queryFn: () => fetchUsers(bid) })

  const branchName = (branchId: string | null) =>
    branchId ? (branches.find(b => b.id === branchId)?.name ?? '—') : t.orgWide

  const onRefresh = () => void usersQ.refetch()

  return (
    <Screen title={t.title} subtitle={t.subtitle} refreshing={usersQ.isRefetching} onRefresh={onRefresh}>
      <SectionTitle>{`${t.staff}${usersQ.data ? ` (${usersQ.data.length})` : ''}`}</SectionTitle>
      <Card>
        {usersQ.isPending ? (
          <LoadingView />
        ) : usersQ.isError ? (
          <ErrorState error={usersQ.error} onRetry={() => void usersQ.refetch()} />
        ) : usersQ.data.length === 0 ? (
          <EmptyState message={t.noStaff} icon="people-outline" />
        ) : (
          usersQ.data.map((u, i) => {
            const roleTint = ROLE_TINTS[u.role] ?? { tint: colors.textSecondary, tintSoft: colors.background }
            return (
              <View key={u.id} style={[styles.row, i > 0 && styles.rowDivider]}>
                <View style={[styles.avatar, { backgroundColor: roleTint.tintSoft }]}>
                  <Ionicons name="person" size={18} color={roleTint.tint} />
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {u.username || u.email || '—'}
                  </Text>
                  <Text style={styles.rowMeta}>{branchName(u.branchId)}</Text>
                </View>
                <View style={[styles.roleBadge, { backgroundColor: roleTint.tintSoft }]}>
                  <Text style={[styles.roleBadgeText, { color: roleTint.tint }]}>
                    {ROLE_LABELS[u.role] ?? u.role}
                  </Text>
                </View>
              </View>
            )
          })
        )}
      </Card>

      {/* سجل التدقيق يظهر فقط عند تفعيل ميزة audit_log — وإلا يُخفى كليًا */}
      {auditEnabled ? <AuditSection bid={bid} /> : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  auditIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: { flex: 1, gap: 2 },
  rowTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.text, textAlign: 'right' },
  rowMeta: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'right' },
  roleBadge: { borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  roleBadgeText: { fontSize: fontSize.xs, fontWeight: '700' },
})
