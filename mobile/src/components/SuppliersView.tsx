import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchAllSuppliers, type SupplierListRow } from '@/api/endpoints/suppliersAdmin'
import { appAlert } from '@/components/AppAlert'
import { SectionTitle } from '@/components/admin/Card'
import { SupplierFormModal } from '@/components/admin/SupplierFormModal'
import { SupplierPaymentModal } from '@/components/admin/SupplierPaymentModal'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { LoadingView } from '@/components/LoadingView'
import { Screen } from '@/components/Screen'
import { StatCard } from '@/components/StatCard'
import { ar } from '@/i18n/ar'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'
import { formatMoney } from '@/utils/format'
import { ALIGN_RIGHT, ROW } from '@/utils/rtl'

const t = {
  title: 'الموردون',
  subtitle: 'إدارة الموردين وأرصدتهم المستحقة',
  totalPayables: 'إجمالي المستحقات',
  supplierCount: 'عدد الموردين',
  list: 'قائمة الموردين',
  noSuppliers: 'لا يوجد موردون بعد — أضف موردًا للبدء',
  add: 'إضافة مورد',
  owed: 'مستحق للمورد',
  credit: 'رصيد لنا',
  settled: 'مسدّد',
  pay: 'تسديد',
  edit: 'تعديل',
  done: 'تم',
  created: 'تمت إضافة المورد بنجاح',
  updated: 'تم حفظ تعديلات المورد',
  paid: 'تم تسجيل الدفعة بنجاح',
}

export const SUPPLIERS_SUBTITLE = t.subtitle

/** حدّ تسامح صغير لتفادي أخطاء الكسور العشرية عند مقارنة الرصيد بالصفر. */
const EPS = 0.004

/** الحرف الأول من اسم المورد لعرضه في الأفاتار (يتجاهل المسافات البادئة). */
function initial(name: string): string {
  const c = name.trim()[0]
  return c ? c.toUpperCase() : '#'
}

interface SupplierCardProps {
  supplier: SupplierListRow
  onPay: (s: SupplierListRow) => void
  onEdit: (id: string) => void
}

/**
 * بطاقة مورد: صف علوي (أفاتار + الاسم/الهاتف يمينًا ↔ الرصيد وحالته يسارًا)،
 * ثم صف أزرار: «تسديد» و«تعديل» يظهران دائمًا لكل مورد.
 */
function SupplierCard({ supplier: s, onPay, onEdit }: SupplierCardProps) {
  const owed = s.balance > EPS
  const credit = s.balance < -EPS
  // لون الحالة يحمله صندوق الرصيد وحده؛ الأفاتار يبقى محايدًا كهويّة للمورد.
  const tint = owed ? colors.danger : colors.success
  const tintSoft = owed ? colors.dangerSoft : colors.successSoft

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        {/* الهوية على اليمين: أول حرف من الاسم، ثم الاسم والهاتف بجانبه مباشرةً */}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial(s.name)}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {s.name}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons name="call-outline" size={12} color={colors.textMuted} />
            <Text style={styles.meta} numberOfLines={1}>
              {s.phone || '—'}
            </Text>
          </View>
        </View>

        {/* الرصيد وحالته على اليسار — صندوق ملوّن يُقرأ بلمحة */}
        <View style={[styles.balanceBox, { backgroundColor: tintSoft }]}>
          {owed || credit ? (
            <>
              <Text style={[styles.balanceLabel, { color: tint }]}>{owed ? t.owed : t.credit}</Text>
              <Text style={[styles.balanceAmount, { color: tint }]} numberOfLines={1}>
                {formatMoney(Math.abs(s.balance))}{' '}
                <Text style={[styles.balanceCurrency, { color: tint }]}>{ar.common.currency}</Text>
              </Text>
            </>
          ) : (
            <View style={styles.settledRow}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <Text style={styles.settledText}>{t.settled}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.cardDivider} />

      <View style={styles.actions}>
        <Pressable style={({ pressed }) => [styles.payBtn, pressed && styles.pressed]} onPress={() => onPay(s)}>
          <Ionicons name="cash-outline" size={16} color={colors.onPrimary} />
          <Text style={styles.payText}>{t.pay}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
          onPress={() => onEdit(s.id)}
        >
          <Ionicons name="create-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.editText}>{t.edit}</Text>
        </Pressable>
      </View>
    </View>
  )
}

interface SuppliersViewProps {
  /**
   * الفرع الذي يُحسب عليه الرصيد. المدير قد يمرّر 'all' (رصيد عام)، وأمين المخزن
   * يمرّر فرعه فيكون الرصيد مقصورًا عليه — نفس الشاشة بدلالتين حسب الدور.
   */
  branchId: string | null
  /** سطر وصفي أسفل العنوان (المدير يُلحق به اسم الفرع المختار). */
  subtitle?: string
}

/**
 * شاشة «الموردون» المشتركة بين المدير وأمين المخزن — مصدر واحد كي تبقى الشاشتان
 * متطابقتين بعد أي تعديل لاحق. مصدر الفرع وحده هو ما يختلف بين المسارين.
 */
