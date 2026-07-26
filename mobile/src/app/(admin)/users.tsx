import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/client'
import { fetchAuditLogs } from '@/api/endpoints/audit'
import { deleteUser, fetchUsers, type StaffUser } from '@/api/endpoints/users'
import { appAlert } from '@/components/AppAlert'
import { Card, SectionTitle } from '@/components/admin/Card'
import { UserFormModal } from '@/components/admin/UserFormModal'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { LoadingView } from '@/components/LoadingView'
import { Screen } from '@/components/Screen'
import { ar } from '@/i18n/ar'
import { useFeature } from '@/hooks/useFeature'
import { useAuthStore } from '@/stores/auth'
import { useBranchSelection } from '@/stores/branch'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'
import { formatDate, formatDateTime } from '@/utils/format'
import { canManage, roleLevel, roleMeta } from '@/utils/roles'
import { ALIGN_RIGHT, ROW } from '@/utils/rtl'

const t = {
  title: 'المستخدمون',
  subtitle: 'إدارة فريق العمل — إضافة وتعديل وحذف',
  staff: 'الموظفون',
  add: 'إضافة مستخدم',
  noStaff: 'لا يوجد موظفون بعد — أضف أول مستخدم للبدء',
  noMatch: 'لا يوجد موظفون بهذا الدور',
  orgWide: 'كل الفروع',
  you: 'أنت',
  joined: 'انضم',
  edit: 'تعديل',
  delete: 'حذف',
  all: 'الكل',
  done: 'تم',
  created: 'تمت إضافة المستخدم بنجاح',
  updated: 'تم حفظ تعديلات المستخدم',
  deleted: 'تم حذف المستخدم',
  deleteTitle: 'حذف المستخدم',
  deleteFailed: 'تعذر الحذف',
  audit: 'سجل التدقيق (آخر العمليات)',
  noAudit: 'لا توجد عمليات مسجلة',
}

const deleteConfirmMsg = (name: string) =>
  `هل أنت متأكد من حذف «${name}»؟ لا يمكن التراجع عن هذا الإجراء.`

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
  CREATE_USER: 'إضافة مستخدم',
  UPDATE_USER: 'تعديل مستخدم',
  DELETE_USER: 'حذف مستخدم',
  LOGIN: 'تسجيل دخول',
}

/** الحرف الأول من اسم المستخدم لعرضه في الأفاتار (يتجاهل المسافات البادئة). */
function initialChar(name: string): string {
  const c = name.trim()[0]
  return c ? c.toUpperCase() : '#'
}

