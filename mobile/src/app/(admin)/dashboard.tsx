import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { fetchDashboard, fetchExpiryReport, fetchInventoryAlerts, fetchProfit } from '@/api/endpoints/reports'
import { Card } from '@/components/admin/Card'
import { BarChart } from '@/components/admin/BarChart'
import { ErrorState } from '@/components/ErrorState'
import { Hero } from '@/components/Hero'
import { LoadingView } from '@/components/LoadingView'
import { Screen } from '@/components/Screen'
import { StatCard } from '@/components/StatCard'
import { useFeature } from '@/hooks/useFeature'
import { ar } from '@/i18n/ar'
import { useAuthStore } from '@/stores/auth'
import { useBranchSelection } from '@/stores/branch'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'
import { formatDate, formatMoney } from '@/utils/format'
import { greetingFor } from '@/utils/greeting'

const t = {
  title: 'الرئيسية',
  todaySales: 'مبيعات اليوم',
  todayProfit: 'ربح اليوم',
  invoiceCount: 'عدد الفواتير',
  returnsToday: 'مرتجعات اليوم',
  weeklyChart: 'مبيعات آخر 7 أيام',
  weeklyTitle: 'مبيعات الأسبوع',
  weeklyHint: 'آخر 7 أيام',
  alerts: 'تنبيهات المخزون',
  lowStock: 'منتجات منخفضة',
  nearExpiry: 'قريبة الانتهاء',
  quickLinks: 'روابط سريعة',
  approvals: 'الموافقات',
  users: 'المستخدمون',
  assistant: 'المساعد الذكي',
  inventoryOverview: 'نظرة المخزون',
}

export default function AdminDashboard() {
  const router = useRouter()
  const aiEnabled = useFeature('ai_assistant')
  const user = useAuthStore(s => s.user)
  const { selectedBranchId, selectedBranchName } = useBranchSelection()
  const bid = selectedBranchId

  // أرقام مالية → staleTime: 0 (الافتراضي في queryClient) + سحب للتحديث (SC-004)
  const dashQ = useQuery({ queryKey: ['admin-dashboard', bid], queryFn: () => fetchDashboard(bid) })
  const profitQ = useQuery({ queryKey: ['admin-profit', 'daily', bid], queryFn: () => fetchProfit('daily', bid) })
  const alertsQ = useQuery({ queryKey: ['admin-alerts', bid], queryFn: () => fetchInventoryAlerts(bid) })
  const expiryQ = useQuery({ queryKey: ['admin-expiry', bid, '30'], queryFn: () => fetchExpiryReport(bid) })

  const refreshing = dashQ.isRefetching || profitQ.isRefetching || alertsQ.isRefetching || expiryQ.isRefetching

  const onRefresh = () => {
    void dashQ.refetch()
    void profitQ.refetch()
    void alertsQ.refetch()
    void expiryQ.refetch()
  }

  const branchBadge = (
    <View style={styles.branchBadge}>
      <Ionicons name="storefront-outline" size={14} color={colors.primary} />
      <Text style={styles.branchBadgeText} numberOfLines={1}>
        {selectedBranchName}
      </Text>
    </View>
  )

  if (dashQ.isPending) {
    return (
      <Screen title={t.title} headerAction={branchBadge} scroll={false}>
        <LoadingView />
      </Screen>
    )
  }

  if (dashQ.isError) {
    return (
      <Screen title={t.title} headerAction={branchBadge} scroll={false}>
        <ErrorState error={dashQ.error} onRetry={() => void dashQ.refetch()} />
      </Screen>
    )
  }

  const dash = dashQ.data
  const lowStockCount = alertsQ.data?.lowStock.length ?? 0
  const nearExpiryCount = expiryQ.data?.stats.total ?? 0

  const goInventory = () => router.push('/(admin)/inventory' as never)

  const greetingLine = greetingFor(user?.username)
  const brand = user?.tenantName || ar.appName

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      {/* ── الهيدر البطولي المشترك ── */}
      <Hero
        greeting={greetingLine}
        title={brand}
        chips={[
          { icon: 'calendar-outline', text: formatDate(new Date()) },
          { icon: 'storefront-outline', text: selectedBranchName },
        ]}
      />

      {/* ── بطاقات اليوم ── */}
      <View style={styles.statsRow}>
        <StatCard
          label={t.todaySales}
          value={formatMoney(dash.today.sales)}
          icon="cash-outline"
          unit={ar.common.currency}
        />
        <StatCard
          label={t.todayProfit}
          value={profitQ.isPending ? '…' : formatMoney(profitQ.data?.netProfit ?? 0)}
          icon="trending-up"
          tint={colors.success}
          tintSoft={colors.successSoft}
          unit={ar.common.currency}
        />
      </View>
      <View style={styles.statsRow}>
        <StatCard
          label={t.invoiceCount}
          value={String(dash.today.txCount)}
          icon="receipt-outline"
          tint={colors.violet}
          tintSoft={colors.violetSoft}
        />
        <StatCard
          label={t.returnsToday}
          value={formatMoney(dash.today.returns)}
          icon="return-down-back-outline"
          tint={colors.warning}
          tintSoft={colors.warningSoft}
          unit={ar.common.currency}
        />
      </View>

      {/* ── مبيعات الأسبوع (مخطط أعمدة يدوي) ── */}
      <Card style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>{t.weeklyTitle}</Text>
          <Text style={styles.chartHint}>{t.weeklyHint}</Text>
        </View>
        <BarChart data={dash.sparkline.map(p => ({ label: p.label, value: p.total }))} />
      </Card>

      {/* ── تنبيهات المخزون ── */}
      <SectionHeader icon="notifications-outline" title={t.alerts} count={lowStockCount + nearExpiryCount} tint={colors.danger} tintSoft={colors.dangerSoft} />
      <View style={styles.statsRow}>
        <Pressable style={styles.flex1} onPress={goInventory}>
          <StatCard
            label={t.lowStock}
            value={lowStockCount >= 10 ? '+10' : String(lowStockCount)}
            icon="alert-circle-outline"
            tint={colors.danger}
            tintSoft={colors.dangerSoft}
            hint={t.inventoryOverview}
          />
        </Pressable>
        <Pressable style={styles.flex1} onPress={goInventory}>
          <StatCard
            label={t.nearExpiry}
            value={String(nearExpiryCount)}
            icon="hourglass-outline"
            tint={colors.warning}
            tintSoft={colors.warningSoft}
            hint={t.inventoryOverview}
          />
        </Pressable>
      </View>

      {/* ── روابط سريعة ── */}
      <SectionHeader icon="apps-outline" title={t.quickLinks} />
      <View style={styles.linksRow}>
        <QuickLink icon="checkmark-done-outline" label={t.approvals} onPress={() => router.push('/(admin)/approvals' as never)} />
        <QuickLink icon="people-outline" label={t.users} onPress={() => router.push('/(admin)/users' as never)} />
        {aiEnabled ? (
          <QuickLink icon="sparkles-outline" label={t.assistant} onPress={() => router.push('/(admin)/assistant' as never)} />
        ) : null}
      </View>
    </Screen>
  )
}