export function SuppliersView({ branchId, subtitle = t.subtitle }: SuppliersViewProps) {
  const queryClient = useQueryClient()

  // نجلب كل الموردين (لا نُرشّح على الرصيد) حتى يظهر المورد المُضاف فورًا.
  const q = useQuery({ queryKey: ['report-payables', branchId], queryFn: () => fetchAllSuppliers(branchId) })

  /** هدف نموذج المورد: null = مغلق • { id: null } = إضافة • { id } = تعديل. */
  const [formTarget, setFormTarget] = useState<{ id: string | null } | null>(null)
  const [payTarget, setPayTarget] = useState<SupplierListRow | null>(null)

  const openCreate = () => setFormTarget({ id: null })
  const openEdit = (id: string) => setFormTarget({ id })

  // المفتاحان مختلفا البادئة: هذه الشاشة تقرأ report-payables، بينما منتقي المورد
  // في نموذج المنتج الجديد يقرأ ['suppliers', …] — فيلزم إبطالهما معًا.
  const refreshSuppliers = () => {
    void queryClient.invalidateQueries({ queryKey: ['report-payables'] })
    void queryClient.invalidateQueries({ queryKey: ['suppliers'] })
  }

  const onSaved = (mode: 'create' | 'edit') => {
    refreshSuppliers()
    appAlert.success(t.done, mode === 'create' ? t.created : t.updated)
  }

  const onPaid = () => {
    refreshSuppliers()
    appAlert.success(t.done, t.paid)
  }

  const suppliers = q.data ?? []
  // الأعلى استحقاقًا أولًا، ثم المسدّدون (رصيد صفر/سالب) في الأسفل.
  const sorted = [...suppliers].sort((a, b) => b.balance - a.balance)
  const totalPayables = suppliers.reduce((s, r) => s + (r.balance > EPS ? r.balance : 0), 0)

  return (
    <Screen
      title={t.title}
      subtitle={subtitle}
      refreshing={q.isRefetching}
      onRefresh={() => void q.refetch()}
    >
      {q.isPending ? (
        <LoadingView />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <>
          <View style={styles.statsRow}>
            <StatCard
              label={t.totalPayables}
              value={formatMoney(totalPayables)}
              icon="wallet-outline"
              tint={colors.danger}
              tintSoft={colors.dangerSoft}
              unit={ar.common.currency}
            />
            <StatCard
              label={t.supplierCount}
              value={String(suppliers.length)}
              icon="business-outline"
              tint={colors.violet}
              tintSoft={colors.violetSoft}
            />
          </View>

          <SectionTitle
            action={
              <Pressable style={styles.addBtn} onPress={openCreate}>
                <Ionicons name="add" size={16} color={colors.primary} />
                <Text style={styles.addBtnText}>{t.add}</Text>
              </Pressable>
            }
          >
            {t.list}
          </SectionTitle>

          {sorted.length === 0 ? (
            <View style={styles.emptyWrap}>
              <EmptyState message={t.noSuppliers} icon="business-outline" />
            </View>
          ) : (
            <View style={styles.stack}>
              {sorted.map(s => (
                <SupplierCard key={s.id} supplier={s} onPay={setPayTarget} onEdit={openEdit} />
              ))}
            </View>
          )}
        </>
      )}

      {/* المفتاح يتغيّر مع كل فتح وإغلاق ⇐ يُعاد تركيب النموذج فتُصفَّر حقوله تلقائيًا. */}
      <SupplierFormModal
        key={formTarget ? (formTarget.id ?? 'new') : 'closed'}
        visible={formTarget !== null}
        supplierId={formTarget?.id ?? null}
        onClose={() => setFormTarget(null)}
        onSaved={onSaved}
      />

      {/* key بمعرّف المورد ⇐ إعادة تركيب النافذة عند كل فتح فتُصفَّر حقولها تلقائيًا. */}
      <SupplierPaymentModal
        key={payTarget?.id ?? 'none'}
        visible={payTarget !== null}
        supplier={payTarget}
        branchId={branchId}
        onClose={() => setPayTarget(null)}
        onPaid={onPaid}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  addBtn: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  addBtnText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '700' },

  emptyWrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    ...shadow.card,
  },

  // ── مكدّس بطاقات الموردين ──
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
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: fontSize.lg, fontWeight: '800', color: colors.primary },
  // alignItems (بدل textAlign) يضمن التصاق الاسم بالأفاتار مهما كان اتجاه النظام.
  info: { flex: 1, gap: 3, alignItems: ALIGN_RIGHT },
  name: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  metaRow: { flexDirection: ROW, alignItems: 'center', gap: spacing.xs },
  meta: { fontSize: fontSize.xs, color: colors.textMuted },
  balanceBox: {
    minWidth: 96,
    alignItems: 'center',
    gap: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
  },
  balanceLabel: { fontSize: fontSize.xs, fontWeight: '600' },
  balanceAmount: { fontSize: fontSize.md, fontWeight: '800' },
  balanceCurrency: { fontSize: fontSize.xs, fontWeight: '700' },
  settledRow: { flexDirection: ROW, alignItems: 'center', gap: spacing.xs },
  settledText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.success },

  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  actions: { flexDirection: ROW, gap: spacing.sm },
  payBtn: {
    flex: 1,
    flexDirection: ROW,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    ...shadow.button,
  },
  payText: { color: colors.onPrimary, fontSize: fontSize.sm, fontWeight: '800' },
  editBtn: {
    flex: 1,
    flexDirection: ROW,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 42,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  editText: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: '700' },
  pressed: { opacity: 0.7 },
})
