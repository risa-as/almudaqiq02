import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '@/components/Screen'
import { useBranchSelection } from '@/stores/branch'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'

const t = {
  title: 'التقارير',
  pageSubtitle: 'تحليلات وتقارير الأداء',
  branchScope: 'نطاق العرض:',
  sales: 'تقرير المبيعات',
  salesHint: 'الإجماليات والفواتير حسب الفترة',
  abc: 'تحليل ABC',
  abcHint: 'تصنيف المنتجات حسب الإيراد',
  offers: 'أداء العروض',
  offersHint: 'استخدام العروض وأثرها',
  payables: 'مستحقات الموردين',
  payablesHint: 'أرصدة الموردين الدائنة',
  expenses: 'المصروفات',
  expensesHint: 'قائمة المصروفات حسب الفترة',
}

interface HubEntry {
  route: string
  icon: keyof typeof Ionicons.glyphMap
  label: string
  hint: string
  tint: string
  tintSoft: string
}

const ENTRIES: HubEntry[] = [
  { route: '/(admin)/reports/sales', icon: 'trending-up', label: t.sales, hint: t.salesHint, tint: colors.primary, tintSoft: colors.primarySoft },
  { route: '/(admin)/reports/abc', icon: 'podium-outline', label: t.abc, hint: t.abcHint, tint: colors.violet, tintSoft: colors.violetSoft },
  { route: '/(admin)/reports/offers', icon: 'pricetags-outline', label: t.offers, hint: t.offersHint, tint: colors.warning, tintSoft: colors.warningSoft },
  { route: '/(admin)/reports/payables', icon: 'wallet-outline', label: t.payables, hint: t.payablesHint, tint: colors.danger, tintSoft: colors.dangerSoft },
  { route: '/(admin)/reports/expenses', icon: 'cash-outline', label: t.expenses, hint: t.expensesHint, tint: colors.success, tintSoft: colors.successSoft },
]

export default function ReportsHub() {
  const router = useRouter()
  const { selectedBranchName } = useBranchSelection()

  return (
    <Screen title={t.title} subtitle={t.pageSubtitle}>
      <Text style={styles.scope}>
        {t.branchScope} {selectedBranchName}
      </Text>
      <View style={styles.grid}>
        {ENTRIES.map(entry => (
          <Pressable
            key={entry.route}
            style={styles.tile}
            onPress={() => router.push(entry.route as never)}
          >
            <View style={[styles.iconWrap, { backgroundColor: entry.tintSoft }]}>
              <Ionicons name={entry.icon} size={26} color={entry.tint} />
            </View>
            <Text style={styles.tileLabel} numberOfLines={1}>
              {entry.label}
            </Text>
            <Text style={styles.tileHint} numberOfLines={2}>
              {entry.hint}
            </Text>
            <View style={[styles.tileAccent, { backgroundColor: entry.tint }]} />
          </Pressable>
        ))}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  scope: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'right',
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.md,
  },
  tile: {
    width: '48.5%',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    overflow: 'hidden',
    ...shadow.card,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  tileLabel: { fontSize: fontSize.md, fontWeight: '800', color: colors.text, textAlign: 'center' },
  tileHint: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center', lineHeight: 16 },
  // شريط لوني رفيع أسفل البطاقة يميز كل تقرير
  tileAccent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    opacity: 0.9,
  },
})
