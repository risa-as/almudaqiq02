import type { ComponentProps } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { ar } from '@/i18n/ar'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'
import { formatDateTime, formatMoney } from '@/utils/format'
import { ALIGN_LEFT, ALIGN_RIGHT, ROW } from '@/utils/rtl'

type IconName = ComponentProps<typeof Ionicons>['name']

/** الحد الأدنى من حقول الفاتورة التي تعرضها البطاقة — تقبل صفوف التقارير والبث الحي معًا. */
export interface InvoiceCardData {
  id: string
  receiptNumber?: string | null
  totalAmount: number | string
  date: string
  paymentMethod?: string | null
  user?: { username: string | null } | null
  /** SALE | REFUND | RETURN — الافتراضي «بيع»؛ الإرجاع/الاسترداد يظهر بمبلغ أحمر وشارة. */
  type?: string | null
  /** خصم على الفاتورة (> 0 ⇒ شارة «خصم»). */
  discount?: number | string | null
  /** عُدّل سعر صنف عن سعر الكتالوج وقت البيع ⇒ شارة «تعديل سعر». */
  priceEdited?: boolean | null
}

/** تسميات طرق الدفع مطابقة لنافذة تفاصيل الفاتورة التي تُفتح عند النقر. */
const PAYMENT_META: Record<string, { label: string; icon: IconName; tint: string; tintSoft: string }> = {
  CASH: { label: 'نقدي', icon: 'cash-outline', tint: colors.success, tintSoft: colors.successSoft },
  CARD: { label: 'بطاقة', icon: 'card-outline', tint: colors.info, tintSoft: colors.infoSoft },
  CREDIT: { label: 'آجل', icon: 'time-outline', tint: colors.warning, tintSoft: colors.warningSoft },
  SPLIT: { label: 'مقسّم', icon: 'swap-horizontal-outline', tint: colors.violet, tintSoft: colors.violetSoft },
}

const TYPE_LABELS: Record<string, string> = {
  REFUND: 'استرداد',
  RETURN: 'إرجاع',
}

const t = {
  discount: 'خصم',
  priceEdited: 'تعديل سعر',
}

/**
 * بطاقة فاتورة موحّدة (تقرير المبيعات + الفواتير الحية):
 * سطر علوي (رقم الفاتورة + التاريخ يمينًا ↔ المبلغ يسارًا)، ثم سطر سفلي
 * (الكاشير يمينًا ↔ شارة طريقة الدفع يسارًا). عند تمرير onPress تصبح قابلة للنقر.
 * الإرجاع/الاسترداد يظهر بمبلغ أحمر وشارة نوع بجوار الرقم.
 */
