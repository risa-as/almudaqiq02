import { useMemo, useState } from 'react'
import {
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
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { ApiError } from '@/api/client'
import {
  checkBarcode,
  fetchBatches,
  fetchInventoryProducts,
  searchProducts,
  type InventoryProduct,
} from '@/api/endpoints/inventory'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { LoadingView } from '@/components/LoadingView'
import { Screen } from '@/components/Screen'
import { CollapsibleScanner } from '@/components/stock/CollapsibleScanner'
import { useAuthStore } from '@/stores/auth'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'
import { formatDate, formatMoney } from '@/utils/format'

const S = {
  title: 'المخزون',
  searchPlaceholder: 'ابحث باسم المنتج…',
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
  searchHint: 'اكتب حرفين على الأقل للبحث الخادمي',
}

const PAGE_SIZE = 30
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

  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [selected, setSelected] = useState<LookupProduct | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanBusy, setScanBusy] = useState(false)

  const productsQuery = useQuery({
    queryKey: ['products', branchId],
    queryFn: () => fetchInventoryProducts(branchId),
  })

  const trimmed = query.trim()
  const serverSearch = trimmed.length >= 2

  // بحث خادمي (بديل كامل للكاميرا وللكتالوجات الكبيرة) — يعمل فقط عند كتابة استعلام
  const searchQuery = useQuery({
    queryKey: ['product-search', trimmed, branchId],
    queryFn: () => searchProducts(trimmed, branchId),
    enabled: serverSearch,
  })

  // دفعات الفرع — تُجلب عند فتح بطاقة منتج (الخادم لا يدعم فلتر productId)
  const batchesQuery = useQuery({
    queryKey: ['batches', branchId],
    queryFn: () => fetchBatches(branchId),
    enabled: selected !== null,
    staleTime: 60_000,
  })

  const listData: InventoryProduct[] = useMemo(() => {
    if (serverSearch) {
      return (searchQuery.data ?? []).map(r => ({
        id: r.id,
        name: r.name,
        baseStock: r.baseStock,
        minimumStock: 0,
        costPrice: 0,
        units: r.units,
      }))
    }
    return (productsQuery.data ?? []).slice(0, visibleCount)
  }, [serverSearch, searchQuery.data, productsQuery.data, visibleCount])

  const totalCount = serverSearch ? (searchQuery.data?.length ?? 0) : (productsQuery.data?.length ?? 0)

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

  const onScanned = async (code: string) => {
    if (scanBusy) return
    setScanBusy(true)
    setScanError(null)
    try {
      const res = await checkBarcode(code)
      if (!res.found || !res.product) {
        setScanError(S.notFound)
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
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setScanError(S.notFound)
      else if (err instanceof ApiError) setScanError(err.message)
      else setScanError(S.notFound)
    } finally {
      setScanBusy(false)
    }
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
        <CollapsibleScanner onScanned={onScanned} paused={scanBusy || selected !== null} openLabel={S.scan} />
        {scanError ? (
          <View style={styles.scanErrorBanner}>
            <Ionicons name="alert-circle" size={16} color={colors.danger} />
            <Text style={styles.scanErrorText}>{scanError}</Text>
            <Pressable onPress={() => setScanError(null)} hitSlop={8}>
              <Ionicons name="close" size={16} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : null}
        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={S.searchPlaceholder}
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
        {trimmed.length === 1 ? <Text style={styles.searchHint}>{S.searchHint}</Text> : null}
      </View>

      {serverSearch && searchQuery.isLoading ? (
        <LoadingView />
      ) : serverSearch && searchQuery.isError ? (
        <ErrorState error={searchQuery.error} onRetry={() => searchQuery.refetch()} />
      ) : (
        <FlatList
          data={listData}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={productsQuery.isRefetching}
              onRefresh={() => productsQuery.refetch()}
              tintColor={colors.primary}
            />
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (!serverSearch && visibleCount < totalCount) setVisibleCount(c => c + PAGE_SIZE)
          }}
          ListEmptyComponent={<EmptyState icon="cube-outline" />}
          renderItem={({ item }) => {
            const low = isLow(item.baseStock, item.minimumStock)
            const out = item.baseStock <= 0
            return (
              <Pressable style={styles.row} onPress={() => openProduct(item)}>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                  {item.category?.name ? <Text style={styles.rowMeta}>{item.category.name}</Text> : null}
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
      )}

      {/* بطاقة المنتج: معلومات + وحدات + دفعات بصلاحياتها */}
      <Modal visible={selected !== null} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
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
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>{S.qty}</Text>
                <Text style={styles.metaValue}>{selected?.stock == null ? '—' : formatMoney(selected.stock)}</Text>
              </View>
              {selected?.categoryName ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>{S.category}</Text>
                  <Text style={styles.metaValue}>{selected.categoryName}</Text>
                </View>
              ) : null}
              {selected?.supplierName ? (
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>{S.supplier}</Text>
                  <Text style={styles.metaValue}>{selected.supplierName}</Text>
                </View>
              ) : null}

              <Text style={styles.sectionTitle}>{S.units}</Text>
              {(selected?.units ?? []).map((u, i) => (
                <View key={`${u.name}-${i}`} style={styles.unitRow}>
                  <Text style={styles.unitName}>{u.name}</Text>
                  <Text style={styles.unitPrice}>{formatMoney(u.price)}</Text>
                </View>
              ))}

              <Text style={styles.sectionTitle}>{S.batches}</Text>
              {batchesQuery.isLoading ? (
                <Text style={styles.batchHint}>{S.batchesLoading}</Text>
              ) : batchesQuery.isError ? (
                <Text style={[styles.batchHint, { color: colors.danger }]}>{S.batchesError}</Text>
              ) : selectedBatches.length === 0 ? (
                <Text style={styles.batchHint}>{S.noBatches}</Text>
              ) : (
                selectedBatches.map(b => (
                  <View key={b.id} style={styles.batchRow}>
                    <View style={styles.batchInfo}>
                      <Text style={styles.batchNumber}>{b.batchNumber}</Text>
                      <Text style={styles.batchExpiry}>
                        {S.expiry}: {b.expiryDate ? formatDate(b.expiryDate) : S.noExpiry}
                      </Text>
                    </View>
                    <Text style={styles.batchQty}>{formatMoney(b.quantity)}</Text>
                  </View>
                ))
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    fontSize: fontSize.md,
    color: colors.text,
    textAlign: 'right',
  },
  searchHint: { color: colors.textMuted, fontSize: fontSize.xs, textAlign: 'right' },
  scanErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  scanErrorText: { flex: 1, color: colors.danger, fontSize: fontSize.sm, textAlign: 'right' },
  listContent: { paddingBottom: spacing.xxl, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  rowInfo: { flex: 1, gap: 2 },
  rowName: { fontSize: fontSize.md, fontWeight: '600', color: colors.text, textAlign: 'right' },
  rowMeta: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'right' },
  rowSide: { alignItems: 'center', gap: 4 },
  rowQty: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text },
  qtyLow: { color: colors.warning },
  qtyOut: { color: colors.danger },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { flex: 1, fontSize: fontSize.lg, fontWeight: '700', color: colors.text, textAlign: 'right' },
  modalBody: { padding: spacing.lg, gap: spacing.sm },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaLabel: { color: colors.textSecondary, fontSize: fontSize.sm },
  metaValue: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: spacing.md,
  },
  unitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  unitName: { color: colors.text, fontSize: fontSize.sm },
  unitPrice: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '700' },
  batchHint: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center', paddingVertical: spacing.sm },
  batchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  batchInfo: { flex: 1, gap: 2 },
  batchNumber: { color: colors.text, fontSize: fontSize.sm, fontWeight: '600', textAlign: 'right' },
  batchExpiry: { color: colors.textSecondary, fontSize: fontSize.xs, textAlign: 'right' },
  batchQty: { color: colors.primary, fontSize: fontSize.md, fontWeight: '800' },
})
