import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/client'
import {
  checkBarcode,
  fetchBatches,
  fetchInventoryProducts,
  type InventoryProduct,
} from '@/api/endpoints/inventory'
import { BarcodeScannerView } from '@/components/BarcodeScannerView'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { LoadingView } from '@/components/LoadingView'
import { Screen } from '@/components/Screen'
import { NewProductModal } from '@/components/stock/NewProductModal'
import { ar } from '@/i18n/ar'
import { useAuthStore } from '@/stores/auth'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'
import { formatDate, formatMoney } from '@/utils/format'
import { ALIGN_RIGHT, ROW } from '@/utils/rtl'

const S = {
  title: 'المخزون',
  scan: 'مسح باركود للاستعلام',
  lowStock: 'منخفض',
  outOfStock: 'نافد',
  notFound: 'المنتج غير موجود',
  qty: 'الكمية الحالية',
  category: 'التصنيف',
  supplier: 'المورد',
  batches: 'الدفعات وتواريخ الصلاحية',
  noBatches: 'لا توجد دفعات لهذا المنتج في فرعك',
  batchesLoading: 'جارٍ تحميل الدفعات…',
  batchesError: 'تعذر تحميل الدفعات',
  units: 'الوحدات والأسعار',
  expiry: 'الصلاحية',
  noExpiry: 'بدون تاريخ',
  scanHint: 'وجّه الكاميرا نحو باركود المنتج للاستعلام عنه',
  created: (name: string) => `تمت إضافة «${name}» إلى المخزون`,
}

const PAGE_SIZE = 30
/** مدة بقاء لافتة نتيجة المسح — نفس قيمة شاشة البيع */
const BANNER_MS = 3000
const DEFAULT_MIN_STOCK = 10 // نفس افتراض /api/inventory/alerts

/** نموذج موحّد لبطاقة المنتج (من القائمة أو من مسح الباركود). */
interface LookupProduct {
  id: string
  name: string
  stock: number | null
  categoryName?: string | null
  supplierName?: string | null
  units: { name: string; price: number | string; barcode: string | null; conversionFactor: number }[]
}

function isLow(stock: number, minimumStock: number): boolean {
  const threshold = minimumStock > 0 ? minimumStock : DEFAULT_MIN_STOCK
  return stock <= threshold
}