function displayName(u: StaffUser): string {
  return u.username || u.email || '—'
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
            <View key={log.id} style={[styles.auditRow, i > 0 && styles.auditRowDivider]}>
              <View style={styles.auditIcon}>
                <Ionicons name="document-text-outline" size={16} color={colors.textSecondary} />
              </View>
              <View style={styles.auditInfo}>
                <Text style={styles.auditTitle}>{ACTION_LABELS[log.action] ?? log.action}</Text>
                <Text style={styles.auditMeta}>
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

interface UserCardProps {
  user: StaffUser
  isSelf: boolean
  /** أزرار التعديل/الحذف تظهر فقط للأدوار الأدنى من دور المشاهد (قاعدة الخادم). */
  manageable: boolean
  branchName: string
  onEdit: (u: StaffUser) => void
  onDelete: (u: StaffUser) => void
}

/**
 * بطاقة موظف: صف علوي (أفاتار بحرف الاسم + الاسم/البريد يمينًا ↔ شارة الدور يسارًا)،
 * ثم شريط تفاصيل (الفرع + تاريخ الانضمام)، ثم صف أزرار تعديل/حذف عند السماح.
 */
function UserCard({ user: u, isSelf, manageable, branchName, onEdit, onDelete }: UserCardProps) {
  const m = roleMeta(u.role)
  const name = displayName(u)

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.avatar, { backgroundColor: m.tintSoft }]}>
          <Text style={[styles.avatarText, { color: m.tint }]}>{initialChar(name)}</Text>
        </View>
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            {isSelf ? (
              <View style={styles.selfChip}>
                <Text style={styles.selfChipText}>{t.you}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="mail-outline" size={12} color={colors.textMuted} />
            <Text style={styles.meta} numberOfLines={1}>
              {u.email || '—'}
            </Text>
          </View>
        </View>

        <View style={[styles.roleBadge, { backgroundColor: m.tintSoft }]}>
          <Ionicons name={m.icon} size={13} color={m.tint} />
          <Text style={[styles.roleBadgeText, { color: m.tint }]}>{m.label}</Text>
        </View>
      </View>

      <View style={styles.detailsRow}>
        <View style={styles.detailChip}>
          <Ionicons name="storefront-outline" size={12} color={colors.textSecondary} />
          <Text style={styles.detailText}>{branchName}</Text>
        </View>
        <View style={styles.detailChip}>
          <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
          <Text style={styles.detailText}>{`${t.joined} ${formatDate(u.createdAt)}`}</Text>
        </View>
      </View>

      {manageable ? (
        <>
          <View style={styles.cardDivider} />
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
              onPress={() => onEdit(u)}
            >
              <Ionicons name="create-outline" size={16} color={colors.primary} />
              <Text style={styles.editText}>{t.edit}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
              onPress={() => onDelete(u)}
            >
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
              <Text style={styles.deleteText}>{t.delete}</Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </View>
  )
}

export default function AdminUsers() {
  const auditEnabled = useFeature('audit_log')
  const me = useAuthStore(s => s.user)
  const { branches, selectedBranchId } = useBranchSelection()
  const bid = selectedBranchId
  const queryClient = useQueryClient()

  const usersQ = useQuery({ queryKey: ['admin-users', bid], queryFn: () => fetchUsers(bid) })

  const [roleFilter, setRoleFilter] = useState<string>('all')
  /** هدف نموذج المستخدم: null = مغلق • { user: null } = إضافة • { user } = تعديل. */
  const [formTarget, setFormTarget] = useState<{ user: StaffUser | null } | null>(null)

  // العمليات تُسجَّل في سجل التدقيق أيضًا — نبطل الاستعلامين معًا
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    void queryClient.invalidateQueries({ queryKey: ['admin-audit'] })
  }

  const onSaved = (mode: 'create' | 'edit') => {
    refresh()
    appAlert.success(t.done, mode === 'create' ? t.created : t.updated)
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      refresh()
      appAlert.success(t.done, t.deleted)
    },
    onError: err => {
      appAlert.error(t.deleteFailed, err instanceof ApiError ? err.message : ar.common.unexpectedError)
    },
  })

  const confirmDelete = (u: StaffUser) => {
    if (deleteMutation.isPending) return
    appAlert.confirm({
      title: t.deleteTitle,
      message: deleteConfirmMsg(displayName(u)),
      confirmText: t.delete,
      destructive: true,
      onConfirm: () => deleteMutation.mutate(u.id),
    })
  }

  const branchName = (branchId: string | null) =>
    branchId ? (branches.find(b => b.id === branchId)?.name ?? '—') : t.orgWide

  const users = usersQ.data ?? []
  // الأعلى صلاحيةً أولًا، ثم أبجديًا — بنية الفريق تُقرأ من أعلى لأسفل
  const sorted = [...users].sort(
    (a, b) => roleLevel(b.role) - roleLevel(a.role) || displayName(a).localeCompare(displayName(b), 'ar'),
  )
  const counts = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1
    return acc
  }, {})
  const rolesPresent = [...new Set(users.map(u => u.role))].sort((a, b) => roleLevel(b) - roleLevel(a))
  const filtered = roleFilter === 'all' ? sorted : sorted.filter(u => u.role === roleFilter)

  return (
    <Screen
      title={t.title}
      subtitle={t.subtitle}
      refreshing={usersQ.isRefetching}
      onRefresh={() => void usersQ.refetch()}
    >
      {usersQ.isPending ? (
        <LoadingView />
      ) : usersQ.isError ? (
        <ErrorState error={usersQ.error} onRetry={() => void usersQ.refetch()} />
      ) : (
        <>
          <SectionTitle
            action={
              <Pressable style={styles.addBtn} onPress={() => setFormTarget({ user: null })}>
                <Ionicons name="person-add-outline" size={15} color={colors.onPrimary} />
                <Text style={styles.addBtnText}>{t.add}</Text>
              </Pressable>
            }
          >
            {`${t.staff} (${users.length})`}
          </SectionTitle>

          {/* مرشّح الأدوار — يعمل ملخصًا بالأعداد ومرشّحًا للقائمة في آن */}
          {users.length > 0 ? (
            <View style={styles.filterWrap}>
              <Pressable
                style={[styles.filterChip, roleFilter === 'all' && styles.filterChipAll]}
                onPress={() => setRoleFilter('all')}
              >
                <Text style={[styles.filterText, roleFilter === 'all' && styles.filterTextAll]}>
                  {`${t.all} (${users.length})`}
                </Text>
              </Pressable>
              {rolesPresent.map(r => {
                const m = roleMeta(r)
                const selected = roleFilter === r
                return (
                  <Pressable
                    key={r}
                    style={[styles.filterChip, selected && { backgroundColor: m.tintSoft, borderColor: m.tint }]}
                    onPress={() => setRoleFilter(selected ? 'all' : r)}
                  >
                    <Ionicons name={m.icon} size={13} color={selected ? m.tint : colors.textSecondary} />
                    <Text style={[styles.filterText, selected && { color: m.tint, fontWeight: '800' }]}>
                      {`${m.label} (${counts[r]})`}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          ) : null}

          {filtered.length === 0 ? (
            <View style={styles.emptyWrap}>
              <EmptyState message={users.length === 0 ? t.noStaff : t.noMatch} icon="people-outline" />
            </View>
          ) : (
            <View style={styles.stack}>
              {filtered.map(u => (
                <UserCard
                  key={u.id}
                  user={u}
                  isSelf={u.id === me?.id}
                  manageable={u.id !== me?.id && canManage(me?.role, u.role)}
                  branchName={branchName(u.branchId)}
                  onEdit={user => setFormTarget({ user })}
                  onDelete={confirmDelete}
                />
              ))}
            </View>
          )}
        </>
      )}

      {/* سجل التدقيق يظهر فقط عند تفعيل ميزة audit_log — وإلا يُخفى كليًا */}
      {auditEnabled ? <AuditSection bid={bid} /> : null}

      {/* المفتاح يتغيّر مع كل فتح وإغلاق ⇐ يُعاد تركيب النموذج فتُصفَّر حقوله تلقائيًا. */}
      <UserFormModal
        key={formTarget ? (formTarget.user?.id ?? 'new') : 'closed'}
        visible={formTarget !== null}
        user={formTarget?.user ?? null}
        onClose={() => setFormTarget(null)}
        onSaved={onSaved}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  addBtn: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    ...shadow.button,
  },
  addBtnText: { color: colors.onPrimary, fontSize: fontSize.sm, fontWeight: '700' },

  filterWrap: { flexDirection: ROW, flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  filterChip: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  filterChipAll: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  filterText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary },
  filterTextAll: { color: colors.primary, fontWeight: '800' },

  emptyWrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    ...shadow.card,
  },

  // ── مكدّس بطاقات الموظفين ──
  stack: { gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    ...shadow.card,
  },
  cardTop: { flexDirection: ROW, alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: fontSize.lg, fontWeight: '800' },
  // alignItems (بدل textAlign) يضمن التصاق الاسم بالأفاتار مهما كان اتجاه النظام.
  info: { flex: 1, gap: 3, alignItems: ALIGN_RIGHT },
  nameRow: { flexDirection: ROW, alignItems: 'center', gap: spacing.sm, maxWidth: '100%' },
  name: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, flexShrink: 1 },
  selfChip: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
  },
  selfChipText: { fontSize: fontSize.xs, fontWeight: '700', color: colors.primary },
  metaRow: { flexDirection: ROW, alignItems: 'center', gap: spacing.xs },
  meta: { fontSize: fontSize.xs, color: colors.textMuted },
  roleBadge: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 1,
  },
  roleBadgeText: { fontSize: fontSize.xs, fontWeight: '700' },

  detailsRow: { flexDirection: ROW, gap: spacing.sm, marginTop: spacing.md },
  detailChip: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  detailText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textSecondary },

  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  actions: { flexDirection: ROW, gap: spacing.sm },
  editBtn: {
    flex: 1,
    flexDirection: ROW,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  editText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '800' },
  deleteBtn: {
    flex: 1,
    flexDirection: ROW,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.dangerSoft,
  },
  deleteText: { color: colors.danger, fontSize: fontSize.sm, fontWeight: '800' },
  pressed: { opacity: 0.7 },

  // ── سجل التدقيق ──
  auditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  auditRowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  auditIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  auditInfo: { flex: 1, gap: 2 },
  auditTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.text, textAlign: 'right' },
  auditMeta: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'right' },
})
