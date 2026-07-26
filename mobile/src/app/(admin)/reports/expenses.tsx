import { useState, type ComponentProps } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/client'
import { deleteExpense, fetchExpenses, type ExpenseRow } from '@/api/endpoints/expenses'
import type { DateRange } from '@/api/endpoints/reports'
import { appAlert } from '@/components/AppAlert'
import { Card, SectionTitle } from '@/components/admin/Card'
import { ExpenseFormModal } from '@/components/admin/ExpenseFormModal'
import { ReportRangeFilter } from '@/components/admin/ReportRangeFilter'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { LoadingView } from '@/components/LoadingView'
import { Screen } from '@/components/Screen'
import { StatCard } from '@/components/StatCard'
import { ar } from '@/i18n/ar'
import { normalizeBranchId, useBranchSelection } from '@/stores/branch'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'
import { formatDate, formatMoney } from '@/utils/format'
import { ALIGN_RIGHT, ROW } from '@/utils/rtl'

type IconName = ComponentProps<typeof Ionicons>['name']

const t = {
  title: 'المصروفات',
  subtitle: 'قائمة المصروفات حسب الفترة',
  total: 'إجمالي المصروفات',
  count: 'عدد المصروفات',
  byCategory: 'المصروفات حسب التصنيف',
  list: 'القائمة',
  noExpenses: 'لا توجد مصروفات في هذه الفترة',
  uncategorized: 'بدون تصنيف',
  add: 'إضافة مصروف',
  edit: 'تعديل',
  remove: 'حذف',
  deleteTitle: 'تأكيد حذف المصروف؟',
  deleteMsg: 'سيتم حذف هذا المصروف نهائيًا. هل أنت متأكد؟',
  deletedOk: 'تم حذف المصروف',
  done: 'تم',
  error: 'تعذر التنفيذ',
}

interface CategoryStyle {
  icon: IconName
  tint: string
  tintSoft: string
}

/** أيقونة ولون لكل تصنيف معروف (نفس تصنيفات نموذج الإضافة) — وغيرها يأخذ النمط الافتراضي. */
const CATEGORY_META: Record<string, CategoryStyle> = {
  رواتب: { icon: 'people-outline', tint: colors.violet, tintSoft: colors.violetSoft },
  إيجار: { icon: 'home-outline', tint: colors.info, tintSoft: colors.infoSoft },
  كهرباء: { icon: 'flash-outline', tint: colors.warning, tintSoft: colors.warningSoft },
  صيانة: { icon: 'construct-outline', tint: colors.primary, tintSoft: colors.primarySoft },
  أخرى: { icon: 'ellipsis-horizontal', tint: colors.textSecondary, tintSoft: colors.background },
}

const DEFAULT_CATEGORY: CategoryStyle = {
  icon: 'pricetag-outline',
  tint: colors.danger,
  tintSoft: colors.dangerSoft,
}

function categoryStyle(category: string | null): CategoryStyle {
  if (!category) return DEFAULT_CATEGORY
  return CATEGORY_META[category.trim()] ?? DEFAULT_CATEGORY
}

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : ar.common.unexpectedError
}

/** يجمع المصروفات حسب التصنيف ويرتبها تنازليًا (للشريط البياني). */
function groupByCategory(rows: ExpenseRow[]): { name: string; value: number }[] {
  const map = new Map<string, number>()
  for (const e of rows) {
    const key = e.category?.trim() || t.uncategorized
    map.set(key, (map.get(key) ?? 0) + Number(e.amount))
  }
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
}

