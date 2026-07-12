import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '@/components/Screen'
import { useBranchSelection } from '@/stores/branch'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'

const t = {
  title: 'التقارير',
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
    <Screen title={t.title}>
      <Text style={styles.scope}>
        {t.branchScope} {selectedBranchName}
      </Text>
      <View style={styles.list}>
        {ENTRIES.map(entry => (
          <Pressable
            key={entry.route}
            style={styles.card}
            onPress={() => router.push(entry.route as never)}
          >
            <View style={[styles.iconWrap, { backgroundColor: entry.tintSoft }]}>
              <Ionicons name={entry.icon} size={24} color={entry.tint} />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardLabel}>{entry.label}</Text>
              <Text style={styles.cardHint}>{entry.hint}</Text>
            </View>
            <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
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
  list: { gap: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    ...shadow.card,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.lg - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: { flex: 1, gap: 2 },
  cardLabel: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, textAlign: 'right' },
  cardHint: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'right' },
})
