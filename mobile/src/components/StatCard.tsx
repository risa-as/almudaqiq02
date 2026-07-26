import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'
import { ALIGN_RIGHT, ROW } from '@/utils/rtl'

interface StatCardProps {
  label: string
  value: string
  icon?: keyof typeof Ionicons.glyphMap
  /** لون التمييز (الافتراضي: البنفسجي الأساسي) */
  tint?: string
  tintSoft?: string
  /** وحدة القيمة (مثل «د.ع») — تُعرض بجانب الرقم في نفس السطر، لا في سطر مستقل. */
  unit?: string
  /** سطر وصفي أسفل القيمة (مثل «3 عملية») — للوصف لا للوحدة. */
  hint?: string
}

/**
 * بطاقة مؤشّر. البطاقتان تتجاوران بنصف عرض الشاشة، فالتخطيط عمودي عمدًا:
 * الأيقونة فوق، ثم التسمية والقيمة بكامل عرض البطاقة — لو وُضعت الأيقونة بجانب
 * النص لتقلّص عرضه إلى ~70 نقطة فانكسرت كل كلمة في سطر.
 */
export function StatCard({
  label,
  value,
  icon,
  tint = colors.primary,
  tintSoft = colors.primarySoft,
  unit,
  hint,
}: StatCardProps) {
  return (
    <View style={styles.card}>
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: tintSoft }]}>
          <Ionicons name={icon} size={18} color={tint} />
        </View>
      ) : null}

      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>

      <View style={styles.valueRow}>
        <Text
          style={[styles.value, { color: tint }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {value}
        </Text>
        {unit ? <Text style={[styles.unit, { color: tint }]}>{unit}</Text> : null}
      </View>

      {hint ? (
        <Text style={styles.hint} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: ALIGN_RIGHT,
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    ...shadow.card,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: '600', textAlign: 'right' },
  // الرقم والوحدة في سطر واحد؛ flexShrink يسمح للرقم بالتقلّص بدل دفع «د.ع» لسطر جديد.
  valueRow: { flexDirection: ROW, alignItems: 'baseline', gap: 4, maxWidth: '100%' },
  value: { flexShrink: 1, fontSize: fontSize.xl, fontWeight: '800' },
  unit: { fontSize: fontSize.xs, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: fontSize.xs, textAlign: 'right' },
})
