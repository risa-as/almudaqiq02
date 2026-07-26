import { StyleSheet, Text, View, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { fetchExpiryReport, fetchInventoryAlerts } from '@/api/endpoints/inventory'
import { AccountCard } from '@/components/AccountCard'
import { Hero } from '@/components/Hero'
import { Screen } from '@/components/Screen'
import { ExpiringBatchRow, LowStockRow } from '@/components/stock/AlertRows'
import { ar } from '@/i18n/ar'
import { useAuthStore } from '@/stores/auth'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'
import { formatDate } from '@/utils/format'
import { greetingFor } from '@/utils/greeting'
import { ROW } from '@/utils/rtl'


const S = {
  alerts: 'التنبيهات',
  lowStock: 'منتجات تحت الحد الأدنى',
  nearExpiry: 'دفعات تقترب صلاحيتها من الانتهاء',
  noLowStock: 'لا توجد منتجات تحت الحد الأدنى',
  noNearExpiry: 'لا توجد دفعات قريبة الانتهاء',
  loading: 'جارٍ التحميل…',
  loadFailed: 'تعذر تحميل التنبيهات',
  navigate: 'أقسام أخرى',
  suppliers: 'الموردون',
  allAlerts: 'كل التنبيهات',
  viewAll: (n: number) => `عرض الكل (${n})`,
}

const MAX_ROWS = 8

/** زرّ أسفل بطاقة التنبيه يفتح الشاشة الكاملة على القسم المطلوب. */
function ViewAllButton({ count, tab }: { count: number; tab: 'low' | 'expiry' }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.viewAll, pressed && styles.viewAllPressed]}
      onPress={() => router.push({ pathname: '/(stock)/alerts', params: { tab } })}
    >
      <Text style={styles.viewAllText}>{S.viewAll(count)}</Text>
      <Ionicons name="chevron-back" size={15} color={colors.primary} />
    </Pressable>
  )
}

