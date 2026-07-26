import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { router } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { ApiError } from '@/api/client'
import { activeOffersKey, fetchActiveOffers } from '@/api/endpoints/offers'
import { productSearchKey, searchProducts, type ProductSearchResult, type ProductUnitDto } from '@/api/endpoints/products'
import { fetchActiveShift, shiftKeys } from '@/api/endpoints/shifts'
import { createSale, shiftInvoicesKey } from '@/api/endpoints/transactions'
import { AlertHost, appAlert } from '@/components/AppAlert'
import { BarcodeScannerView } from '@/components/BarcodeScannerView'
import { CatalogProductCard } from '@/components/cashier/CatalogProductCard'
import { PaymentSheet } from '@/components/cashier/PaymentSheet'
import { ReceiptModal, type ReceiptData } from '@/components/cashier/ReceiptModal'
import { Screen } from '@/components/Screen'
import { computeCartTotals, useCartStore, type CartLine, type CartPaymentMethod } from '@/stores/cart'
import { useAuthStore } from '@/stores/auth'
import { formatMoney } from '@/utils/format'
import { ar } from '@/i18n/ar'
import { colors, control, fontSize, radius, shadow, spacing } from '@/theme'
import { ALIGN_RIGHT, ROW } from '@/utils/rtl'

const t = {
  title: 'البيع',
  shiftOpen: 'وردية مفتوحة',
  shiftClosed: 'الوردية مغلقة',
  searchPlaceholder: 'ابحث بالاسم أو الباركود…',
  searchHint: 'اكتب حرفين للبحث عن المنتجات',
  noProducts: 'لا توجد منتجات مطابقة',
  scan: 'مسح باركود',
  scanHint: 'استخدم كاميرا الهاتف',
  scannerTitle: 'ماسح الباركود',
  notFound: 'المنتج غير موجود',
  stockLimit: (available: number) => `الكمية المتوفرة: ${formatMoney(available)} فقط`,
  emptyCartTitle: 'السلة فارغة',
  emptyCart: 'أضف أصنافًا من البحث أو بالماسح',
  cart: 'سلة الفاتورة',
  item: 'صنف',
  items: 'أصناف',
  clearCart: 'تفريغ',
  clearCartConfirm: 'هل تريد تفريغ جميع أصناف السلة؟',
  subtotal: 'المجموع الفرعي',
  totalDiscount: 'إجمالي الخصم',
  addDiscount: 'إضافة خصم يدوي',
  hideDiscount: 'إخفاء الخصم اليدوي',
  total: 'الإجمالي',
  viewCart: 'عرض السلة وإتمام البيع',
  pay: 'إتمام الدفع',
  needCustomer: 'يجب اختيار عميل لتسجيل بيع آجل',
  ambiguousFailure:
    'انقطع الاتصال أثناء إرسال الفاتورة وقد تكون سُجّلت. تم تحديث «فواتيري» — تأكد أن الفاتورة غير موجودة قبل إعادة المحاولة. السلة محفوظة كما هي.',
}

const BANNER_MS = 3000

// الترتيب هنا هو ترتيب الأزرار على الشاشة من اليسار إلى اليمين (التطبيق LTR ثابت)
const PAYMENT_CHOICES: { method: CartPaymentMethod; label: string; icon: 'cash-outline' | 'card-outline' | 'time-outline' }[] = [
  { method: 'CREDIT', label: 'آجل', icon: 'time-outline' },
  { method: 'CARD', label: 'بطاقة', icon: 'card-outline' },
  { method: 'CASH', label: 'نقدي', icon: 'cash-outline' },
]

const catalogKeyExtractor = (item: ProductSearchResult) => item.id

