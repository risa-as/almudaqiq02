import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { ApiError } from '@/api/client'
import { fetchActiveShift, shiftKeys } from '@/api/endpoints/shifts'
import {
  fetchTransaction,
  fetchTransactions,
  invoiceDetailKey,
  invoiceSearchKey,
  refundTransaction,
  returnItems,
  shiftInvoicesKey,
  type TransactionDetail,
  type TransactionItemDto,
  type TransactionListItem,
} from '@/api/endpoints/transactions'
import { AlertHost, appAlert } from '@/components/AppAlert'
import { paymentLabel } from '@/components/cashier/constants'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { InvoiceCard } from '@/components/admin/InvoiceCard'
import { LoadingView } from '@/components/LoadingView'
import { Screen } from '@/components/Screen'
import { useAuthStore } from '@/stores/auth'
import { formatDateTime, formatMoney } from '@/utils/format'
import { ar } from '@/i18n/ar'
import { colors, control, fontSize, radius, shadow, spacing } from '@/theme'
import { ALIGN_RIGHT, ROW } from '@/utils/rtl'

// نصوص خاصة بشاشة الفواتير
const t = {
  title: 'فواتيري',
  noShiftTitle: 'لا توجد وردية مفتوحة',
  noShift: 'تعرض هذه الشاشة فواتير الوردية الحالية فقط',
  empty: 'لا توجد فواتير في هذه الوردية بعد',
  receiptNo: 'فاتورة',
  date: 'التاريخ',
  detailTitle: 'تفاصيل الفاتورة',
  linesTitle: 'البنود',
  qty: 'الكمية',
  returnQty: 'كمية الإرجاع',
  remaining: (n: number) => `المتبقّي للإرجاع: ${formatMoney(n)}`,
  returnedSome: (n: number) => `أُرجع ${formatMoney(n)}`,
  returnedAll: 'أُرجع بالكامل',
  nothingReturnable: 'لا توجد كمية قابلة للإرجاع في هذه الفاتورة',
  total: 'الإجمالي',
  discount: 'الخصم',
  method: 'طريقة الدفع',
  customer: 'العميل',
  returnSelected: 'إرجاع المحدد',
  fullRefund: 'استرداد كامل',
  confirmReturnTitle: 'تأكيد الإرجاع',
  confirmReturnMessage: (amount: string) => `سيتم إرجاع بنود بقيمة ${amount}. هل أنت متأكد؟`,
  confirmRefundTitle: 'تأكيد الاسترداد الكامل',
  confirmRefundMessage: (amount: string) =>
    `سيتم استرداد الفاتورة كاملة بقيمة ${amount} وإعادة المنتجات للمخزون. هل أنت متأكد؟`,
  returnSuccess: 'تم تسجيل الإرجاع وإعادة الكميات للمخزون',
  refundSuccess: 'تم استرداد الفاتورة وإعادة المنتجات للمخزون',
  failTitle: 'فشلت العملية',
  successTitle: 'تمت العملية',
  processing: 'جارٍ التنفيذ…',
  searchPlaceholder: 'رقم الفاتورة أو اسم الصنف…',
  searchHint: 'اكتب حرفين على الأقل للبحث',
  searchScope: (count: number) =>
    `${count} ${count === 1 ? 'نتيجة' : 'نتائج'} · تشمل فواتيرك خارج الوردية الحالية`,
  searchEmpty: 'لا توجد فاتورة مطابقة',
}

const SEARCH_DEBOUNCE_MS = 300
const MIN_SEARCH_LENGTH = 2
/** عدد أسماء الأصناف المعروضة على بطاقة نتيجة البحث قبل الاختصار */
const MAX_SHOWN_PRODUCTS = 3

/** يرتّب أصناف الفاتورة بحيث يظهر المطابق للبحث أولاً، ثم يختصر الباقي. */
function summarizeProducts(names: string[], query: string): string[] {
  const needle = query.toLowerCase()
  const ordered = needle
    ? [...names].sort(
        (a, b) => Number(b.toLowerCase().includes(needle)) - Number(a.toLowerCase().includes(needle)),
      )
    : names
  const shown = ordered.slice(0, MAX_SHOWN_PRODUCTS)
  const rest = ordered.length - shown.length
  // «و+N» وليس «+N» وحدها، حتى لا تُقرأ كاسم صنف رابع داخل السطر المفصول بنقاط
  return rest > 0 ? [...shown, `و+${rest}`] : shown
}

