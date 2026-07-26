import { memo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { ProductSearchResult, ProductUnitDto } from '@/api/endpoints/products'
import { useCartStore } from '@/stores/cart'
import { formatMoney } from '@/utils/format'
import { ar } from '@/i18n/ar'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'
import { ALIGN_RIGHT, ROW } from '@/utils/rtl'

interface CatalogProductCardProps {
  product: ProductSearchResult
  /** إضافة الصنف أو زيادة كميته — يتكفّل بسقف المخزون ورسالة التنبيه */
  onAdd: (product: ProductSearchResult, unit: ProductUnitDto) => void
  /** إنقاص كمية الصنف من الخطوة المصغّرة داخل البطاقة */
  onDecrement: (product: ProductSearchResult, unit: ProductUnitDto) => void
}

/**
 * بطاقة صنف في قائمة البيع.
 *
 * البطاقة نفسها زرّ: كل ضغطة تضيف الصنف أو تزيد كميته بواحد.
 *
 * الأداء: البطاقة تقرأ كميتها من مخزن السلة مباشرة (`useCartStore`) بدل أن تصلها
 * من الشاشة الأم، وهي مغلّفة بـ `memo`. لذلك تعيد الضغطة رسم بطاقة واحدة فقط —
 * قبل ذلك كانت كل ضغطة تعيد رسم القائمة بأكملها فيتأخّر ظهور حالة الاختيار.
 * لا تُمرَّر أي دوال سهمية مضمّنة إلى هذه البطاقة وإلا بطل أثر `memo`.
 */
export const CatalogProductCard = memo(function CatalogProductCard({
  product,
  onAdd,
  onDecrement,
}: CatalogProductCardProps) {
  const unit = product.units[0]
  const qty = useCartStore(s => {
    if (!unit) return 0
    const line = s.lines.find(l => l.productId === product.id && l.unitId === unit.unitId)
    return line?.qty ?? 0
  })

  if (!unit) return null

  const outOfStock = product.baseStock <= 0
  const selected = qty > 0

  return (
    <Pressable
      // الضغط لا يُعطَّل عند نفاد المخزون: المخزن يردّ برسالة توضّح الكمية المتاحة
      style={({ pressed }) => [styles.card, selected && styles.cardSelected, pressed && styles.cardPressed]}
      onPress={() => onAdd(product, unit)}
      // تموّج أندرويد يُرسم على الخيط الأصلي فيؤكّد اللمسة فورًا حتى وجافاسكربت مشغول
      android_ripple={{ color: 'rgba(21,94,133,0.12)' }}
      accessibilityRole="button"
      accessibilityLabel={`إضافة ${product.name}`}
    >
      <View style={styles.thumb}><Ionicons name="cube-outline" size={24} color={colors.primary} /></View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{product.name}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.price}>{formatMoney(unit.price)} {ar.common.currency}</Text>
          <View style={[styles.stockChip, outOfStock && styles.stockChipOut]}>
            <Text style={[styles.stockChipText, outOfStock && styles.stockChipTextOut]}>{outOfStock ? 'نفد المخزون' : 'متوفر'}</Text>
          </View>
        </View>
      </View>
      {selected ? (
        // يمنع أي لمسة داخل حدود الخطوة من الوصول إلى البطاقة، فلا يزيد ضغطُ «−» الكمية بالخطأ
        <View style={styles.stepper} onStartShouldSetResponder={() => true}>
          <Pressable style={styles.stepButton} onPress={() => onAdd(product, unit)} hitSlop={4}>
            <Ionicons name="add" size={20} color={colors.primary} />
          </Pressable>
          <Text style={styles.qty}>{formatMoney(qty)}</Text>
          <Pressable style={styles.stepButton} onPress={() => onDecrement(product, unit)} hitSlop={4}>
            <Ionicons name="remove" size={20} color={colors.primary} />
          </Pressable>
        </View>
      ) : (
        <View style={[styles.addBadge, outOfStock && styles.addBadgeDisabled]}>
          <Ionicons name="add" size={25} color={colors.onPrimary} />
        </View>
      )}
    </Pressable>
  )
})

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderSoft, ...shadow.card },
  cardSelected: { borderColor: colors.primary, borderWidth: 1.5, backgroundColor: colors.primarySoft },
  cardPressed: { backgroundColor: colors.primarySoft, opacity: 0.85 },
  thumb: { width: 54, height: 54, borderRadius: radius.lg, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: spacing.sm, alignItems: ALIGN_RIGHT },
  name: { color: colors.text, fontSize: fontSize.md, fontWeight: '800', textAlign: 'right' },
  metaRow: { flexDirection: ROW, alignItems: 'center', gap: spacing.sm },
  price: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: '700' },
  stockChip: { backgroundColor: colors.successSoft, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  stockChipOut: { backgroundColor: colors.dangerSoft },
  stockChipText: { color: colors.success, fontSize: fontSize.xs, fontWeight: '800' },
  stockChipTextOut: { color: colors.danger },
  addBadge: { width: 48, height: 48, borderRadius: radius.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadow.button },
  addBadgeDisabled: { backgroundColor: colors.textMuted, shadowOpacity: 0 },
  stepper: { flexDirection: ROW, alignItems: 'center', gap: spacing.xs, backgroundColor: colors.surface, padding: 3, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSoft },
  stepButton: { width: 32, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  qty: { minWidth: 20, color: colors.primary, fontSize: fontSize.md, fontWeight: '900', textAlign: 'center' },
})