export default function SellScreen() {
  const user = useAuthStore(s => s.user)
  const queryClient = useQueryClient()

  const lines = useCartStore(s => s.lines)
  const discount = useCartStore(s => s.discount)
  const setDiscount = useCartStore(s => s.setDiscount)
  const setPaymentMethod = useCartStore(s => s.setPaymentMethod)
  const submitting = useCartStore(s => s.submitting)
  const addLine = useCartStore(s => s.addLine)
  const changeQty = useCartStore(s => s.changeQty)
  const setUnitPrice = useCartStore(s => s.setUnitPrice)
  const removeLine = useCartStore(s => s.removeLine)
  const clear = useCartStore(s => s.clear)

  const [scannerOpen, setScannerOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [productQuery, setProductQuery] = useState('')
  const [debouncedProductQuery, setDebouncedProductQuery] = useState('')
  const [payOpen, setPayOpen] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const [discountInput, setDiscountInput] = useState('')
  const [discountOpen, setDiscountOpen] = useState(false)
  const [editingPriceLine, setEditingPriceLine] = useState<CartLine | null>(null)
  const [priceInput, setPriceInput] = useState('')
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scanBusy = useRef(false)

  useEffect(
    () => () => {
      if (bannerTimer.current) clearTimeout(bannerTimer.current)
    },
    [],
  )

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedProductQuery(productQuery.trim()), 250)
    return () => clearTimeout(timer)
  }, [productQuery])

  const showBanner = useCallback((message: string) => {
    setBanner(message)
    if (bannerTimer.current) clearTimeout(bannerTimer.current)
    bannerTimer.current = setTimeout(() => setBanner(null), BANNER_MS)
  }, [])

  const shiftQuery = useQuery({ queryKey: shiftKeys.active, queryFn: fetchActiveShift })
  const activeShift = shiftQuery.data?.activeShift ?? null
  const branchId = activeShift?.branchId ?? user?.branchId ?? null
  const canSell = !!activeShift

  const offersQuery = useQuery({
    queryKey: activeOffersKey(branchId),
    queryFn: () => fetchActiveOffers(branchId),
    staleTime: 60_000,
  })
  const offers = offersQuery.data ?? []
  const productsQuery = useQuery({
    queryKey: productSearchKey(debouncedProductQuery, branchId),
    queryFn: () => searchProducts(debouncedProductQuery, branchId),
    enabled: canSell,
    staleTime: 60_000,
  })
  const totals = computeCartTotals(lines, offers, discount)
  const totalQuantity = lines.reduce((sum, line) => sum + line.qty, 0)

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
      }
    },
    [addLine, showBanner],
  )

  const handleScanned = useCallback(
    async (code: string) => {
      if (!canSell || scanBusy.current) return
      scanBusy.current = true
      try {
        const results = await searchProducts(code, branchId)
        const exact = results.find(result => result.matchType === 'barcode' && result.units.length > 0)
        if (exact) {
          addProduct(exact, exact.units[0])
          showBanner(`تمت إضافة «${exact.name}» إلى السلة`)
          setScannerOpen(false)
        } else {
          showBanner(t.notFound)
          setScannerOpen(false)
        }
      } catch (err) {
        showBanner(err instanceof ApiError ? err.message : ar.common.unexpectedError)
      } finally {
        scanBusy.current = false
      }
    },
    [addProduct, branchId, canSell, showBanner],
  )

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
      const res = await createSale({
        items: snapshot.map(line => ({
          productId: line.productId,
          unitId: line.unitId,
          quantity: line.qty,
          price: line.unitPrice,
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
        lines: snapshot.map(line => ({ name: line.name, unitName: line.unitName, qty: line.qty, price: line.unitPrice })),
        subtotal: totalsNow.subtotal,
        discount: totalsNow.discount,
        total: totalsNow.total,
        paid: method === 'CREDIT' ? 0 : received ?? totalsNow.total,
        change: method === 'CASH' && received !== null ? Math.max(0, received - totalsNow.total) : 0,
        method,
        customerName: cart.customerName,
      })
      useCartStore.getState().clear()
      setDiscountInput('')
      setDiscountOpen(false)
      setCartOpen(false)
      setPayOpen(false)
      setReceiptOpen(true)
      queryClient.invalidateQueries({ queryKey: shiftKeys.summary })
      queryClient.invalidateQueries({ queryKey: shiftInvoicesKey(branchId) })
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        setVerifying(true)
        try {
          await queryClient.refetchQueries({ queryKey: shiftInvoicesKey(branchId) })
        } catch {
          // يبقى فحص الفواتير يدويًا متاحًا للكاشير.
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

  const renderLine = ({ item }: { item: CartLine }) => (
    <View style={styles.lineCard}>
      <View style={styles.lineTop}>
        <Pressable
          style={styles.removeButton}
          onPress={() => removeLine(item.productId, item.unitId)}
          hitSlop={8}
          accessibilityLabel={`حذف ${item.name}`}
        >
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
        </Pressable>
        <View style={styles.lineInfo}>
          <Text style={styles.lineName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.lineMeta}>{item.unitName} · {formatMoney(item.unitPrice)} {ar.common.currency}</Text>
        </View>
        <View style={styles.productIcon}>
          <Ionicons name="cube-outline" size={18} color={colors.primary} />
        </View>
      </View>

      <View style={styles.lineBottom}>
        <Pressable
          style={styles.linePriceButton}
          onPress={() => {
            setEditingPriceLine(item)
            setPriceInput(String(item.unitPrice))
          }}
        >
          <Ionicons name="create-outline" size={14} color={colors.primary} />
          <Text style={styles.lineTotal}>{formatMoney(item.unitPrice)} <Text style={styles.lineCurrency}>{ar.common.currency}</Text></Text>
        </Pressable>
        <View style={styles.stepper}>
          <Pressable
            style={styles.stepButton}
            onPress={() => {
              if (!changeQty(item.productId, item.unitId, 1)) showBanner(t.stockLimit(item.stock))
            }}
            hitSlop={4}
          >
            <Ionicons name="add" size={18} color={colors.primary} />
          </Pressable>
          <Text style={styles.qtyText}>{formatMoney(item.qty)}</Text>
          <Pressable style={styles.stepButton} onPress={() => changeQty(item.productId, item.unitId, -1)} hitSlop={4}>
            <Ionicons name="remove" size={18} color={colors.primary} />
          </Pressable>
        </View>
      </View>
    </View>
  )

  // «−» عند الكمية 1 يحذف الصنف من السلة: البطاقة صارت تزيد بكل ضغطة، فلا بد من
  // تراجع كامل في مكانه بدل فتح السلة لحذف صنف أُضيف بالخطأ.
  const decrementProduct = useCallback(
    (product: ProductSearchResult, unit: ProductUnitDto) => {
      const line = useCartStore.getState().lines.find(l => l.productId === product.id && l.unitId === unit.unitId)
      if (!line) return
      if (line.qty <= 1) removeLine(product.id, unit.unitId)
      else changeQty(product.id, unit.unitId, -1)
    },
    [changeQty, removeLine],
  )

  // مرجع ثابت: يمنع FlatList من إعادة رسم كل البطاقات عند تغيّر السلة
  const renderProduct = useCallback(
    ({ item }: { item: ProductSearchResult }) => (
      <CatalogProductCard product={item} onAdd={addProduct} onDecrement={decrementProduct} />
    ),
    [addProduct, decrementProduct],
  )

  const payDisabled = submitting || lines.length === 0 || !canSell

  return (
    <Screen
      title={t.title}
      scroll={false}
      headerAction={
        <Pressable
          style={[styles.headerShiftBadge, !canSell && styles.headerShiftBadgeClosed]}
          onPress={() => !canSell && router.navigate('/(cashier)/shift' as never)}
        >
          <View style={[styles.headerShiftDot, !canSell && styles.headerShiftDotClosed]} />
          <Text style={[styles.headerShiftText, !canSell && styles.headerShiftTextClosed]}>{canSell ? t.shiftOpen : t.shiftClosed}</Text>
        </Pressable>
      }
    >
      <View style={styles.searchRow}>
        <Pressable
          style={[styles.scanButton, (!canSell || scannerOpen) && styles.actionDisabled]}
          onPress={() => setScannerOpen(true)}
          disabled={!canSell || scannerOpen}
        >
          <Ionicons name="scan-outline" size={26} color={colors.onPrimary} />
        </Pressable>
        <View style={[styles.searchInputWrap, !canSell && styles.actionDisabled]}>
          <Ionicons name="search-outline" size={22} color={colors.textMuted} />
          <TextInput
            style={styles.productSearchInput}
            value={productQuery}
            onChangeText={setProductQuery}
            placeholder={t.searchPlaceholder}
            placeholderTextColor={colors.textMuted}
            textAlign="right"
            editable={canSell}
          />
        </View>
      </View>

      <Modal visible={scannerOpen} animationType="fade" onRequestClose={() => setScannerOpen(false)}>
        <BarcodeScannerView
          fullScreen
          onClose={() => setScannerOpen(false)}
          onScanned={handleScanned}
          paused={payOpen || cartOpen || receiptOpen || submitting}
        />
      </Modal>

      {banner ? (
        <View style={styles.banner}>
          <Ionicons name="information-circle" size={17} color={colors.primary} />
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      ) : null}

      <View style={styles.catalogArea}>
        {!canSell ? (
          <View style={styles.catalogHint}>
            <View style={styles.catalogHintIcon}><Ionicons name="search-outline" size={30} color={colors.primary} /></View>
            <Text style={styles.catalogHintText}>افتح ورديتك للبدء بالبيع</Text>
          </View>
        ) : productsQuery.isPending ? (
          <View style={styles.catalogLoading}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : productsQuery.data?.length ? (
          <FlatList
            data={productsQuery.data}
            keyExtractor={catalogKeyExtractor}
            renderItem={renderProduct}
            contentContainerStyle={styles.catalogList}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.catalogHint}>
            <View style={styles.catalogHintIcon}><Ionicons name="cube-outline" size={30} color={colors.textMuted} /></View>
            <Text style={styles.catalogHintText}>{t.noProducts}</Text>
          </View>
        )}
      </View>

      {lines.length > 0 ? (
        <Pressable
          style={[styles.cartDock, !canSell && styles.cartDockDisabled]}
          onPress={() => setCartOpen(true)}
          disabled={!canSell}
        >
          <View style={styles.cartDockCount}><Text style={styles.cartDockCountText}>{formatMoney(totalQuantity)}</Text><Ionicons name="cart-outline" size={20} color={colors.onPrimary} /></View>
          <View style={styles.cartDockTextWrap}>
            <Text style={styles.cartDockTitle}>{t.viewCart}</Text>
            <Text style={styles.cartDockMeta}>{formatMoney(totalQuantity)} {totalQuantity === 1 ? t.item : t.items}</Text>
          </View>
          <Text style={styles.cartDockTotal}>{formatMoney(totals.total)} {ar.common.currency}</Text>
        </Pressable>
      ) : null}

      <Modal
        visible={cartOpen}
        animationType="slide"
        transparent
        // زر الرجوع يغلق التنبيه أولًا إن كان ظاهرًا، ثم الورقة
        onRequestClose={() => { if (!appAlert.handleBack()) setCartOpen(false) }}
      >
        <View style={styles.cartModalBackdrop}>
          <View style={styles.cartSheet}>
            <View style={styles.cartSheetHeader}>
              <Pressable style={styles.closeCartButton} onPress={() => setCartOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={21} color={colors.textSecondary} />
              </Pressable>
              <View style={styles.cartSheetTitleWrap}>
                <Text style={styles.cartSheetTitle}>{t.cart}</Text>
                <Text style={styles.cartSheetMeta}>{formatMoney(totalQuantity)} {totalQuantity === 1 ? t.item : t.items}</Text>
              </View>
              <Pressable
                style={styles.clearButton}
                onPress={() => appAlert.confirm({
                  title: t.clearCart,
                  message: t.clearCartConfirm,
                  confirmText: t.clearCart,
                  destructive: true,
                  onConfirm: () => { clear(); setCartOpen(false) },
                })}
              >
                <Ionicons name="trash-outline" size={15} color={colors.danger} />
                <Text style={styles.clearButtonText}>{t.clearCart}</Text>
              </Pressable>
            </View>
            <FlatList
              style={styles.cartSheetList}
              data={lines}
              keyExtractor={item => `${item.productId}:${item.unitId}`}
              renderItem={renderLine}
              contentContainerStyle={styles.cartList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            />
            <View style={styles.footer}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t.subtotal}</Text>
          <Text style={styles.summaryValue}>{formatMoney(totals.subtotal)} <Text style={styles.summaryCurrency}>{ar.common.currency}</Text></Text>
        </View>

        {discountOpen || discount > 0 ? (
          <View style={styles.discountRow}>
            <Pressable
              style={styles.discountLabelWrap}
              onPress={() => {
                setDiscountOpen(false)
                setDiscountInput('')
                setDiscount(0)
              }}
            >
              <Ionicons name="pricetag-outline" size={16} color={colors.violet} />
              <Text style={styles.discountLabel}>{t.hideDiscount}</Text>
            </Pressable>
            <View style={styles.discountInputWrap}>
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
              <Text style={styles.discountCurrency}>{ar.common.currency}</Text>
            </View>
          </View>
        ) : (
          <Pressable style={styles.addDiscountButton} onPress={() => setDiscountOpen(true)} disabled={submitting}>
            <Ionicons name="add-circle-outline" size={17} color={colors.violet} />
            <Text style={styles.addDiscountText}>{t.addDiscount}</Text>
          </Pressable>
        )}

        {totals.discount > 0 ? (
          <View style={styles.summaryRow}>
            <Text style={styles.discountTotalLabel}>{t.totalDiscount}</Text>
            <Text style={styles.discountTotalValue}>− {formatMoney(totals.discount)} {ar.common.currency}</Text>
          </View>
        ) : null}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t.total}</Text>
          <Text style={styles.totalValue}>{formatMoney(totals.total)} <Text style={styles.totalCurrency}>{ar.common.currency}</Text></Text>
        </View>

        <View style={styles.paymentChoices}>
          {PAYMENT_CHOICES.map(choice => (
            <Pressable
              key={choice.method}
              style={[styles.paymentChoice, choice.method === 'CASH' && styles.paymentChoiceCash, choice.method === 'CARD' && styles.paymentChoiceCard, choice.method === 'CREDIT' && styles.paymentChoiceCredit, payDisabled && styles.payDisabled]}
              onPress={() => {
                setPaymentMethod(choice.method)
                setPayError(null)
                if (choice.method === 'CREDIT') {
                  setPayOpen(true)
                } else {
                  void checkout(null)
                }
              }}
              disabled={payDisabled}
            >
              <Ionicons name={choice.icon} size={20} color={colors.onPrimary} />
              <Text style={styles.paymentChoiceText}>{choice.label}</Text>
            </Pressable>
          ))}
        </View>
            </View>
          </View>
        </View>
        {/* التنبيه يُرسم داخل الورقة: طبقة الجذر لا تعلو نافذةً مفتوحة */}
        <AlertHost />
      </Modal>
      <Modal
        visible={!!editingPriceLine}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingPriceLine(null)}
      >
        <View style={styles.priceModalBackdrop}>
          <View style={styles.priceModalCard}>
            <View style={styles.priceModalIcon}><Ionicons name="pricetag-outline" size={24} color={colors.primary} /></View>
            <Text style={styles.priceModalTitle}>تعديل سعر البيع</Text>
            <Text style={styles.priceModalProduct} numberOfLines={1}>{editingPriceLine?.name}</Text>
            <View style={styles.priceInputWrap}>
              <TextInput
                style={styles.priceInput}
                value={priceInput}
                onChangeText={setPriceInput}
                keyboardType="decimal-pad"
                autoFocus
                selectTextOnFocus
                textAlign="center"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.priceInputCurrency}>{ar.common.currency}</Text>
            </View>
            <View style={styles.priceModalActions}>
              <Pressable style={styles.priceCancelButton} onPress={() => setEditingPriceLine(null)}>
                <Text style={styles.priceCancelText}>{ar.common.cancel}</Text>
              </Pressable>
              <Pressable
                style={styles.priceSaveButton}
                onPress={() => {
                  const price = Number(priceInput)
                  if (editingPriceLine && Number.isFinite(price) && price >= 0) {
                    setUnitPrice(editingPriceLine.productId, editingPriceLine.unitId, price)
                    setEditingPriceLine(null)
                  }
                }}
              >
                <Text style={styles.priceSaveText}>حفظ السعر</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  headerShiftBadge: { flexDirection: ROW, alignItems: 'center', gap: 5, backgroundColor: colors.successSoft, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  headerShiftBadgeClosed: { backgroundColor: colors.warningSoft },
  headerShiftDot: { width: 7, height: 7, borderRadius: radius.full, backgroundColor: colors.success },
  headerShiftDotClosed: { backgroundColor: colors.warning },
  headerShiftText: { color: colors.success, fontSize: 10, fontWeight: '800' },
  headerShiftTextClosed: { color: '#B45309' },

  searchRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  scanButton: { width: 56, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, backgroundColor: colors.primary, ...shadow.button },
  searchInputWrap: { flex: 1, flexDirection: ROW, alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.md, backgroundColor: colors.surface, ...shadow.card },
  productSearchInput: { flex: 1, height: control.buttonHeight, color: colors.text, fontSize: fontSize.md },
  actionDisabled: { opacity: 0.48 },

  scannerCard: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.sm, marginTop: spacing.md, gap: spacing.sm, ...shadow.card },
  scannerHeader: { flexDirection: ROW, alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xs },
  scannerTitle: { flex: 1, color: colors.text, fontSize: fontSize.sm, fontWeight: '800', textAlign: 'right' },
  closeScanner: { width: 30, height: 30, borderRadius: radius.full, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  banner: { flexDirection: ROW, alignItems: 'center', gap: spacing.sm, backgroundColor: colors.infoSoft, borderRadius: radius.md, padding: spacing.sm + 2, marginTop: spacing.sm },
  bannerText: { flex: 1, color: colors.primary, fontSize: fontSize.sm, fontWeight: '600', textAlign: 'right' },

  catalogArea: { flex: 1, minHeight: 0 },
  catalogList: { gap: spacing.sm, paddingBottom: spacing.sm },
  catalogLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  catalogHint: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingBottom: spacing.xl },
  catalogHintIcon: { width: 62, height: 62, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  catalogHintText: { color: colors.textSecondary, fontSize: fontSize.sm, textAlign: 'center' },
  // أنماط بطاقة الصنف انتقلت إلى components/cashier/CatalogProductCard.tsx

  clearButton: { flexDirection: ROW, alignItems: 'center', gap: spacing.xs, backgroundColor: colors.dangerSoft, borderRadius: radius.md, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  clearButtonText: { color: colors.danger, fontSize: fontSize.xs, fontWeight: '800' },
  cartDock: { flexDirection: ROW, alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primary, borderRadius: radius.xl, paddingHorizontal: spacing.md, height: 76, marginBottom: spacing.sm, ...shadow.elevated },
  cartDockDisabled: { opacity: 0.52 },
  cartDockCount: { flexDirection: ROW, alignItems: 'center', gap: 3 },
  cartDockCountText: { color: colors.onPrimary, fontSize: fontSize.lg, fontWeight: '900' },
  cartDockTextWrap: { flex: 1, alignItems: ALIGN_RIGHT, gap: 2 },
  cartDockTitle: { color: colors.onPrimary, fontSize: fontSize.md, fontWeight: '800', textAlign: 'right' },
  cartDockMeta: { color: 'rgba(255,255,255,0.72)', fontSize: fontSize.xs, textAlign: 'right' },
  cartDockTotal: { color: colors.onPrimary, fontSize: fontSize.md, fontWeight: '900' },
  cartModalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.45)' },
  cartSheet: { height: '88%', padding: spacing.lg, backgroundColor: colors.background, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, gap: spacing.md },
  cartSheetHeader: { flexDirection: ROW, alignItems: 'center', gap: spacing.sm },
  closeCartButton: { width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  cartSheetTitleWrap: { flex: 1, alignItems: ALIGN_RIGHT },
  cartSheetTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800', textAlign: 'right' },
  cartSheetMeta: { color: colors.textMuted, fontSize: fontSize.xs, textAlign: 'right' },
  cartSheetList: { flex: 1 },
  cartList: { gap: spacing.sm, paddingBottom: spacing.sm },
  lineCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.xl, padding: spacing.md, gap: spacing.sm, ...shadow.card },
  lineTop: { flexDirection: ROW, alignItems: 'center', gap: spacing.sm },
  productIcon: { width: 34, height: 34, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  lineInfo: { flex: 1, alignItems: ALIGN_RIGHT, gap: 2 },
  lineName: { color: colors.text, fontSize: fontSize.sm, fontWeight: '800', textAlign: 'right' },
  lineMeta: { color: colors.textMuted, fontSize: fontSize.xs, textAlign: 'right' },
  removeButton: { width: 31, height: 31, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dangerSoft },
  lineBottom: { flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSoft, paddingTop: spacing.sm },
  linePriceButton: { flexDirection: ROW, alignItems: 'center', gap: 3, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.primarySoft },
  lineTotal: { color: colors.primary, fontSize: fontSize.md, fontWeight: '800' },
  lineCurrency: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '700' },
  stepper: { flexDirection: ROW, alignItems: 'center', gap: spacing.xs, backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft, padding: 2 },
  stepButton: { width: 29, height: 29, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  qtyText: { minWidth: 26, color: colors.text, fontSize: fontSize.sm, fontWeight: '800', textAlign: 'center' },

  footer: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md, gap: spacing.sm, marginBottom: spacing.sm, ...shadow.elevated },
  summaryRow: { flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between' },
  summaryLabel: { color: colors.textSecondary, fontSize: fontSize.sm },
  summaryValue: { color: colors.text, fontSize: fontSize.sm, fontWeight: '700' },
  summaryCurrency: { color: colors.textMuted, fontSize: fontSize.xs },
  addDiscountButton: { flexDirection: ROW, alignItems: 'center', alignSelf: 'flex-start', gap: 3, paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radius.full, backgroundColor: colors.violetSoft },
  addDiscountText: { color: colors.violet, fontSize: fontSize.xs, fontWeight: '800' },
  discountRow: { flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 0 },
  discountLabelWrap: { flexDirection: ROW, alignItems: 'center', gap: spacing.xs },
  discountLabel: { color: colors.violet, fontSize: fontSize.xs, fontWeight: '800' },
  discountInputWrap: { flexDirection: ROW, alignItems: 'center', backgroundColor: colors.violetSoft, borderRadius: radius.full, paddingHorizontal: spacing.sm, height: 32 },
  discountInput: { minWidth: 58, color: colors.text, fontSize: fontSize.sm, fontWeight: '700', paddingVertical: 0 },
  discountCurrency: { color: colors.violet, fontSize: fontSize.xs, fontWeight: '700' },
  discountTotalLabel: { color: colors.danger, fontSize: fontSize.sm },
  discountTotalValue: { color: colors.danger, fontSize: fontSize.sm, fontWeight: '800' },
  totalRow: { flexDirection: ROW, alignItems: 'baseline', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.sm },
  totalLabel: { color: colors.text, fontSize: fontSize.md, fontWeight: '800' },
  totalValue: { color: colors.primary, fontSize: fontSize.xxl, fontWeight: '900', letterSpacing: -0.5 },
  totalCurrency: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '800' },
  paymentChoices: { flexDirection: 'row', gap: spacing.sm },
  paymentChoice: { flex: 1, height: control.buttonHeight, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: radius.lg, ...shadow.button },
  paymentChoiceCash: { backgroundColor: colors.success },
  paymentChoiceCard: { backgroundColor: colors.primary },
  paymentChoiceCredit: { backgroundColor: '#EA580C' },
  paymentChoiceText: { color: colors.onPrimary, fontSize: fontSize.sm, fontWeight: '800' },
  payButton: { flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between', height: control.buttonHeight, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.success, ...shadow.button, shadowColor: colors.success },
  payIcon: { width: 34, height: 34, borderRadius: radius.full, backgroundColor: colors.onPrimary, alignItems: 'center', justifyContent: 'center' },
  payText: { flex: 1, marginHorizontal: spacing.sm, color: colors.onPrimary, fontSize: fontSize.md, fontWeight: '800', textAlign: 'right' },
  payButtonTotal: { color: colors.onPrimary, fontSize: fontSize.md, fontWeight: '900' },
  payDisabled: { opacity: 0.48 },
  priceModalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, backgroundColor: 'rgba(15,23,42,0.5)' },
  priceModalCard: { width: '100%', maxWidth: 360, alignItems: 'center', gap: spacing.sm, borderRadius: radius.xxl, backgroundColor: colors.surface, padding: spacing.xl, ...shadow.elevated },
  priceModalIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full, backgroundColor: colors.primarySoft },
  priceModalTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800' },
  priceModalProduct: { color: colors.textSecondary, fontSize: fontSize.sm, textAlign: 'center' },
  priceInputWrap: { flexDirection: ROW, alignItems: 'center', width: '100%', borderWidth: 1, borderColor: colors.primary, borderRadius: radius.lg, paddingHorizontal: spacing.md },
  priceInput: { flex: 1, height: 52, color: colors.text, fontSize: fontSize.lg, fontWeight: '800' },
  priceInputCurrency: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '800' },
  priceModalActions: { flexDirection: 'row', gap: spacing.sm, width: '100%', marginTop: spacing.sm },
  priceCancelButton: { flex: 1, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.background },
  priceCancelText: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: '700' },
  priceSaveButton: { flex: 1.5, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.primary, ...shadow.button },
  priceSaveText: { color: colors.onPrimary, fontSize: fontSize.sm, fontWeight: '800' },
})