/** توزيع المصروفات: اسم التصنيف + المبلغ، وتحته شريط ونسبة المساهمة من الإجمالي. */
function CategoryBreakdown({ rows, total }: { rows: { name: string; value: number }[]; total: number }) {
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0)

  return (
    <View>
      {rows.map((r, i) => {
        const meta = categoryStyle(r.name === t.uncategorized ? null : r.name)
        const pct = total > 0 ? (r.value / total) * 100 : 0
        const barWidth = max > 0 ? Math.max((r.value / max) * 100, 3) : 0
        return (
          <View key={r.name} style={[styles.catRow, i > 0 && styles.catRowDivider]}>
            <View style={styles.catHead}>
              <View style={styles.catNameGroup}>
                <Ionicons name={meta.icon} size={14} color={meta.tint} />
                <Text style={styles.catName} numberOfLines={1}>
                  {r.name}
                </Text>
              </View>
              <Text style={styles.catValue}>{formatMoney(r.value)}</Text>
            </View>
            <View style={styles.catBarRow}>
              <View style={styles.catTrack}>
                <View style={[styles.catFill, { width: `${barWidth}%`, backgroundColor: meta.tint }]} />
              </View>
              <Text style={styles.catPct}>{pct.toFixed(1)}%</Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}

interface ExpenseCardProps {
  expense: ExpenseRow
  onEdit: (e: ExpenseRow) => void
  onDelete: (e: ExpenseRow) => void
}

/**
 * بطاقة مصروف: صف علوي (أيقونة التصنيف + العنوان/التصنيف·التاريخ يمينًا ↔ المبلغ يسارًا)،
 * ثم الوصف إن وُجد، ثم فاصل وصفّ أزرار (تعديل / حذف).
 */
function ExpenseCard({ expense: e, onEdit, onDelete }: ExpenseCardProps) {
  const meta = categoryStyle(e.category)

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.iconBox, { backgroundColor: meta.tintSoft }]}>
          <Ionicons name={meta.icon} size={20} color={meta.tint} />
        </View>

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {e.title}
          </Text>
          <View style={styles.metaRow}>
            <View style={[styles.catChip, { backgroundColor: meta.tintSoft }]}>
              <Text style={[styles.catChipText, { color: meta.tint }]} numberOfLines={1}>
                {e.category || t.uncategorized}
              </Text>
            </View>
            <Text style={styles.metaDate}>{formatDate(e.date)}</Text>
          </View>
        </View>

        <View style={styles.amountCol}>
          <Text style={styles.amount} numberOfLines={1}>
            {formatMoney(e.amount)}
          </Text>
          <Text style={styles.amountCurrency}>{ar.common.currency}</Text>
        </View>
      </View>

      {e.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {e.description}
        </Text>
      ) : null}

      <View style={styles.cardDivider} />

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
          onPress={() => onEdit(e)}
        >
          <Ionicons name="create-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.editText}>{t.edit}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.deleteBtn, pressed && styles.pressed]}
          onPress={() => onDelete(e)}
        >
          <Ionicons name="trash-outline" size={16} color={colors.danger} />
          <Text style={styles.deleteText}>{t.remove}</Text>
        </Pressable>
      </View>
    </View>
  )
}