export default function StockMore() {
  const user = useAuthStore(s => s.user)
  const branchId = user?.branchId ?? null

  const alertsQuery = useQuery({
    queryKey: ['inventory-alerts', branchId],
    queryFn: () => fetchInventoryAlerts(branchId),
  })

  const expiryQuery = useQuery({
    queryKey: ['inventory-expiry', '30', branchId],
    queryFn: () => fetchExpiryReport('30', branchId),
  })

  const lowStock = alertsQuery.data?.lowStock ?? []
  // العدد الحقيقي من الخادم — قائمة المعاينة مقتطعة إلى 10 صفوف
  const lowStockTotal = alertsQuery.data?.counts?.lowStock ?? lowStock.length
  const expiryAll = expiryQuery.data?.batches ?? []
  const expiryRows = expiryAll.slice(0, MAX_ROWS)

  return (
    <Screen
      title={ar.tabs.more}
      refreshing={alertsQuery.isRefetching || expiryQuery.isRefetching}
      onRefresh={() => {
        alertsQuery.refetch()
        expiryQuery.refetch()
      }}
    >
      {/* ── الهيدر البطولي ── */}
      <Hero
        greeting={greetingFor(user?.username)}
        title={user?.tenantName || ar.appName}
        icon="cube"
        chips={[
          { icon: 'calendar-outline', text: formatDate(new Date()) },
          { icon: 'card-outline', text: 'أمين المخزن' },
        ]}
      />

      {/* ── التنبيهات: تحت الحد الأدنى ── */}
      <Text style={styles.sectionTitle}>{S.alerts}</Text>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconWrap, { backgroundColor: colors.warningSoft }]}>
            <Ionicons name="trending-down" size={18} color={colors.warning} />
          </View>
          <Text style={styles.cardTitle} numberOfLines={1}>{S.lowStock}</Text>
          {lowStockTotal > 0 ? (
            <View style={[styles.countBadge, { backgroundColor: colors.warningSoft }]}>
              <Text style={[styles.countText, { color: colors.warning }]}>{lowStockTotal}</Text>
            </View>
          ) : null}
        </View>

        {alertsQuery.isLoading ? (
          <Text style={styles.hint}>{S.loading}</Text>
        ) : alertsQuery.isError ? (
          <Text style={[styles.hint, { color: colors.danger }]}>{S.loadFailed}</Text>
        ) : lowStock.length === 0 ? (
          <Text style={[styles.hint, { color: colors.success }]}>{S.noLowStock}</Text>
        ) : (
          <>
            <View style={styles.list}>
              {lowStock.slice(0, MAX_ROWS).map(p => (
                <LowStockRow key={p.id} item={p} />
              ))}
            </View>
            <ViewAllButton count={lowStockTotal} tab="low" />
          </>
        )}
      </View>

      {/* ── التنبيهات: قرب انتهاء الصلاحية ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconWrap, { backgroundColor: colors.dangerSoft }]}>
            <Ionicons name="time-outline" size={18} color={colors.danger} />
          </View>
          <Text style={styles.cardTitle} numberOfLines={1}>{S.nearExpiry}</Text>
          {expiryAll.length > 0 ? (
            <View style={[styles.countBadge, { backgroundColor: colors.dangerSoft }]}>
              <Text style={[styles.countText, { color: colors.danger }]}>{expiryAll.length}</Text>
            </View>
          ) : null}
        </View>

        {expiryQuery.isLoading ? (
          <Text style={styles.hint}>{S.loading}</Text>
        ) : expiryQuery.isError ? (
          <Text style={[styles.hint, { color: colors.danger }]}>{S.loadFailed}</Text>
        ) : expiryRows.length === 0 ? (
          <Text style={[styles.hint, { color: colors.success }]}>{S.noNearExpiry}</Text>
        ) : (
          <>
            <View style={styles.list}>
              {expiryRows.map(b => (
                <ExpiringBatchRow key={b.id} item={b} />
              ))}
            </View>
            <ViewAllButton count={expiryAll.length} tab="expiry" />
          </>
        )}
      </View>

      {/* ── روابط الأقسام ── */}
      <Text style={styles.sectionTitle}>{S.navigate}</Text>

      <Pressable
        style={({ pressed }) => [styles.navRow, pressed && styles.navRowPressed]}
        onPress={() => router.push('/(stock)/alerts')}
      >
        <View style={[styles.iconWrap, { backgroundColor: colors.warningSoft }]}>
          <Ionicons name="notifications" size={18} color={colors.warning} />
        </View>
        <Text style={styles.navLabel}>{S.allAlerts}</Text>
        <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.navRow, pressed && styles.navRowPressed]}
        onPress={() => router.push('/(stock)/suppliers')}
      >
        <View style={[styles.iconWrap, { backgroundColor: colors.violetSoft }]}>
          <Ionicons name="people" size={18} color={colors.violet} />
        </View>
        <Text style={styles.navLabel}>{S.suppliers}</Text>
        <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
      </Pressable>

      {/* بطاقة الحساب وتسجيل الخروج تبقى في الأسفل (FR-005) */}
      <View style={styles.accountWrap}>
        <AccountCard />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'right',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  // الأيقونة يمينًا ← العنوان ← عدّاد يسارًا (row-reverse لترتيب عربي صحيح)
  cardHeader: { flexDirection: ROW, alignItems: 'center', gap: spacing.sm },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { flex: 1, color: colors.text, fontSize: fontSize.sm, fontWeight: '700', textAlign: 'right' },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { fontSize: fontSize.xs, fontWeight: '800' },
  hint: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center', paddingVertical: spacing.sm },
  list: { marginTop: spacing.xs },
  // أنماط صفوف التنبيهات انتقلت إلى components/stock/AlertRows (مشتركة مع شاشة التنبيهات)
  viewAll: {
    flexDirection: ROW,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  viewAllPressed: { opacity: 0.7 },
  viewAllText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '800' },
  // الأيقونة يمينًا ← التسمية ← سهم يسارًا (row-reverse)
  navRow: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    ...shadow.card,
  },
  navRowPressed: { backgroundColor: colors.background },
  navLabel: { flex: 1, color: colors.text, fontSize: fontSize.md, fontWeight: '600', textAlign: 'right' },
  accountWrap: { marginTop: spacing.md },
})
