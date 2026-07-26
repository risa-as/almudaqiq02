import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { fetchTransaction, type TransactionDetail } from '@/api/endpoints/reports'
import { ErrorState } from '@/components/ErrorState'
import { ar } from '@/i18n/ar'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'
import { formatDateTime, formatMoney } from '@/utils/format'
import { ALIGN_RIGHT, ROW } from '@/utils/rtl'

const t = {
  title: 'تفاصيل الفاتورة',
  invoice: 'فاتورة',
  items: 'الأصناف',
  qty: 'الكمية',
  unitPrice: 'السعر',
  lineTotal: 'الإجمالي',
  subtotal: 'المجموع الفرعي',
  discount: 'الخصم',
  tax: 'الضريبة',
  total: 'الإجمالي',
  paid: 'المدفوع',
  remaining: 'المتبقي',
  paymentMethod: 'طريقة الدفع',
  cashier: 'الكاشير',
  customer: 'العميل',
  date: 'التاريخ',
  notes: 'ملاحظات',
  noItems: 'لا توجد أصناف',
  loadingItems: 'جارٍ تحميل الأصناف…',
  close: 'إغلاق',
  each: 'للوحدة',
  discountFlag: 'خصم',
  priceEditedFlag: 'تعديل سعر',
  edited: 'سعر معدّل',
  wasPrice: 'السعر الأصلي',
}

/** تعديل سعر السطر: نفس قاعدة نقطة البيع — مقارنة سعر البيع بسعر كتالوج الوحدة بسماحية 0.01. */
function priceEditOf(catalog: number, sold: number): boolean {
  return catalog > 0 && Math.abs(sold - catalog) > 0.01
}

const TYPE_META: Record<string, { label: string; tint: string; tintSoft: string }> = {
  SALE: { label: 'بيع', tint: colors.success, tintSoft: colors.successSoft },
  RETURN: { label: 'إرجاع', tint: colors.warning, tintSoft: colors.warningSoft },
  REFUND: { label: 'استرجاع', tint: colors.danger, tintSoft: colors.dangerSoft },
}

const PAYMENT_LABEL: Record<string, string> = {
  CASH: 'نقدي',
  CREDIT: 'آجل',
  SPLIT: 'مقسّم',
}

/**
 * صف قائمة كافٍ للعرض الفوري ريثما تصل التفاصيل — تقبل صفوف البث الحي وتقرير
 * المبيعات معًا (كل الحقول عدا الأصناف موجودة أصلًا في البطاقة المنقورة).
 */
export interface InvoicePreview {
  id: string
  receiptNumber?: string | null
  type?: string | null
  date: string
  totalAmount: number | string
  discount?: number | string | null
  paidAmount?: number | string | null
  paymentMethod?: string | null
  priceEdited?: boolean | null
  user?: { username: string | null } | null
  customer?: { name: string | null } | null
}

/** نموذج العرض الموحّد: تفاصيل كاملة، أو معاينة من صف القائمة (items = null ⇒ ما زالت تُحمَّل). */
interface InvoiceView {
  id: string
  receiptNumber?: string | null
  type?: string | null
  date: string
  totalAmount: number | string
  discount?: number | string | null
  taxAmount?: number | string | null
  paidAmount?: number | string | null
  paymentMethod?: string | null
  priceEdited?: boolean | null
  notes?: string | null
  user?: { username: string | null } | null
  customer?: { name: string | null; phone?: string | null } | null
  items: TransactionDetail['items'] | null
}

interface InvoiceDetailModalProps {
  visible: boolean
  /** معرّف الفاتورة (أو null عند الإغلاق). */
  transactionId: string | null
  /** الفرع المحدد — لعزل الفروع في نداء التفاصيل. */
  branchId: string | null
  /** صف القائمة المنقور — يُعرض فورًا وتُحمَّل الأصناف وحدها من الخادم. */
  preview?: InvoicePreview | null
  onClose: () => void
}

/** نافذة عرض تفاصيل فاتورة (للقراءة فقط) — تعرض صف القائمة فورًا وتكمل الأصناف من الخادم. */
export function InvoiceDetailModal({ visible, transactionId, branchId, preview, onClose }: InvoiceDetailModalProps) {
  // الفاتورة لا تتغيّر بعد إنشائها، لذا نُبقي الكاش (إعادة فتح نفس الفاتورة فورية)
  // مع staleTime:0 الافتراضي ⇒ إعادة جلب صامتة في الخلفية عند كل فتح.
  const q = useQuery({
    queryKey: ['transaction-detail', transactionId, branchId],
    queryFn: () => fetchTransaction(transactionId as string, branchId),
    enabled: visible && !!transactionId,
    refetchOnWindowFocus: false,
  })

  const tx: InvoiceView | null = q.data ?? (preview ? { ...preview, items: null } : null)

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.cardTitle}>{t.title}</Text>
              {tx ? (
                <Text style={styles.receiptNo}>
                  {t.invoice} #{tx.receiptNumber ?? tx.id.slice(-6)}
                </Text>
              ) : null}
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          {q.isError ? (
            <View style={styles.centerBox}>
              <ErrorState error={q.error} onRetry={() => void q.refetch()} />
            </View>
          ) : tx ? (
            <InvoiceBody tx={tx} />
          ) : q.isPending ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : null}

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>{t.close}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

