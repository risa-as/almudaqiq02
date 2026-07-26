import { StyleSheet, Text, View } from 'react-native'
import type { ExpiryRow, ExpiryUrgency, LowStockAlert } from '@/api/endpoints/inventory'
import { colors, fontSize, radius, spacing } from '@/theme'
import { formatDate, formatMoney } from '@/utils/format'
import { ALIGN_RIGHT, ROW } from '@/utils/rtl'

const t = {
  currentStock: 'الرصيد',
  minStock: 'الحد الأدنى',
  qty: 'الكمية',
  expired: 'منتهية',
  daysLeft: (d: number) => `متبقٍ ${d} يوم`,
}

/** الحد الأدنى الافتراضي حين لا يُضبط للمنتج — مطابق لـ /api/inventory/alerts */
const DEFAULT_MIN_STOCK = 10

/** لون نصّ الاستعجال ولون الخلفية الناعمة معًا حسب درجة قرب الانتهاء. */
export function urgencyTone(u: ExpiryUrgency): { tint: string; soft: string } {
  switch (u) {
    case 'expired':
    case 'critical':
      return { tint: colors.danger, soft: colors.dangerSoft }
    case 'warning':
      return { tint: colors.warning, soft: colors.warningSoft }
    default:
      return { tint: colors.textSecondary, soft: colors.background }
  }
}

/** صفّ منتج تحت الحد الأدنى — مشترك بين معاينة «المزيد» وشاشة التنبيهات الكاملة. */
export function LowStockRow({ item }: { item: LowStockAlert }) {
  return (
    <View style={styles.alertRow}>
      <View style={styles.alertInfo}>
        <Text style={styles.alertName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.alertMeta} numberOfLines={1}>
          {t.minStock}: {item.minimumStock > 0 ? item.minimumStock : DEFAULT_MIN_STOCK}
        </Text>
      </View>
      <View style={[styles.statChip, { backgroundColor: colors.dangerSoft }]}>
        <Text style={[styles.statValue, { color: colors.danger }]}>{formatMoney(item.baseStock)}</Text>
        <Text style={styles.statLabel}>{t.currentStock}</Text>
      </View>
    </View>
  )
}

/** صفّ دفعة تقترب صلاحيتها — مشترك بين المعاينة والشاشة الكاملة. */
export function ExpiringBatchRow({ item }: { item: ExpiryRow }) {
  const tone = urgencyTone(item.urgency)
  return (
    <View style={styles.alertRow}>
      <View style={styles.alertInfo}>
        <Text style={styles.alertName} numberOfLines={1}>{item.productName}</Text>
        <Text style={styles.alertMeta} numberOfLines={1}>
          {t.qty}: {formatMoney(item.quantity)} • {formatDate(item.expiryDate)}
        </Text>
      </View>
      <View style={[styles.urgencyChip, { backgroundColor: tone.soft }]}>
        <Text style={[styles.urgencyText, { color: tone.tint }]} numberOfLines={1}>
          {item.daysLeft === null ? '—' : item.daysLeft < 0 ? t.expired : t.daysLeft(item.daysLeft)}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // صف تنبيه: كتلة الاسم/التفاصيل يمينًا ← شارة القيمة يسارًا، يفصلها خطّ شعري
  alertRow: {
    flexDirection: ROW,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  alertInfo: { flex: 1, gap: 3, alignItems: ALIGN_RIGHT },
  alertName: { color: colors.text, fontSize: fontSize.sm, fontWeight: '600', textAlign: 'right' },
  alertMeta: { color: colors.textSecondary, fontSize: fontSize.xs, textAlign: 'right' },
  // شارة إحصائية صغيرة (الرصيد الحالي) على شكل StatCard مصغّر — يسار الصف
  statChip: {
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    gap: 1,
  },
  statValue: { fontSize: fontSize.md, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '600', color: colors.textMuted },
  // شارة الاستعجال (متبقٍ N يوم / منتهية) — يسار الصف
  urgencyChip: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  urgencyText: { fontSize: fontSize.xs, fontWeight: '800' },
})
