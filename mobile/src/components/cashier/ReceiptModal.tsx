import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { formatDateTime, formatMoney } from '@/utils/format'
import { ar } from '@/i18n/ar'
import { colors, fontSize, radius, spacing } from '@/theme'
import { paymentLabel } from './constants'

// نصوص خاصة بملخص الإيصال
const t = {
  title: 'تم تسجيل الفاتورة',
  receiptNo: 'رقم الفاتورة',
  subtotal: 'المجموع',
  discount: 'الخصم',
  total: 'الإجمالي',
  paid: 'المدفوع',
  change: 'الباقي',
  remaining: 'المتبقي (دين)',
  method: 'طريقة الدفع',
  customer: 'العميل',
  done: 'فاتورة جديدة',
}

export interface ReceiptLine {
  name: string
  unitName: string
  qty: number
  price: number
}

export interface ReceiptData {
  receiptNumber: string
  date: string
  lines: ReceiptLine[]
  subtotal: number
  discount: number
  total: number
  /** ما دفعه العميل فعليًا (للنقدي: المبلغ المستلم إن أُدخل) */
  paid: number
  /** الباقي المعاد للعميل (نقدي فقط) */
  change: number
  method: 'CASH' | 'CARD' | 'CREDIT'
  customerName?: string | null
}

interface ReceiptModalProps {
  visible: boolean
  receipt: ReceiptData | null
  onClose: () => void
}

/** ملخص الإيصال بعد نجاح البيع (US2-AS4): البنود والإجمالي والمدفوع والباقي. */
export function ReceiptModal({ visible, receipt, onClose }: ReceiptModalProps) {
  if (!receipt) return null

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.successHeader}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark" size={30} color={colors.onPrimary} />
            </View>
            <Text style={styles.title}>{t.title}</Text>
            <Text style={styles.meta}>
              {t.receiptNo}: {receipt.receiptNumber} · {formatDateTime(receipt.date)}
            </Text>
          </View>

          <ScrollView style={styles.linesScroll} contentContainerStyle={styles.lines}>
            {receipt.lines.map((line, idx) => (
              <View key={idx} style={styles.lineRow}>
                <View style={styles.lineInfo}>
                  <Text style={styles.lineName} numberOfLines={1}>
                    {line.name}
                  </Text>
                  <Text style={styles.lineMeta}>
                    {line.unitName} × {formatMoney(line.qty)}
                  </Text>
                </View>
                <Text style={styles.lineTotal}>{formatMoney(line.price * line.qty)}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.totals}>
            {receipt.discount > 0 ? (
              <>
                <SummaryRow label={t.subtotal} value={formatMoney(receipt.subtotal)} />
                <SummaryRow label={t.discount} value={`-${formatMoney(receipt.discount)}`} tint={colors.danger} />
              </>
            ) : null}
            <SummaryRow label={t.total} value={`${formatMoney(receipt.total)} ${ar.common.currency}`} bold />
            <SummaryRow label={t.method} value={paymentLabel(receipt.method)} />
            {receipt.customerName ? <SummaryRow label={t.customer} value={receipt.customerName} /> : null}
            {receipt.method === 'CREDIT' ? (
              <SummaryRow label={t.remaining} value={formatMoney(receipt.total)} tint={colors.warning} />
            ) : (
              <>
                <SummaryRow label={t.paid} value={formatMoney(receipt.paid)} />
                {receipt.change > 0 ? (
                  <SummaryRow label={t.change} value={formatMoney(receipt.change)} tint={colors.success} bold />
                ) : null}
              </>
            )}
          </View>

          <Pressable style={styles.doneButton} onPress={onClose}>
            <Text style={styles.doneText}>{t.done}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

function SummaryRow({ label, value, tint, bold }: { label: string; value: string; tint?: string; bold?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, bold && styles.summaryBold]}>{label}</Text>
      <Text style={[styles.summaryValue, bold && styles.summaryBold, tint ? { color: tint } : null]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  successHeader: { alignItems: 'center', gap: spacing.sm },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text },
  meta: { fontSize: fontSize.sm, color: colors.textSecondary },
  linesScroll: { maxHeight: 220 },
  lines: { gap: spacing.sm },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lineInfo: { flex: 1, gap: 2 },
  lineName: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, textAlign: 'right' },
  lineMeta: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'right' },
  lineTotal: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text },
  totals: { gap: spacing.xs },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  summaryValue: { fontSize: fontSize.sm, color: colors.text, fontWeight: '600' },
  summaryBold: { fontSize: fontSize.md, fontWeight: '800', color: colors.text },
  doneButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
  },
  doneText: { color: colors.onPrimary, fontSize: fontSize.md, fontWeight: '700' },
})