function QuickLink({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress: () => void
}) {
  return (
    <Pressable style={styles.quickLink} onPress={onPress}>
      <View style={styles.quickLinkIcon}>
        <Ionicons name={icon} size={22} color={colors.primary} />
      </View>
      <Text style={styles.quickLinkText}>{label}</Text>
    </Pressable>
  )
}

/** رأس قسم موحّد: أيقونة + عنوان + شارة عدد اختيارية — إيقاع رأسي ثابت (16px). */
function SectionHeader({
  icon,
  title,
  count,
  tint = colors.primary,
  tintSoft = colors.primarySoft,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  count?: number
  tint?: string
  tintSoft?: string
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderRight}>
        <Ionicons name={icon} size={16} color={colors.textSecondary} />
        <Text style={styles.sectionHeaderTitle}>{title}</Text>
      </View>
      {typeof count === 'number' ? (
        <View style={[styles.sectionCount, { backgroundColor: tintSoft }]}>
          <Text style={[styles.sectionCountText, { color: tint }]}>{count}</Text>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  branchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    maxWidth: 160,
  },
  branchBadgeText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  chartCard: { marginTop: spacing.xs, gap: spacing.md },
  chartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chartTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, textAlign: 'right' },
  chartHint: { fontSize: fontSize.xs, color: colors.textMuted },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionHeaderTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, textAlign: 'right' },
  sectionCount: {
    minWidth: 24,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignItems: 'center',
  },
  sectionCountText: { fontSize: fontSize.xs, fontWeight: '800' },
  linksRow: { flexDirection: 'row', gap: spacing.md },
  quickLink: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingVertical: spacing.lg,
    ...shadow.card,
  },
  quickLinkIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLinkText: { fontSize: fontSize.sm, color: colors.text, fontWeight: '600' },
})
