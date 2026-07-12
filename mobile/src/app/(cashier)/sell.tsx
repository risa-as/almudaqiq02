import { useCallback, useEffect, useRef, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { ApiError } from '@/api/client'
import { activeOffersKey, fetchActiveOffers } from '@/api/endpoints/offers'
import { searchProducts, type ProductSearchResult, type ProductUnitDto } from '@/api/endpoints/products'
import { fetchActiveShift, shiftKeys } from '@/api/endpoints/shifts'
import { createSale, shiftInvoicesKey } from '@/api/endpoints/transactions'
import { BarcodeScannerView } from '@/components/BarcodeScannerView'
import { EmptyState } from '@/components/EmptyState'
import { ProductSearchSheet } from '@/components/ProductSearchSheet'
import { PaymentSheet } from '@/components/cashier/PaymentSheet'
import { ReceiptModal, type ReceiptData } from '@/components/cashier/ReceiptModal'
import { Screen } from '@/components/Screen'
import { computeCartTotals, useCartStore, type CartLine } from '@/stores/cart'
import { useAuthStore } from '@/stores/auth'
import { formatMoney } from '@/utils/format'
import { ar } from '@/i18n/ar'
import { colors, control, fontSize, radius, shadow, spacing } from '@/theme'

// نصوص خاصة بشاشة البيع
const t = {
  title: 'البيع',
  notFound: 'المنتج غير موجود',
  stockLimit: (available: number) => `الكمية المتوفرة: ${formatMoney(available)} فقط`,
  emptyCart: 'السلة فارغة — امسح باركود أو ابحث بالاسم',
  subtotal: 'المجموع',
  offersDiscount: 'الخصم (عروض + يدوي)',
  manualDiscount: 'خصم يدوي',
  total: 'الإجمالي',
  pay: 'الدفع',
  needShift: 'لا توجد وردية مفتوحة — افتح ورديتك أولاً لبدء البيع',
  goToShift: 'الذهاب إلى ورديتي',
  needCustomer: 'يجب اختيار عميل لتسجيل بيع آجل',
  ambiguousFailure:
    'انقطع الاتصال أثناء إرسال الفاتورة وقد تكون سُجّلت. تم تحديث «فواتيري» — تأكد أن الفاتورة غير موجودة قبل إعادة المحاولة. السلة محفوظة كما هي.',
  searchByName: 'بحث بالاسم',
}

const BANNER_MS = 3000

export default function SellScreen() {
  const user = useAuthStore(s => s.user)
  const queryClient = useQueryClient()

  // ── حالة السلة (zustand — تنجو من فشل الطلبات، تُفرَّغ فقط بعد نجاح مؤكد) ──
  const lines = useCartStore(s => s.lines)
  const discount = useCartStore(s => s.discount)
  const setDiscount = useCartStore(s => s.setDiscount)
  const submitting = useCartStore(s => s.submitting)
  const addLine = useCartStore(s => s.addLine)
  const changeQty = useCartStore(s => s.changeQty)
  const removeLine = useCartStore(s => s.removeLine)

  // ── حالة الشاشة ──────────────────────────────────────────────────────────
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchNotice, setSearchNotice] = useState<string | null>(null)
  const [payOpen, setPayOpen] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const [discountInput, setDiscountInput] = useState('')
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scanBusy = useRef(false)

  useEffect(
    () => () => {
      if (bannerTimer.current) clearTimeout(bannerTimer.current)
    },
    [],
  )

  const showBanner = useCallback((message: string) => {
    setBanner(message)
    if (bannerTimer.current) clearTimeout(bannerTimer.current)
    bannerTimer.current = setTimeout(() => setBanner(null), BANNER_MS)
  }, [])

  // ── الوردية والعروض ──────────────────────────────────────────────────────
  const shiftQuery = useQuery({ queryKey: shiftKeys.active, queryFn: fetchActiveShift })
  const activeShift = shiftQuery.data?.activeShift ?? null
  const branchId = activeShift?.branchId ?? user?.branchId ?? null

  const offersQuery = useQuery({
    queryKey: activeOffersKey(branchId),
    queryFn: () => fetchActiveOffers(branchId),
    staleTime: 60_000,
  })
  const offers = offersQuery.data ?? []

  const totals = computeCartTotals(lines, offers, discount)

  // ── إضافة منتج للسلة (من المسح أو ورقة البحث) ────────────────────────────
  const addProduct = useCallback(
    (product: ProductSearchResult, unit: ProductUnitDto) => {
      const result = addLine({
        productId: product.id,
        unitId: unit.unitId,
        name: product.name,
        unitName: unit.unitName,
        barcode: unit.barcode,
        unitPrice: unit.price,
        stock: product.baseStock,
      })
      if (result === 'out-of-stock') {
        showBanner(t.stockLimit(product.baseStock))
      } else {
        setSearchOpen(false)
        setSearchNotice(null)
      }
    },
    [addLine, showBanner],
  )

  // ── معالجة المسح: بحث خادمي بالكود → تطابق باركود تام أو «غير موجود» ─────
  const handleScanned = useCallback(
    async (code: string) => {
      if (scanBusy.current) return
      scanBusy.current = true
      try {
        const results = await searchProducts(code, branchId)
        const exact = results.find(r => r.matchType === 'barcode' && r.units.length > 0)
        if (exact) {
          addProduct(exact, exact.units[0])
        } else {
          // لا تطابق في هذا المستأجر → لا يُضاف شيء + فتح البحث بالاسم (US2-AS3)
          showBanner(t.notFound)
          setSearchNotice(t.notFound)
          setSearchOpen(true)
        }
      } catch (err) {
        showBanner(err instanceof ApiError ? err.message : ar.common.unexpectedError)
      } finally {
        scanBusy.current = false
      }
    },
    [addProduct, branchId, showBanner],
  )

  // ── الدفع — أحادي الإرسال؛ الفشل لا يمسّ السلة (FR-015 / R9) ─────────────
  const checkout = async (received: number | null) => {
    const cart = useCartStore.getState()
    if (!activeShift || cart.lines.length === 0) return
    if (cart.paymentMethod === 'CREDIT' && !cart.customerId) {
      setPayError(t.needCustomer)
      return
    }
    if (!cart.beginSubmit()) return
    setPayError(null)

    const snapshot = [...cart.lines]
    const totalsNow = computeCartTotals(snapshot, offers, cart.discount)

    try {
      // جسم POST مطابق حرفيًا لما يرسله POS الويب (app/pos/page.tsx handlePay)
      const res = await createSale({
        items: snapshot.map(l => ({
          productId: l.productId,
          unitId: l.unitId,
          quantity: l.qty,
          price: l.unitPrice,
        })),
        shiftId: activeShift.id,
        totalAmount: totalsNow.total,
        customerId: cart.paymentMethod === 'CREDIT' ? cart.customerId : null,
        isCredit: cart.paymentMethod === 'CREDIT',
        discount: totalsNow.discount,
        notes: '',
        ...(branchId ? { branchId } : {}),
        paidAmount: cart.paymentMethod === 'CREDIT' ? 0 : totalsNow.total,
        paymentMethod: cart.paymentMethod,
      })

      const method = cart.paymentMethod
      setReceipt({
        receiptNumber: res.receiptNumber,
        date: new Date().toISOString(),
        lines: snapshot.map(l => ({ name: l.name, unitName: l.unitName, qty: l.qty, price: l.unitPrice })),
        subtotal: totalsNow.subtotal,
        discount: totalsNow.discount,
        total: totalsNow.total,
        paid: method === 'CREDIT' ? 0 : received ?? totalsNow.total,
        change: method === 'CASH' && received !== null ? Math.max(0, received - totalsNow.total) : 0,
        method,
        customerName: cart.customerName,
      })

      // نجاح مؤكد فقط → تفريغ السلة
      useCartStore.getState().clear()
      setDiscountInput('')
      setPayOpen(false)
      setReceiptOpen(true)
      queryClient.invalidateQueries({ queryKey: shiftKeys.summary })
      queryClient.invalidateQueries({ queryKey: shiftInvoicesKey(branchId) })
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        // فشل غامض بعد الإرسال: الطلب ربما وصل الخادم — أعد جلب فواتير الوردية
        // قبل السماح بإعادة المحاولة (منع فاتورة مكررة — FR-015)
        setVerifying(true)
        try {
          await queryClient.refetchQueries({ queryKey: shiftInvoicesKey(branchId) })
        } catch {
          // تجاهل — التحقق اليدوي من «فواتيري» يبقى متاحًا
        }
        setVerifying(false)
        setPayError(t.ambiguousFailure)
      } else {
        setPayError(err instanceof ApiError ? err.message : ar.common.unexpectedError)
      }
    } finally {
      useCartStore.getState().endSubmit()
    }
  }

  // ── صف بند السلة ─────────────────────────────────────────────────────────
  const renderLine = ({ item }: { item: CartLine }) => (
    <View style={styles.lineRow}>
      <Pressable style={styles.removeButton} onPress={() => removeLine(item.productId, item.unitId)} hitSlop={6}>
        <Ionicons name="trash-outline" size={18} color={colors.danger} />
      </Pressable>

      <View style={styles.stepper}>
        <Pressable
          style={styles.stepButton}
          onPress={() => {
            if (!changeQty(item.productId, item.unitId, 1)) showBanner(t.stockLimit(item.stock))
          }}
        >
          <Ionicons name="add" size={18} color={colors.primary} />
        </Pressable>
        <Text style={styles.qtyText}>{formatMoney(item.qty)}</Text>
        <Pressable style={styles.stepButton} onPress={() => changeQty(item.productId, item.unitId, -1)}>
          <Ionicons name="remove" size={18} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.lineInfo}>
        <Text style={styles.lineName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.lineMeta}>
          {item.unitName} · {formatMoney(item.unitPrice)}
        </Text>
      </View>

      <Text style={styles.lineTotal}>{formatMoney(item.unitPrice * item.qty)}</Text>
    </View>
  )

  const noShift = !shiftQuery.isPending && !activeShift
  const payDisabled = submitting || lines.length === 0 || !activeShift

  return (
    <Screen
      title={t.title}
      scroll={false}
      headerAction={
        <Pressable style={styles.searchButton} onPress={() => setSearchOpen(true)}>
          <Ionicons name="search" size={16} color={colors.primary} />
          <Text style={styles.searchButtonText}>{t.searchByName}</Text>
        </Pressable>
      }
    >
      <BarcodeScannerView
        onScanned={handleScanned}
        paused={payOpen || searchOpen || receiptOpen || submitting}
        height={200}
      />

      {banner ? (
        <View style={styles.banner}>
          <Ionicons name="alert-circle" size={16} color={colors.warning} />
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      ) : null}

      {noShift ? (
        <View style={styles.noShiftBox}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.warning} />
          <Text style={styles.noShiftText}>{t.needShift}</Text>
          <Pressable onPress={() => router.navigate('/(cashier)/shift' as never)}>
            <Text style={styles.noShiftLink}>{t.goToShift}</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.cartArea}>
        {lines.length === 0 ? (
          <EmptyState message={t.emptyCart} icon="cart-outline" />
        ) : (
          <FlatList
            data={lines}
            keyExtractor={item => `${item.productId}:${item.unitId}`}
            renderItem={renderLine}
            contentContainerStyle={styles.cartList}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </View>

      <View style={styles.footer}>
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>{t.subtotal}</Text>
          <Text style={styles.totalsValue}>{formatMoney(totals.subtotal)}</Text>
        </View>

        <View style={styles.discountRow}>
          <Text style={styles.totalsLabel}>{t.manualDiscount}</Text>
          <TextInput
            style={styles.discountInput}
            value={discountInput}
            onChangeText={text => {
              setDiscountInput(text)
              setDiscount(Number(text) || 0)
            }}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            textAlign="center"
            editable={!submitting}
          />
        </View>

        {totals.discount > 0 ? (
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>{t.offersDiscount}</Text>
            <Text style={styles.discountValue}>-{formatMoney(totals.discount)}</Text>
          </View>
        ) : null}

        {/* زر الدفع الرئيسي — حبة كاملة العرض تعرض الإجمالي بداخلها */}
        <Pressable
          style={[styles.payButton, payDisabled && styles.payDisabled]}
          onPress={() => {
            setPayError(null)
            setPayOpen(true)
          }}
          disabled={payDisabled}
        >
          <View style={styles.payLabelWrap}>
            <Ionicons name="checkmark-circle-outline" size={20} color={colors.onPrimary} />
            <Text style={styles.payText}>{t.pay}</Text>
          </View>
          <Text style={styles.payTotal}>
            {formatMoney(totals.total)} {ar.common.currency}
          </Text>
        </Pressable>
      </View>

      <ProductSearchSheet
        visible={searchOpen}
        onClose={() => {
          setSearchOpen(false)
          setSearchNotice(null)
        }}
        onPick={addProduct}
        branchId={branchId}
        notice={searchNotice}
      />

      <PaymentSheet
        visible={payOpen}
        onClose={() => {
          if (!submitting) setPayOpen(false)
        }}
        total={totals.total}
        branchId={branchId}
        error={payError}
        verifying={verifying}
        onConfirm={checkout}
      />

      <ReceiptModal
        visible={receiptOpen}
        receipt={receipt}
        onClose={() => {
          setReceiptOpen(false)
          setReceipt(null)
        }}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  searchButtonText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '600' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  bannerText: { flex: 1, color: colors.warning, fontSize: fontSize.sm, textAlign: 'right' },
  noShiftBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  noShiftText: { flex: 1, color: colors.warning, fontSize: fontSize.sm, textAlign: 'right', lineHeight: 20 },
  noShiftLink: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '700' },
  cartArea: { flex: 1, marginTop: spacing.sm },
  cartList: { gap: spacing.sm, paddingBottom: spacing.sm },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    ...shadow.card,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  stepButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: { minWidth: 26, textAlign: 'center', fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  lineInfo: { flex: 1, gap: 2 },
  lineName: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text, textAlign: 'right' },
  lineMeta: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'right' },
  lineTotal: { fontSize: fontSize.sm, fontWeight: '800', color: colors.primary },
  footer: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.sm,
    ...shadow.elevated,
  },
  totalsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalsLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  totalsValue: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  discountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  discountInput: {
    minWidth: 90,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  discountValue: { fontSize: fontSize.sm, fontWeight: '700', color: colors.danger },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: colors.success,
    borderRadius: radius.pill,
    height: control.buttonHeight,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.sm,
    ...shadow.button,
    shadowColor: colors.success,
  },
  payDisabled: { opacity: 0.5 },
  payLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  payText: { color: colors.onPrimary, fontSize: fontSize.lg, fontWeight: '800' },
  payTotal: { color: colors.onPrimary, fontSize: fontSize.lg, fontWeight: '800' },
})