export default function StockInventory() {
  const branchId = useAuthStore(s => s.user?.branchId ?? null)
  const queryClient = useQueryClient()

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [selected, setSelected] = useState<LookupProduct | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  /** باركود مقروء لم يُعثر عليه → يفتح نموذج إضافة منتج بهذا الباركود */
  const [newProductBarcode, setNewProductBarcode] = useState<string | null>(null)
  // لافتة عابرة بدل بانر خطأ ثابت — نفس سلوك شاشة البيع
  const [banner, setBanner] = useState<{ text: string; error: boolean } | null>(null)
  const [scanBusy, setScanBusy] = useState(false)
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (bannerTimer.current) clearTimeout(bannerTimer.current)
    },
    [],
  )

  const showBanner = useCallback((text: string, error = false) => {
    setBanner({ text, error })
    if (bannerTimer.current) clearTimeout(bannerTimer.current)
    bannerTimer.current = setTimeout(() => setBanner(null), BANNER_MS)
  }, [])

  const productsQuery = useQuery({
    queryKey: ['products', branchId],
    queryFn: () => fetchInventoryProducts(branchId),
  })

  // دفعات الفرع — تُجلب عند فتح بطاقة منتج (الخادم لا يدعم فلتر productId)
  const batchesQuery = useQuery({
    queryKey: ['batches', branchId],
    queryFn: () => fetchBatches(branchId),
    enabled: selected !== null,
    staleTime: 60_000,
  })

  const listData: InventoryProduct[] = useMemo(
    () => (productsQuery.data ?? []).slice(0, visibleCount),
    [productsQuery.data, visibleCount],
  )

  const totalCount = productsQuery.data?.length ?? 0

  const openProduct = (p: InventoryProduct) => {
    setSelected({
      id: p.id,
      name: p.name,
      stock: p.baseStock,
      categoryName: p.category?.name ?? null,
      supplierName: p.supplier?.name ?? null,
      units: p.units.map(u => ({ name: u.unitName, price: u.price, barcode: u.barcode, conversionFactor: u.conversionFactor })),
    })
  }

  // نفس تدفّق شاشة البيع: الماسح يُغلق فور انتهاء القراءة (نجحت أم لا) ثم تظهر
  // النتيجة — بطاقة المنتج عند العثور عليه، أو لافتة عابرة خلاف ذلك.
  const onScanned = async (code: string) => {
    if (scanBusy) return
    setScanBusy(true)
    try {
      const res = await checkBarcode(code)
      if (!res.found || !res.product) {
        // باركود غير مسجّل → نموذج إضافة منتج بالباركود جاهزًا (نظير ?barcode= في الويب)
        setNewProductBarcode(code)
        setScannerOpen(false)
        return
      }
      // رصيد الفرع من قائمة المنتجات إن وُجد (check-barcode يعيد الرصيد العام فقط)
      const local = productsQuery.data?.find(p => p.id === res.product!.id)
      setSelected({
        id: res.product.id,
        name: res.product.name,
        stock: local ? local.baseStock : res.product.baseStock,
        categoryName: res.product.categoryName ?? null,
        supplierName: res.product.supplierName ?? null,
        units: res.product.units.map(u => ({ name: u.name, price: u.price, barcode: u.barcode, conversionFactor: u.conversionFactor })),
      })
      setScannerOpen(false)
    } catch (err) {
      // 404 من الخادم يعني كذلك «باركود غير مسجّل» → نفس نموذج الإضافة
      if (err instanceof ApiError && err.status === 404) setNewProductBarcode(code)
      else if (err instanceof ApiError) showBanner(err.message, true)
      else showBanner(S.notFound, true)
      setScannerOpen(false)
    } finally {
      setScanBusy(false)
    }
  }

  const onProductCreated = (name: string) => {
    setNewProductBarcode(null)
    showBanner(S.created(name))
    // القائمة والدفعات كلاهما يتأثر بمنتج جديد له كمية ابتدائية
    queryClient.invalidateQueries({ queryKey: ['products', branchId] })
    queryClient.invalidateQueries({ queryKey: ['batches', branchId] })
  }

  const selectedBatches = useMemo(
    () => (selected ? (batchesQuery.data ?? []).filter(b => b.productId === selected.id) : []),
    [selected, batchesQuery.data],
  )

  if (productsQuery.isLoading) {
    return (
      <Screen title={S.title} scroll={false}>
        <LoadingView />
      </Screen>
    )
  }

  if (productsQuery.isError) {
    return (
      <Screen title={S.title} scroll={false}>
        <ErrorState error={productsQuery.error} onRetry={() => productsQuery.refetch()} />
      </Screen>
    )
  }

  return (
    <Screen title={S.title} scroll={false}>
      <View style={styles.tools}>
        {/* الإجراء الوحيد على الشاشة بعد إزالة البحث → زر عريض بعرض الشاشة */}
        <Pressable
          style={({ pressed }) => [styles.scanButton, pressed && styles.scanButtonPressed]}
          onPress={() => setScannerOpen(true)}
          disabled={scannerOpen}
          accessibilityRole="button"
          accessibilityLabel={S.scan}
        >
          <View style={styles.scanIconTile}>
            <Ionicons name="scan-outline" size={24} color={colors.onPrimary} />
          </View>
          <Text style={styles.scanLabelText}>{S.scan}</Text>
          <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.7)" />
        </Pressable>
        {banner ? (
          <View style={[styles.banner, banner.error && styles.bannerError]}>
            <Ionicons
              name={banner.error ? 'alert-circle' : 'information-circle'}
              size={16}
              color={banner.error ? colors.danger : colors.primary}
            />
            <Text style={[styles.bannerText, banner.error && styles.bannerTextError]}>{banner.text}</Text>
          </View>
        ) : null}
      </View>

      <Modal visible={scannerOpen} animationType="fade" onRequestClose={() => setScannerOpen(false)}>
        <BarcodeScannerView
          fullScreen
          hint={S.scanHint}
          onClose={() => setScannerOpen(false)}
          onScanned={onScanned}
          paused={scanBusy || selected !== null}
        />
      </Modal>

      {/* يُركَّب عند وجود باركود فقط فتبدأ حقوله فارغة في كل مرة (بدل تصفيرها بمؤثّر)،
          وظهوره مشروط بإغلاق الماسح — نفس سبب اشتراط بطاقة المنتج أدناه. */}
      {newProductBarcode !== null ? (
        <NewProductModal
          key={newProductBarcode}
          visible={!scannerOpen}
          barcode={newProductBarcode}
          branchId={branchId}
          onClose={() => setNewProductBarcode(null)}
          onCreated={onProductCreated}
        />
      ) : null}

      <FlatList
        data={listData}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={productsQuery.isRefetching}
            onRefresh={() => productsQuery.refetch()}
            tintColor={colors.primary}
          />
        }
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (visibleCount < totalCount) setVisibleCount(c => c + PAGE_SIZE)
        }}
        ListEmptyComponent={<EmptyState icon="cube-outline" />}
        renderItem={({ item }) => {
          const low = isLow(item.baseStock, item.minimumStock)
          const out = item.baseStock <= 0
          const tint = out ? colors.danger : low ? colors.warning : colors.primary
          const tintSoft = out ? colors.dangerSoft : low ? colors.warningSoft : colors.primarySoft
          return (
            <Pressable style={styles.row} onPress={() => openProduct(item)}>
              <View style={styles.rowLead}>
                <View style={[styles.iconBox, { backgroundColor: tintSoft }]}>
                  <Ionicons name="cube-outline" size={20} color={tint} />
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                  {item.category?.name ? (
                    <Text style={styles.rowMeta} numberOfLines={1}>{item.category.name}</Text>
                  ) : null}
                </View>
              </View>
              <View style={styles.rowSide}>
                <Text style={[styles.rowQty, out ? styles.qtyOut : low ? styles.qtyLow : null]}>
                  {formatMoney(item.baseStock)}
                </Text>
                {out ? (
                  <View style={[styles.badge, { backgroundColor: colors.dangerSoft }]}>
                    <Text style={[styles.badgeText, { color: colors.danger }]}>{S.outOfStock}</Text>
                  </View>
                ) : low ? (
                  <View style={[styles.badge, { backgroundColor: colors.warningSoft }]}>
                    <Text style={[styles.badgeText, { color: colors.warning }]}>{S.lowStock}</Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          )
        }}
      />

      {/* بطاقة المنتج: معلومات + وحدات + دفعات بصلاحياتها.
          مشروطة بإغلاق الماسح: تقديم نافذة أصلية أثناء إغلاق أخرى قد يُسقط الثانية. */}
      <Modal
        visible={selected !== null && !scannerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelected(null)} />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={2}>{selected?.name}</Text>
              <Pressable onPress={() => setSelected(null)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              <View style={styles.infoBox}>
                <View style={styles.metaRow}>
                  <View style={styles.metaLabelWrap}>
                    <Ionicons name="layers-outline" size={15} color={colors.textMuted} />
                    <Text style={styles.metaLabel}>{S.qty}</Text>
                  </View>
                  <Text style={styles.metaValue} numberOfLines={1}>
                    {selected?.stock == null ? '—' : formatMoney(selected.stock)}
                  </Text>
                </View>
                {selected?.categoryName ? (
                  <View style={[styles.metaRow, styles.metaDivider]}>
                    <View style={styles.metaLabelWrap}>
                      <Ionicons name="pricetags-outline" size={15} color={colors.textMuted} />
                      <Text style={styles.metaLabel}>{S.category}</Text>
                    </View>
                    <Text style={styles.metaValue} numberOfLines={1}>{selected.categoryName}</Text>
                  </View>
                ) : null}
                {selected?.supplierName ? (
                  <View style={[styles.metaRow, styles.metaDivider]}>
                    <View style={styles.metaLabelWrap}>
                      <Ionicons name="business-outline" size={15} color={colors.textMuted} />
                      <Text style={styles.metaLabel}>{S.supplier}</Text>
                    </View>
                    <Text style={styles.metaValue} numberOfLines={1}>{selected.supplierName}</Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.sectionTitle}>{S.units}</Text>
              <View style={styles.groupBox}>
                {(selected?.units ?? []).map((u, i) => (
                  <View key={`${u.name}-${i}`} style={[styles.unitRow, i > 0 && styles.rowDivider]}>
                    <Text style={styles.unitName}>{u.name}</Text>
                    <Text style={styles.unitPrice}>
                      {formatMoney(u.price)} <Text style={styles.unitCurrency}>{ar.common.currency}</Text>
                    </Text>
                  </View>
                ))}
              </View>

              <Text style={styles.sectionTitle}>{S.batches}</Text>
              {batchesQuery.isLoading ? (
                <Text style={styles.batchHint}>{S.batchesLoading}</Text>
              ) : batchesQuery.isError ? (
                <Text style={[styles.batchHint, { color: colors.danger }]}>{S.batchesError}</Text>
              ) : selectedBatches.length === 0 ? (
                <Text style={styles.batchHint}>{S.noBatches}</Text>
              ) : (
                <View style={styles.groupBox}>
                  {selectedBatches.map((b, i) => (
                    <View key={b.id} style={[styles.batchRow, i > 0 && styles.rowDivider]}>
                      <View style={styles.batchInfo}>
                        <Text style={styles.batchNumber}>{b.batchNumber}</Text>
                        <Text style={styles.batchExpiry}>
                          {S.expiry}: {b.expiryDate ? formatDate(b.expiryDate) : S.noExpiry}
                        </Text>
                      </View>
                      <Text style={styles.batchQty}>{formatMoney(b.quantity)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  )
}

const styles = StyleSheet.create({
  tools: { gap: spacing.sm, paddingBottom: spacing.sm },
  // زر المسح: بلاطة أيقونة شفافة يمينًا ↔ سهم يسارًا، بزوايا صغيرة لا حبّة دواء
  scanButton: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.md,
    height: 60,
    paddingHorizontal: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    ...shadow.button,
  },
  scanButtonPressed: { backgroundColor: colors.primaryDark },
  scanIconTile: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  scanLabelText: {
    flex: 1,
    color: colors.onPrimary,
    fontSize: fontSize.md,
    fontWeight: '800',
    textAlign: 'right',
  },
  // لافتة عابرة (تختفي وحدها) — بنفس شكل لافتة شاشة البيع، بتلوين أحمر عند الخطأ
  banner: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.infoSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  bannerError: { backgroundColor: colors.dangerSoft },
  bannerText: { flex: 1, color: colors.primary, fontSize: fontSize.sm, fontWeight: '600', textAlign: 'right' },
  bannerTextError: { color: colors.danger },
  listContent: { paddingBottom: spacing.xxl, gap: spacing.sm },
  row: {
    flexDirection: ROW,
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  rowLead: { flex: 1, flexDirection: ROW, alignItems: 'center', gap: spacing.md },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: { flex: 1, gap: 2, alignItems: ALIGN_RIGHT },
  rowName: { fontSize: fontSize.md, fontWeight: '600', color: colors.text, textAlign: 'right' },
  rowMeta: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'right' },
  rowSide: { alignItems: 'center', gap: 4 },
  rowQty: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text },
  qtyLow: { color: colors.warning },
  qtyOut: { color: colors.danger },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  badgeText: { fontSize: fontSize.xs, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    maxHeight: '80%',
    paddingBottom: spacing.xl,
  },
  modalHeader: {
    flexDirection: ROW,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { flex: 1, fontSize: fontSize.lg, fontWeight: '700', color: colors.text, textAlign: 'right' },
  modalBody: { padding: spacing.lg, gap: spacing.sm },
  infoBox: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
  },
  metaRow: {
    flexDirection: ROW,
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  metaDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  metaLabelWrap: { flexDirection: ROW, alignItems: 'center', gap: spacing.xs },
  metaLabel: { color: colors.textSecondary, fontSize: fontSize.sm },
  metaValue: { color: colors.text, fontSize: fontSize.md, fontWeight: '700', flexShrink: 1, textAlign: 'left' },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: spacing.md,
  },
  groupBox: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
  },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  unitRow: {
    flexDirection: ROW,
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  unitName: { color: colors.text, fontSize: fontSize.sm, textAlign: 'right', flexShrink: 1 },
  unitPrice: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '700', textAlign: 'left' },
  unitCurrency: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '600' },
  batchHint: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center', paddingVertical: spacing.sm },
  batchRow: {
    flexDirection: ROW,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  batchInfo: { flex: 1, gap: 2, alignItems: ALIGN_RIGHT },
  batchNumber: { color: colors.text, fontSize: fontSize.sm, fontWeight: '600', textAlign: 'right' },
  batchExpiry: { color: colors.textSecondary, fontSize: fontSize.xs, textAlign: 'right', writingDirection: 'rtl' },
  batchQty: { color: colors.primary, fontSize: fontSize.md, fontWeight: '800', textAlign: 'left' },
})
