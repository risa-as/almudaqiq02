import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { fetchSalesReport, type DateRange, type SalesReportTransaction } from '@/api/endpoints/reports'
import { Card, SectionTitle } from '@/components/admin/Card'
import { InvoiceCard } from '@/components/admin/InvoiceCard'
import { InvoiceDetailModal } from '@/components/admin/InvoiceDetailModal'
import { ReportRangeFilter } from '@/components/admin/ReportRangeFilter'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { LoadingView } from '@/components/LoadingView'
import { Screen } from '@/components/Screen'
import { StatCard } from '@/components/StatCard'
import { ar } from '@/i18n/ar'
import { useBranchSelection } from '@/stores/branch'
import { colors, fontSize, radius, spacing } from '@/theme'
import { formatMoney } from '@/utils/format'

const t = {
  title: 'تقرير المبيعات',
  subtitle: 'الإجماليات والفواتير حسب الفترة',
  totalSales: 'إجمالي المبيعات',
  txCount: 'عدد الفواتير',
  netProfit: 'صافي الربح',
  returns: 'المرتجعات',
  byCategory: 'المبيعات حسب التصنيف',
  others: 'أخرى',
  recent: 'أحدث الفواتير',
  noData: 'لا توجد مبيعات في هذه الفترة',
}

/** أقصى عدد تصنيفات تُعرض كصفوف؛ الباقي يُجمَع في صف «أخرى» بدل الإسقاط الصامت. */
const TOP_CATEGORIES = 6

/**
 * المبيعات حسب التصنيف — قائمة أشرطة أفقية مرتبة تنازليًا:
 * اسم التصنيف + المبلغ كاملًا (بدون اختصار ك/م) وتحته شريط ونسبة المساهمة من الإجمالي.
 */
function CategoryBreakdown({ categories }: { categories: { name: string; value: number }[] }) {
  const sorted = [...categories].sort((a, b) => b.value - a.value)
  const total = sorted.reduce((s, c) => s + c.value, 0)
  const rest = sorted.slice(TOP_CATEGORIES)
  const restValue = rest.reduce((s, c) => s + c.value, 0)
  const rows: { name: string; value: number; isOther?: boolean }[] = sorted.slice(0, TOP_CATEGORIES)
  if (restValue > 0) rows.push({ name: `${t.others} (${rest.length})`, value: restValue, isOther: true })
  const maxValue = rows.reduce((m, c) => Math.max(m, c.value), 0)

  return (
    <View>
      {rows.map((c, i) => {
        const pct = total > 0 ? (c.value / total) * 100 : 0
        const barWidth = maxValue > 0 ? Math.max((c.value / maxValue) * 100, 3) : 0
        return (
          <View key={`${c.name}-${i}`} style={[styles.catRow, i > 0 && styles.catRowDivider]}>
            <View style={styles.catHead}>
              <Text style={[styles.catName, c.isOther && styles.catNameOther]} numberOfLines={1}>
                {c.name}
              </Text>
              <Text style={styles.catValue}>{formatMoney(c.value)}</Text>
            </View>
            <View style={styles.catBarRow}>
              <View style={styles.catTrack}>
                <View
                  style={[
                    styles.catFill,
                    { width: `${barWidth}%` },
                    c.isOther && { backgroundColor: colors.textMuted },
                  ]}
                />
              </View>
              <Text style={styles.catPct}>{pct.toFixed(1)}%</Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}


export default function SalesReportScreen() {
  const [range, setRange] = useState<DateRange | null>(null)
  // الفاتورة المفتوحة في نافذة التفاصيل — نمرّر الصف كاملًا فتظهر المعاينة فورًا
  const [invoice, setInvoice] = useState<SalesReportTransaction | null>(null)
  const { selectedBranchId } = useBranchSelection()
  const bid = selectedBranchId

  const q = useQuery({
    queryKey: ['report-sales', bid, range?.startDate ?? null, range?.endDate ?? null],
    queryFn: () => fetchSalesReport('daily', bid, range),
  })

  return (
    <Screen title={t.title} subtitle={t.subtitle} refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      {/* فلتر الفترة الموحّد: اليوم/الأسبوع/الشهر + فترة مخصصة (الافتراضي: اليوم) */}
      <ReportRangeFilter onRangeChange={setRange} />

      {q.isPending ? (
        <LoadingView />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <>
          <View style={styles.statsRow}>
            <StatCard label={t.totalSales} value={formatMoney(q.data.totalSales)} icon="cash-outline" unit={ar.common.currency} />
            <StatCard
              label={t.txCount}
              value={String(q.data.transactionCount)}
              icon="receipt-outline"
              tint={colors.violet}
              tintSoft={colors.violetSoft}
            />
          </View>
          <View style={styles.statsRow}>
            <StatCard
              label={t.netProfit}
              value={formatMoney(q.data.netProfit)}
              icon="trending-up"
              tint={colors.success}
              tintSoft={colors.successSoft}
              unit={ar.common.currency}
            />
            <StatCard
              label={t.returns}
              value={formatMoney(q.data.totalReturns)}
              icon="return-down-back-outline"
              tint={colors.danger}
              tintSoft={colors.dangerSoft}
              unit={ar.common.currency}
              hint={`${q.data.returnCount} عملية`}
            />
          </View>

          {q.data.salesByCategory.length > 0 ? (
            <>
              <SectionTitle>{t.byCategory}</SectionTitle>
              <Card>
                <CategoryBreakdown categories={q.data.salesByCategory} />
              </Card>
            </>
          ) : null}

          <SectionTitle>{t.recent}</SectionTitle>
          {q.data.transactions.length === 0 ? (
            <Card>
              <EmptyState message={t.noData} icon="receipt-outline" />
            </Card>
          ) : (
            <View style={styles.invList}>
              {q.data.transactions.slice(0, 20).map(tx => (
                <InvoiceCard key={tx.id} tx={tx} onPress={() => setInvoice(tx)} />
              ))}
            </View>
          )}
        </>
      )}

      <InvoiceDetailModal
        visible={invoice !== null}
        transactionId={invoice?.id ?? null}
        branchId={bid}
        preview={invoice}
        onClose={() => setInvoice(null)}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },

  // ── المبيعات حسب التصنيف ────────────────────────────────────────────────────
  catRow: { paddingVertical: spacing.sm, gap: spacing.xs },
  catRowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  catHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  // flexShrink بدل flex:1 حتى يلتصق الاسم بجهة البداية (اليمين) ولا ينجرف نحو المبلغ
  catName: { flexShrink: 1, fontSize: fontSize.sm, fontWeight: '700', color: colors.text },
  catNameOther: { color: colors.textSecondary, fontWeight: '600' },
  catValue: { fontSize: fontSize.sm, fontWeight: '800', color: colors.text },
  catBarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  catTrack: {
    flex: 1,
    height: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.borderSoft,
    overflow: 'hidden',
  },
  catFill: { height: 6, borderRadius: radius.sm, minWidth: 6, backgroundColor: colors.violet },
  catPct: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: '700', width: 42, textAlign: 'left' },

  // ── أحدث الفواتير ───────────────────────────────────────────────────────────
  invList: { gap: spacing.sm },
})