export function InvoiceCard({
  tx,
  onPress,
  products,
}: {
  tx: InvoiceCardData
  onPress?: () => void
  /** أسماء أصناف الفاتورة — تُمرَّر عند البحث فقط لتوضيح سبب المطابقة (اختيارية) */
  products?: string[]
}) {
  const isSale = !tx.type || tx.type === 'SALE'
  const pay = PAYMENT_META[tx.paymentMethod ?? ''] ?? {
    label: tx.paymentMethod ?? '—',
    icon: 'wallet-outline' as IconName,
    tint: colors.textSecondary,
    tintSoft: colors.background,
  }
  const hasDiscount = Number(tx.discount ?? 0) > 0
  const priceEdited = !!tx.priceEdited

  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.invCard, pressed && styles.invCardPressed]}
    >
      <View style={styles.invTop}>
        <View style={styles.invIdGroup}>
          <View style={styles.invIconBox}>
            <Ionicons name="receipt-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.invIdCol}>
            <View style={styles.invNumberRow}>
              <Text style={styles.invNumber} numberOfLines={1}>
                #{tx.receiptNumber ?? tx.id.slice(-6)}
              </Text>
              {!isSale ? (
                <View style={styles.typeChip}>
                  <Text style={styles.typeChipText}>{TYPE_LABELS[tx.type ?? ''] ?? tx.type}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.invDate} numberOfLines={1}>
              {formatDateTime(tx.date)}
            </Text>
          </View>
        </View>
        <View style={styles.invAmountCol}>
          <Text style={[styles.invAmount, !isSale && styles.invAmountNegative]}>
            {formatMoney(tx.totalAmount)}
          </Text>
          <Text style={styles.invCurrency}>{ar.common.currency}</Text>
        </View>
      </View>

      <View style={styles.invDivider} />

      <View style={styles.invBottom}>
        <View style={styles.invCashier}>
          <Ionicons name="person-circle-outline" size={16} color={colors.textMuted} />
          <Text style={styles.invCashierName} numberOfLines={1}>
            {tx.user?.username ?? '—'}
          </Text>
        </View>
        {/* شارات الفاتورة: خصم / تعديل سعر ثم طريقة الدفع */}
        <View style={styles.invChips}>
          {hasDiscount ? (
            <View style={[styles.payChip, { backgroundColor: colors.dangerSoft }]}>
              <Ionicons name="pricetag-outline" size={13} color={colors.danger} />
              <Text style={[styles.payChipText, { color: colors.danger }]}>{t.discount}</Text>
            </View>
          ) : null}
          {priceEdited ? (
            <View style={[styles.payChip, { backgroundColor: colors.violetSoft }]}>
              <Ionicons name="create-outline" size={13} color={colors.violet} />
              <Text style={[styles.payChipText, { color: colors.violet }]}>{t.priceEdited}</Text>
            </View>
          ) : null}
          <View style={[styles.payChip, { backgroundColor: pay.tintSoft }]}>
            <Ionicons name={pay.icon} size={13} color={pay.tint} />
            <Text style={[styles.payChipText, { color: pay.tint }]}>{pay.label}</Text>
          </View>
        </View>
      </View>

      {products && products.length > 0 ? (
        <View style={styles.invProducts}>
          <Ionicons name="cube-outline" size={13} color={colors.textMuted} />
          <Text style={styles.invProductsText} numberOfLines={2}>
            {products.join(' · ')}
          </Text>
        </View>
      ) : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  invCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  invCardPressed: { opacity: 0.7 },
  invTop: { flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  invIdGroup: { flexDirection: ROW, alignItems: 'center', gap: spacing.sm, flex: 1 },
  invIconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ALIGN_RIGHT يمنع انجراف النص نحو المبلغ ويثبّت الرقم/التاريخ في جهة اليمين
  invIdCol: { flex: 1, alignItems: ALIGN_RIGHT, gap: 2 },
  invNumberRow: { flexDirection: ROW, alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  invNumber: { fontSize: fontSize.md, fontWeight: '800', color: colors.text, flexShrink: 1 },
  invDate: { fontSize: fontSize.xs, color: colors.textMuted },
  invAmountCol: { alignItems: ALIGN_LEFT, gap: 2 },
  invAmount: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text },
  invAmountNegative: { color: colors.danger },
  invCurrency: { fontSize: fontSize.xs, color: colors.textMuted },
  invDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  invBottom: { flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  invCashier: { flexDirection: ROW, alignItems: 'center', gap: spacing.xs, flexShrink: 1 },
  // الشارات قد تصبح ثلاثًا (خصم + تعديل سعر + الدفع) → تلتف بدل أن تفيض على الشاشات الضيقة
  invChips: {
    flexDirection: ROW,
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    flexShrink: 1,
  },
  invCashierName: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary, flexShrink: 1 },
  typeChip: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.dangerSoft,
  },
  typeChipText: { fontSize: fontSize.xs, fontWeight: '700', color: colors.danger },
  payChip: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  payChipText: { fontSize: fontSize.xs, fontWeight: '700' },
  invProducts: {
    flexDirection: ROW,
    alignItems: 'flex-start',
    gap: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  invProductsText: { flex: 1, fontSize: fontSize.xs, color: colors.textSecondary, textAlign: 'right', lineHeight: 17 },
})