function InvoiceBody({ tx }: { tx: InvoiceView }) {
  const meta = TYPE_META[tx.type ?? 'SALE'] ?? TYPE_META.SALE
  const discount = Number(tx.discount ?? 0)
  const tax = Number(tx.taxAmount ?? 0)
  const total = Number(tx.totalAmount ?? 0)
  // مجموع سطور الأصناف (قبل الخصم/الضريبة) — لعرض المجموع الفرعي عند وجود خصم/ضريبة.
  const itemsSum = (tx.items ?? []).reduce((s, it) => s + Number(it.quantity) * Number(it.price), 0)
  const paid = tx.paidAmount === null || tx.paidAmount === undefined ? null : Number(tx.paidAmount)
  const remaining = paid !== null ? total - paid : null

  return (
    <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
      {/* شريط الحالة والشارات والتاريخ */}
      <View style={styles.metaRow}>
        <View style={styles.badgeGroup}>
          <View style={[styles.typeBadge, { backgroundColor: meta.tintSoft }]}>
            <Text style={[styles.typeBadgeText, { color: meta.tint }]}>{meta.label}</Text>
          </View>
          {discount > 0 ? (
            <View style={[styles.flagBadge, { backgroundColor: colors.dangerSoft }]}>
              <Ionicons name="pricetag-outline" size={12} color={colors.danger} />
              <Text style={[styles.flagBadgeText, { color: colors.danger }]}>{t.discountFlag}</Text>
            </View>
          ) : null}
          {tx.priceEdited ? (
            <View style={[styles.flagBadge, { backgroundColor: colors.violetSoft }]}>
              <Ionicons name="create-outline" size={12} color={colors.violet} />
              <Text style={[styles.flagBadgeText, { color: colors.violet }]}>{t.priceEditedFlag}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.metaDate}>{formatDateTime(tx.date)}</Text>
      </View>

      {/* معلومات علوية */}
      <View style={styles.infoGrid}>
        <InfoLine icon="person-outline" label={t.cashier} value={tx.user?.username ?? '—'} />
        {tx.customer?.name ? (
          <InfoLine icon="people-outline" label={t.customer} value={tx.customer.name} />
        ) : null}
        <InfoLine
          icon="card-outline"
          label={t.paymentMethod}
          value={PAYMENT_LABEL[tx.paymentMethod ?? ''] ?? tx.paymentMethod ?? '—'}
        />
      </View>

      {/* جدول الأصناف — items = null ⇒ المعاينة الفورية ظاهرة والأصناف ما زالت تُحمَّل */}
      <Text style={styles.sectionLabel}>{t.items}</Text>
      <View style={styles.itemsBox}>
        {tx.items === null ? (
          <View style={styles.itemsLoading}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.itemsLoadingText}>{t.loadingItems}</Text>
          </View>
        ) : tx.items.length === 0 ? (
          <Text style={styles.noItems}>{t.noItems}</Text>
        ) : (
          tx.items.map((it, i) => {
            const qty = Number(it.quantity)
            const price = Number(it.price)
            const catalog = Number(it.unit?.price ?? 0)
            const edited = priceEditOf(catalog, price)
            return (
              <View key={it.id} style={[styles.itemRow, i > 0 && styles.itemDivider]}>
                <View style={styles.itemInfo}>
                  <View style={styles.itemNameRow}>
                    <Text style={styles.itemName} numberOfLines={2}>
                      {it.product?.name ?? '—'}
                    </Text>
                    {edited ? (
                      <View style={styles.editedBadge}>
                        <Ionicons name="create-outline" size={10} color={colors.violet} />
                        <Text style={styles.editedBadgeText}>{t.edited}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.itemMeta}>
                    {qty} {it.unit?.name ?? ''} × {formatMoney(price)} {t.each}
                  </Text>
                  {edited ? (
                    <Text style={styles.itemWas}>
                      {t.wasPrice}: <Text style={styles.itemWasStrike}>{formatMoney(catalog)}</Text>
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.itemTotal}>{formatMoney(qty * price)}</Text>
              </View>
            )
          })
        )}
      </View>

      {/* ملخص المبالغ — المجموع الفرعي يحتاج مجموع الأصناف فلا يظهر قبل وصولها */}
      <View style={styles.summaryBox}>
        {tx.items && (discount > 0 || tax > 0) ? (
          <SummaryLine label={t.subtotal} value={formatMoney(itemsSum)} />
        ) : null}
        {discount > 0 ? (
          <SummaryLine label={t.discount} value={`- ${formatMoney(discount)}`} tint={colors.danger} />
        ) : null}
        {tax > 0 ? <SummaryLine label={t.tax} value={formatMoney(tax)} /> : null}
        <View style={styles.totalDivider} />
        <SummaryLine label={t.total} value={formatMoney(total)} strong />
        {paid !== null ? <SummaryLine label={t.paid} value={formatMoney(paid)} /> : null}
        {remaining !== null && remaining > 0 ? (
          <SummaryLine label={t.remaining} value={formatMoney(remaining)} tint={colors.danger} />
        ) : null}
      </View>

      {tx.notes ? (
        <View style={styles.notesBox}>
          <Text style={styles.sectionLabel}>{t.notes}</Text>
          <Text style={styles.notesText}>{tx.notes}</Text>
        </View>
      ) : null}
    </ScrollView>
  )
}

function InfoLine({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
}) {
  return (
    <View style={styles.infoLine}>
      <View style={styles.infoLabelWrap}>
        <Ionicons name={icon} size={14} color={colors.textMuted} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  )
}

function SummaryLine({
  label,
  value,
  strong,
  tint,
}: {
  label: string
  value: string
  strong?: boolean
  tint?: string
}) {
  return (
    <View style={styles.summaryLine}>
      <Text style={[styles.summaryLabel, strong && styles.summaryLabelStrong]}>{label}</Text>
      <Text style={[styles.summaryValue, strong && styles.summaryValueStrong, tint ? { color: tint } : null]}>
        {value} <Text style={styles.currency}>{ar.common.currency}</Text>
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxHeight: '88%',
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.elevated,
  },
  cardHeader: { flexDirection: ROW, alignItems: 'flex-start', justifyContent: 'space-between' },
  headerTitleWrap: { gap: 2, flex: 1 },
  cardTitle: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text, textAlign: 'right' },
  receiptNo: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '600', textAlign: 'right' },
  centerBox: { paddingVertical: spacing.xxl, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexGrow: 0, flexShrink: 1 },
  metaRow: { flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.md },
  // النوع + شارات (خصم/تعديل سعر) — تلتف على الشاشات الضيقة بدل أن تدفع التاريخ خارجًا
  badgeGroup: { flexDirection: ROW, alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs, flexShrink: 1 },
  typeBadge: { borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 3 },
  typeBadgeText: { fontSize: fontSize.xs, fontWeight: '700' },
  flagBadge: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  flagBadgeText: { fontSize: fontSize.xs, fontWeight: '700' },
  metaDate: { fontSize: fontSize.xs, color: colors.textMuted },
  infoGrid: {
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  infoLine: { flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  infoLabelWrap: { flexDirection: ROW, alignItems: 'center', gap: spacing.xs },
  infoLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  infoValue: { fontSize: fontSize.sm, color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'left' },
  sectionLabel: { fontSize: fontSize.xs, fontWeight: '700', color: colors.textSecondary, textAlign: 'right', marginBottom: spacing.sm },
  itemsBox: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  // ROW يضع كتلة الاسم/الكمية/السعر في جهة اليمين والمبلغ في اليسار مهما كان اتجاه النظام
  itemRow: { flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.sm },
  itemDivider: { borderTopWidth: 1, borderTopColor: colors.borderSoft },
  itemInfo: { flex: 1, gap: 3, alignItems: ALIGN_RIGHT },
  itemNameRow: { flexDirection: ROW, alignItems: 'center', gap: spacing.xs, flexShrink: 1 },
  itemName: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, textAlign: 'right', flexShrink: 1 },
  itemMeta: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'right', writingDirection: 'rtl' },
  itemTotal: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text, textAlign: 'left' },
  // شارة «سعر معدّل» + السعر الأصلي مشطوبًا
  editedBadge: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.violetSoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 1,
  },
  editedBadgeText: { fontSize: 10, fontWeight: '700', color: colors.violet },
  itemWas: { fontSize: fontSize.xs, color: colors.violet, fontWeight: '600', textAlign: 'right', writingDirection: 'rtl' },
  itemWasStrike: { textDecorationLine: 'line-through', color: colors.textMuted, fontWeight: '700' },
  summaryBox: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  summaryLine: { flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between' },
  summaryLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  summaryLabelStrong: { fontSize: fontSize.md, fontWeight: '800', color: colors.text },
  summaryValue: { fontSize: fontSize.sm, color: colors.text, fontWeight: '600' },
  summaryValueStrong: { fontSize: fontSize.md, fontWeight: '800', color: colors.primary },
  currency: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: '600' },
  totalDivider: { height: 1, backgroundColor: colors.border, marginVertical: 2 },
  noItems: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.md },
  itemsLoading: {
    flexDirection: ROW,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  itemsLoadingText: { fontSize: fontSize.xs, color: colors.textMuted },
  notesBox: { marginTop: spacing.md },
  notesText: {
    fontSize: fontSize.sm,
    color: colors.text,
    textAlign: 'right',
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.md,
    lineHeight: 20,
  },
  closeBtn: {
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  closeText: { color: colors.textSecondary, fontWeight: '700', fontSize: fontSize.sm },
})