export default function ExpensesReportScreen() {
  const [range, setRange] = useState<DateRange | null>(null)
  /** هدف النموذج: null = مغلق • { expense: null } = إضافة • { expense } = تعديل. */
  const [formTarget, setFormTarget] = useState<{ expense: ExpenseRow | null } | null>(null)
  const { selectedBranchId } = useBranchSelection()
  const bid = selectedBranchId
  const qc = useQueryClient()

  const q = useQuery({
    queryKey: ['report-expenses', bid, range?.startDate ?? null, range?.endDate ?? null],
    // range مضبوطة → فترة مخصصة؛ range=null → كل المصروفات (الخادم يعيد الكل بلا period)
    queryFn: () => fetchExpenses('all', bid, range),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['report-expenses'] })
      appAlert.success(t.done, t.deletedOk)
    },
    onError: err => appAlert.error(t.error, errorMessage(err)),
  })

  const openCreate = () => setFormTarget({ expense: null })
  const openEdit = (e: ExpenseRow) => setFormTarget({ expense: e })

  const confirmDelete = (e: ExpenseRow) => {
    if (deleteMutation.isPending) return
    appAlert.confirm({
      title: t.deleteTitle,
      message: t.deleteMsg,
      destructive: true,
      onConfirm: () => deleteMutation.mutate(e.id),
    })
  }

  const expenses = q.data ?? []
  // الأحدث أولًا — ترتيب متوقّع بغضّ النظر عن ترتيب الخادم.
  const sorted = [...expenses].sort((a, b) => +new Date(b.date) - +new Date(a.date))
  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const categories = groupByCategory(expenses)

  return (
    <Screen
      title={t.title}
      subtitle={t.subtitle}
      refreshing={q.isRefetching}
      onRefresh={() => void q.refetch()}
    >
      {/* فلتر موحّد: اليوم/هذا الأسبوع/هذا الشهر + فترة مخصصة */}
      <ReportRangeFilter onRangeChange={setRange} />

      {q.isPending ? (
        <LoadingView />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <>
          <View style={styles.statsRow}>
            <StatCard
              label={t.total}
              value={formatMoney(total)}
              icon="trending-down-outline"
              tint={colors.danger}
              tintSoft={colors.dangerSoft}
              unit={ar.common.currency}
            />
            <StatCard
              label={t.count}
              value={String(expenses.length)}
              icon="documents-outline"
              tint={colors.violet}
              tintSoft={colors.violetSoft}
            />
          </View>

          {/* التوزيع حسب التصنيف — يظهر فقط عند وجود بيانات */}
          {categories.length > 0 ? (
            <>
              <SectionTitle>{t.byCategory}</SectionTitle>
              <Card>
                <CategoryBreakdown rows={categories} total={total} />
              </Card>
            </>
          ) : null}

          <SectionTitle
            action={
              <Pressable
                style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
                onPress={openCreate}
              >
                <Ionicons name="add" size={16} color={colors.primary} />
                <Text style={styles.addBtnText}>{t.add}</Text>
              </Pressable>
            }
          >
            {t.list}
          </SectionTitle>

          {sorted.length === 0 ? (
            <View style={styles.emptyWrap}>
              <EmptyState message={t.noExpenses} icon="cash-outline" />
            </View>
          ) : (
            <View style={styles.stack}>
              {sorted.map(e => (
                <ExpenseCard key={e.id} expense={e} onEdit={openEdit} onDelete={confirmDelete} />
              ))}
            </View>
          )}
        </>
      )}

      {/* المفتاح يتغيّر مع كل فتح ⇐ يُعاد تركيب النموذج فتُصفَّر حقوله تلقائيًا. */}
      <ExpenseFormModal
        key={formTarget ? (formTarget.expense?.id ?? 'new') : 'closed'}
        visible={formTarget !== null}
        expense={formTarget?.expense ?? null}
        branchId={normalizeBranchId(bid)}
        onClose={() => setFormTarget(null)}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md, marginBottom: spacing.md },
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
  pressed: { opacity: 0.7 },

  // ── التوزيع حسب التصنيف ─────────────────────────────────────────────────────
  catRow: { paddingVertical: spacing.sm, gap: spacing.xs },
  catRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  catHead: { flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  catNameGroup: { flexDirection: ROW, alignItems: 'center', gap: spacing.xs, flexShrink: 1 },
  catName: { flexShrink: 1, fontSize: fontSize.sm, fontWeight: '700', color: colors.text },
  catValue: { fontSize: fontSize.sm, fontWeight: '800', color: colors.text },
  catBarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  catTrack: {
    flex: 1,
    height: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.borderSoft,
    overflow: 'hidden',
  },
  catFill: { height: 6, borderRadius: radius.sm, minWidth: 6 },
  catPct: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: '700', width: 42, textAlign: 'left' },

  // ── مكدّس بطاقات المصروفات ──────────────────────────────────────────────────
  emptyWrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    ...shadow.card,
  },
  stack: { gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    ...shadow.card,
  },
  // ROW يضع الأيقونة + العنوان في جهة اليمين والمبلغ في اليسار مهما كان اتجاه النظام
  cardTop: { flexDirection: ROW, alignItems: 'center', gap: spacing.md },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: 4, alignItems: ALIGN_RIGHT },
  name: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, textAlign: 'right' },
  metaRow: { flexDirection: ROW, alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  catChip: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    maxWidth: 120,
  },
  catChipText: { fontSize: fontSize.xs, fontWeight: '700' },
  metaDate: { fontSize: fontSize.xs, color: colors.textMuted },
  amountCol: { alignItems: 'flex-end', gap: 2 },
  amount: { fontSize: fontSize.md, fontWeight: '800', color: colors.danger },
  amountCurrency: { fontSize: fontSize.xs, fontWeight: '700', color: colors.danger },
  description: {
    marginTop: spacing.sm,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'right',
    lineHeight: 18,
  },

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
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  editText: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: '700' },
  deleteBtn: {
    flex: 1,
    flexDirection: ROW,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 42,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.dangerSoft,
    backgroundColor: colors.dangerSoft,
  },
  deleteText: { color: colors.danger, fontSize: fontSize.sm, fontWeight: '700' },
})