export default function InvoicesScreen() {
  const user = useAuthStore(s => s.user)
  const queryClient = useQueryClient()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [returnQty, setReturnQty] = useState<Record<string, number>>({})
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchInput])

  // «#» يظهر على البطاقة أمام رقم الفاتورة، فالمستخدم يعيد كتابته — نزيله قبل الإرسال
  const searchQueryText = debouncedSearch.replace(/^#/, '')
  const searching = searchQueryText.length >= MIN_SEARCH_LENGTH

  // ── وردية الكاشير الحالية ────────────────────────────────────────────────
  const shiftQuery = useQuery({ queryKey: shiftKeys.active, queryFn: fetchActiveShift })
  const activeShift = shiftQuery.data?.activeShift ?? null
  const branchId = activeShift?.branchId ?? user?.branchId ?? null

  // ── فواتير الفرع → تصفية محلية على (المستخدم + وقت فتح الوردية) ──────────
  const invoicesQuery = useQuery({
    queryKey: shiftInvoicesKey(branchId),
    queryFn: () => fetchTransactions({ limit: 100, branchId }),
    enabled: !!activeShift,
  })

  const shiftInvoices = useMemo(() => {
    if (!activeShift || !invoicesQuery.data) return []
    const openedAt = new Date(activeShift.openedAt).getTime()
    return invoicesQuery.data.filter(
      tx =>
        tx.userId === user?.id &&
        (tx.type === 'SALE' || tx.type === 'RETURN' || tx.type === 'REFUND') &&
        new Date(tx.date).getTime() >= openedAt,
    )
  }, [activeShift, invoicesQuery.data, user?.id])

  // ── بحث الفواتير: برقم الفاتورة أو باسم صنف مبيع داخلها ──────────────────
  // يتجاوز حدود الوردية الحالية عمدًا (الكاشير يبحث عن فاتورة قديمة لإرجاع صنف)،
  // لكنه يبقى مقصورًا على فواتير الكاشير نفسه — mine=1 على الخادم.
  const searchResultsQuery = useQuery({
    queryKey: invoiceSearchKey(searchQueryText, branchId),
    queryFn: () => fetchTransactions({ q: searchQueryText, mine: true, limit: 50, branchId }),
    enabled: !!activeShift && searching,
    // بحث لمرة واحدة وليس قائمة حيّة: بلا نافذة تقادم، حتى لا يعرض صفٌّ مُرجَع
    // حالته القديمة بعد تنفيذ إرجاع من داخل نتيجة البحث.
    staleTime: 0,
  })

  // ── تفاصيل الفاتورة المختارة ─────────────────────────────────────────────
  const detailQuery = useQuery({
    queryKey: invoiceDetailKey(selectedId ?? 'none'),
    queryFn: () => fetchTransaction(selectedId as string, branchId),
    enabled: !!selectedId,
  })
  const detail: TransactionDetail | undefined = detailQuery.data

  const closeDetail = () => {
    setSelectedId(null)
    setReturnQty({})
  }

  const afterWriteSuccess = (message: string) => {
    // الإبطال أولاً — يقرأ selectedId قبل أن يصفّره closeDetail
    queryClient.invalidateQueries({ queryKey: shiftInvoicesKey(branchId) })
    queryClient.invalidateQueries({ queryKey: shiftKeys.summary })
    if (selectedId) queryClient.invalidateQueries({ queryKey: invoiceDetailKey(selectedId) })
    // ثم إغلاق ورقة الفاتورة: بقاؤها مفتوحة بعد نجاح الإرجاع يوحي بأن العملية لم تتم
    closeDetail()
    appAlert.success(t.successTitle, message)
  }

  const onWriteError = (err: unknown) => {
    appAlert.error(t.failTitle, err instanceof ApiError ? err.message : ar.common.unexpectedError)
  }

  // ── إرجاع جزئي/كامل لبنود محددة (POST /api/transactions/return) ──────────
  const returnMutation = useMutation({
    mutationFn: (params: { originalTransactionId: string; items: { productId: string; unitId: string; quantity: number; price: number }[] }) =>
      returnItems({ ...params, branchId }),
    onSuccess: () => afterWriteSuccess(t.returnSuccess),
    onError: onWriteError,
  })

  // ── استرداد كامل (POST /api/transactions/refund) ─────────────────────────
  const refundMutation = useMutation({
    mutationFn: (params: {
      originalTxId: string
      items: { productId: string; unitId: string; quantity: number; price: number; cost: number }[]
      totalAmount: number
    }) => refundTransaction(params),
    onSuccess: () => afterWriteSuccess(t.refundSuccess),
    onError: onWriteError,
  })

  const mutating = returnMutation.isPending || refundMutation.isPending

  /** ما تبقّى قابلاً للإرجاع من بند = المباع − ما أُرجع سابقًا */
  const returnableOf = (item: TransactionItemDto) =>
    Math.max(0, Number(item.quantity) - Number(item.returnedQuantity ?? 0))

  const totalReturnable = detail ? detail.items.reduce((sum, item) => sum + returnableOf(item), 0) : 0

  const submitReturn = () => {
    if (!detail) return
    const items = detail.items
      .map(item => ({ item, qty: Math.min(returnQty[item.id] ?? 0, returnableOf(item)) }))
      .filter(({ qty }) => qty > 0)
      .map(({ item, qty }) => ({
        productId: item.productId,
        unitId: item.unitId,
        quantity: qty,
        price: Number(item.price),
      }))
    if (items.length === 0) return
    const amount = items.reduce((sum, it) => sum + it.price * it.quantity, 0)
    appAlert.confirm({
      title: t.confirmReturnTitle,
      message: t.confirmReturnMessage(`${formatMoney(amount)} ${ar.common.currency}`),
      destructive: true,
      onConfirm: () => returnMutation.mutate({ originalTransactionId: detail.id, items }),
    })
  }

  const submitRefund = () => {
    if (!detail) return
    // «استرداد كامل» = كل ما تبقّى قابلاً للإرجاع. إرسال الكمية المباعة كاملة على
    // فاتورة أُرجع جزء منها كان يُرفض من الخادم دائمًا.
    const items = detail.items
      .map(item => ({ item, qty: returnableOf(item) }))
      .filter(({ qty }) => qty > 0)
      .map(({ item, qty }) => ({
        productId: item.productId,
        unitId: item.unitId,
        quantity: qty,
        price: Number(item.price),
        cost: Number(item.cost || 0),
      }))
    if (items.length === 0) return
    const amount = items.reduce((sum, it) => sum + it.price * it.quantity, 0)
    appAlert.confirm({
      title: t.confirmRefundTitle,
      message: t.confirmRefundMessage(`${formatMoney(amount)} ${ar.common.currency}`),
      destructive: true,
      onConfirm: () => refundMutation.mutate({ originalTxId: detail.id, items, totalAmount: amount }),
    })
  }

  // ── صف فاتورة: البطاقة الموحّدة نفسها المستخدمة في شاشات المدير ──────────
  const renderInvoice = ({ item }: { item: TransactionListItem }) => {
    const isSale = item.type === 'SALE'
    return (
      <InvoiceCard
        tx={{ ...item, user: item.user ?? (user ? { username: user.username ?? null } : null) }}
        onPress={isSale ? () => setSelectedId(item.id) : undefined}
        products={item.productNames?.length ? summarizeProducts(item.productNames, searchQueryText) : undefined}
      />
    )
  }

  const searchBox = (
    <View style={styles.searchWrap}>
      <Ionicons name="search-outline" size={20} color={colors.textMuted} />
      <TextInput
        style={styles.searchInput}
        value={searchInput}
        onChangeText={setSearchInput}
        placeholder={t.searchPlaceholder}
        placeholderTextColor={colors.textMuted}
        textAlign="right"
        autoCorrect={false}
        returnKeyType="search"
      />
      {searchInput.length > 0 ? (
        <Pressable onPress={() => setSearchInput('')} hitSlop={8}>
          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  )

  const searchBody = () => {
    // نصّ قصير جدًا: لا نُرهق الخادم بطلب لكل حرف
    if (!searching) return <EmptyState message={t.searchHint} icon="search-outline" />
    if (searchResultsQuery.isPending) return <LoadingView />
    if (searchResultsQuery.isError) {
      return <ErrorState error={searchResultsQuery.error} onRetry={() => searchResultsQuery.refetch()} />
    }
    const results = searchResultsQuery.data ?? []
    if (results.length === 0) return <EmptyState message={t.searchEmpty} icon="receipt-outline" />
    return (
      <>
        <Text style={styles.searchScope}>{t.searchScope(results.length)}</Text>
        <FlatList
          style={styles.flexList}
          data={results}
          keyExtractor={item => item.id}
          renderItem={renderInvoice}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={searchResultsQuery.isRefetching}
              onRefresh={() => searchResultsQuery.refetch()}
              tintColor={colors.primary}
            />
          }
        />
      </>
    )
  }

  const listBody = () => {
    if (shiftQuery.isPending) return <LoadingView />
    if (shiftQuery.isError) return <ErrorState error={shiftQuery.error} onRetry={() => shiftQuery.refetch()} />
    if (!activeShift) {
      return (
        <View style={styles.noShiftCard}>
          <View style={styles.noShiftIcon}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.warning} />
          </View>
          <View style={styles.noShiftTextWrap}>
            <Text style={styles.noShiftTitle}>{t.noShiftTitle}</Text>
            <Text style={styles.noShiftHint}>{t.noShift}</Text>
          </View>
        </View>
      )
    }
    return (
      <>
        {searchBox}
        {/* حاوية محدودة الارتفاع: القائمة لها الآن شقيق (حقل البحث) فلا بد أن تُقيَّد لتمرّر */}
        <View style={styles.listArea}>
          {/* البحث يستبدل قائمة الوردية ما دام هناك نص في الحقل */}
          {searchInput.trim().length > 0 ? (
            searchBody()
          ) : invoicesQuery.isPending ? (
            <LoadingView />
          ) : invoicesQuery.isError ? (
            <ErrorState error={invoicesQuery.error} onRetry={() => invoicesQuery.refetch()} />
          ) : shiftInvoices.length === 0 ? (
            <EmptyState message={t.empty} icon="receipt-outline" />
          ) : (
            <FlatList
              data={shiftInvoices}
              keyExtractor={item => item.id}
              renderItem={renderInvoice}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              refreshControl={
                <RefreshControl
                  refreshing={invoicesQuery.isRefetching}
                  onRefresh={() => invoicesQuery.refetch()}
                  tintColor={colors.primary}
                />
              }
            />
          )}
        </View>
      </>
    )
  }

  const countBadge =
    activeShift && shiftInvoices.length > 0 ? (
      <View style={styles.countBadge}>
        <Ionicons name="receipt-outline" size={14} color={colors.primary} />
        <Text style={styles.countBadgeText}>{shiftInvoices.length}</Text>
      </View>
    ) : undefined

  return (
    <Screen title={t.title} scroll={false} headerAction={countBadge}>
      {listBody()}

      {/* ── تفاصيل الفاتورة + الإرجاع والاسترداد ── */}
      <Modal
        visible={!!selectedId}
        animationType="slide"
        transparent
        // زر الرجوع يغلق التنبيه أولًا إن كان ظاهرًا، ثم ورقة الفاتورة
        onRequestClose={() => { if (!appAlert.handleBack()) closeDetail() }}
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t.detailTitle}</Text>
              <Pressable style={styles.closeButton} onPress={closeDetail} hitSlop={8} disabled={mutating}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            {detailQuery.isPending ? (
              <LoadingView />
            ) : detailQuery.isError ? (
              <ErrorState error={detailQuery.error} onRetry={() => detailQuery.refetch()} />
            ) : detail ? (
              <>
                <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheetContent}>
                  <View style={styles.metaCard}>
                    <MetaRow label={t.receiptNo} value={`#${detail.receiptNumber}`} />
                    <MetaRow label={t.date} value={formatDateTime(detail.date)} />
                    <MetaRow label={t.method} value={paymentLabel(detail.paymentMethod)} />
                    {detail.customer?.name ? <MetaRow label={t.customer} value={detail.customer.name} /> : null}
                    {Number(detail.discount ?? 0) > 0 ? (
                      <MetaRow label={t.discount} value={formatMoney(detail.discount)} />
                    ) : null}
                    <View style={styles.metaDivider} />
                    <MetaRow label={t.total} value={`${formatMoney(detail.totalAmount)} ${ar.common.currency}`} bold />
                  </View>

                  <Text style={styles.linesTitle}>{t.linesTitle}</Text>
                  {detail.items.map(item => {
                    const soldQty = Number(item.quantity)
                    const returnedSoFar = Number(item.returnedQuantity ?? 0)
                    const returnable = Math.max(0, soldQty - returnedSoFar)
                    const fullyReturned = returnable === 0
                    const selected = returnQty[item.id] ?? 0
                    return (
                      <View key={item.id} style={[styles.lineCard, fullyReturned && styles.lineCardReturned]}>
                        <View style={styles.lineTop}>
                          <View style={styles.lineNameWrap}>
                            <Text style={styles.lineName} numberOfLines={1}>
                              {item.product?.name ?? '—'}
                            </Text>
                            <Text style={styles.lineMeta}>
                              {item.unit?.name ?? ''} · {t.qty}: {formatMoney(soldQty)} × {formatMoney(item.price)}
                            </Text>
                          </View>
                          <Text style={styles.lineTotalText}>{formatMoney(Number(item.price) * soldQty)}</Text>
                        </View>

                        {/* علامة الإرجاع: كامل (أحمر) أو جزئي (برتقالي) */}
                        {returnedSoFar > 0 ? (
                          <View style={[styles.returnedChip, fullyReturned && styles.returnedChipFull]}>
                            <Ionicons
                              name={fullyReturned ? 'close-circle' : 'return-down-back-outline'}
                              size={13}
                              color={fullyReturned ? colors.danger : colors.warning}
                            />
                            <Text style={[styles.returnedChipText, fullyReturned && styles.returnedChipTextFull]}>
                              {fullyReturned ? t.returnedAll : t.returnedSome(returnedSoFar)}
                            </Text>
                          </View>
                        ) : null}

                        {/* الصنف المُرجَع بالكامل لا يعرض خطوة كمية إطلاقًا */}
                        {fullyReturned ? null : (
                          <View style={styles.returnRow}>
                            {/* المتبقّي معروض دائمًا: الكاشير يرى السقف قبل أن يبلغه */}
                            <Text style={styles.returnLabel}>
                              {t.returnQty} · {t.remaining(returnable)}
                            </Text>
                            <View style={styles.stepper}>
                              <Pressable
                                style={styles.stepButton}
                                onPress={() =>
                                  setReturnQty(prev => ({
                                    ...prev,
                                    // السقف هو المتبقّي وليس الكمية المباعة — يمنع طلبًا يرفضه الخادم
                                    [item.id]: Math.min(returnable, (prev[item.id] ?? 0) + 1),
                                  }))
                                }
                                // يبهت عند بلوغ السقف بدل أن يبتلع الضغطة صامتًا
                                disabled={mutating || selected >= returnable}
                              >
                                <Ionicons
                                  name="add"
                                  size={16}
                                  color={selected >= returnable ? colors.textMuted : colors.primary}
                                />
                              </Pressable>
                              <Text style={styles.stepQty}>{selected}</Text>
                              <Pressable
                                style={styles.stepButton}
                                onPress={() =>
                                  setReturnQty(prev => ({ ...prev, [item.id]: Math.max(0, (prev[item.id] ?? 0) - 1) }))
                                }
                                disabled={mutating}
                              >
                                <Ionicons name="remove" size={16} color={colors.primary} />
                              </Pressable>
                            </View>
                          </View>
                        )}
                      </View>
                    )
                  })}
                </ScrollView>

                {totalReturnable === 0 ? (
                  <View style={styles.nothingReturnable}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.textSecondary} />
                    <Text style={styles.nothingReturnableText}>{t.nothingReturnable}</Text>
                  </View>
                ) : null}

                <View style={styles.actions}>
                  <Pressable
                    style={[
                      styles.actionButton,
                      styles.returnButton,
                      (mutating || !Object.values(returnQty).some(q => q > 0)) && styles.actionDisabled,
                    ]}
                    onPress={submitReturn}
                    disabled={mutating || !Object.values(returnQty).some(q => q > 0)}
                  >
                    {returnMutation.isPending ? (
                      <ActivityIndicator color={colors.onPrimary} size="small" />
                    ) : (
                      <Ionicons name="return-down-back-outline" size={18} color={colors.onPrimary} />
                    )}
                    <Text style={styles.actionText}>{t.returnSelected}</Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.actionButton,
                      styles.refundButton,
                      (mutating || totalReturnable === 0) && styles.actionDisabled,
                    ]}
                    onPress={submitRefund}
                    disabled={mutating || totalReturnable === 0}
                  >
                    {refundMutation.isPending ? (
                      <ActivityIndicator color={colors.onPrimary} size="small" />
                    ) : (
                      <Ionicons name="cash-outline" size={18} color={colors.onPrimary} />
                    )}
                    <Text style={styles.actionText}>{t.fullRefund}</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </View>
        {/* التنبيه يُرسم داخل ورقة الفاتورة: طبقة الجذر لا تعلو نافذةً مفتوحة */}
        <AlertHost />
      </Modal>
    </Screen>
  )
}

function MetaRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.metaRow}>
      <Text style={[styles.metaLabel, bold && styles.metaBold]}>{label}</Text>
      <Text style={[styles.metaValue, bold && styles.metaBold]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, paddingBottom: spacing.xxl },
  searchWrap: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  searchInput: { flex: 1, height: control.inputHeight, color: colors.text, fontSize: fontSize.md },
  searchScope: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    textAlign: 'right',
    marginBottom: spacing.sm,
  },
  listArea: { flex: 1, minHeight: 0 },
  flexList: { flex: 1 },
  countBadge: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  countBadgeText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '700' },

  // ── بطاقة «لا توجد وردية» ──
  noShiftCard: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    marginTop: spacing.md,
    ...shadow.card,
  },
  noShiftIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.warningSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noShiftTextWrap: { flex: 1, gap: 1, alignItems: ALIGN_RIGHT },
  noShiftTitle: { color: colors.text, fontSize: fontSize.sm, fontWeight: '700', textAlign: 'right' },
  noShiftHint: { color: colors.textSecondary, fontSize: fontSize.xs, textAlign: 'right', lineHeight: 18 },

  // ── ورقة التفاصيل ──
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.lg,
    height: '88%',
    gap: spacing.md,
  },
  sheetHeader: { flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, textAlign: 'right' },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetScroll: { flex: 1 },
  sheetContent: { gap: spacing.sm, paddingBottom: spacing.lg },
  metaCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
  },
  metaRow: { flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between' },
  metaLabel: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'right' },
  metaValue: { fontSize: fontSize.sm, color: colors.text, fontWeight: '600' },
  metaBold: { fontSize: fontSize.md, fontWeight: '800', color: colors.text },
  metaDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  linesTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'right',
    marginTop: spacing.sm,
  },
  lineCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.card,
  },
  // البند المُرجَع بالكامل: خلفية باهتة وحافة حمراء ناعمة تميّزه فورًا في القائمة
  lineCardReturned: { backgroundColor: colors.background, borderColor: colors.dangerSoft },
  returnedChip: {
    flexDirection: ROW,
    alignItems: 'center',
    alignSelf: ALIGN_RIGHT,
    gap: spacing.xs,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  returnedChipFull: { backgroundColor: colors.dangerSoft },
  returnedChipText: { fontSize: fontSize.xs, fontWeight: '800', color: colors.warning },
  returnedChipTextFull: { color: colors.danger },
  nothingReturnable: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  nothingReturnableText: { flex: 1, fontSize: fontSize.xs, color: colors.textSecondary, textAlign: 'right' },
  lineTop: { flexDirection: ROW, alignItems: 'center', gap: spacing.sm },
  lineNameWrap: { flex: 1, gap: 2, alignItems: ALIGN_RIGHT },
  lineName: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text, textAlign: 'right' },
  lineMeta: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'right' },
  lineTotalText: { fontSize: fontSize.sm, fontWeight: '800', color: colors.primary },
  returnRow: {
    flexDirection: ROW,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  returnLabel: { fontSize: fontSize.xs, color: colors.textSecondary, textAlign: 'right' },
  stepper: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  stepButton: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  stepQty: { minWidth: 24, textAlign: 'center', fontSize: fontSize.sm, fontWeight: '700', color: colors.text },
  actions: { flexDirection: ROW, gap: spacing.sm },
  actionButton: {
    flex: 1,
    flexDirection: ROW,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    height: 48,
  },
  returnButton: { backgroundColor: colors.warning },
  refundButton: { backgroundColor: colors.danger },
  actionDisabled: { opacity: 0.5 },
  actionText: { color: colors.onPrimary, fontSize: fontSize.sm, fontWeight: '700' },
})
