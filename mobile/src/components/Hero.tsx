import { StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'

export interface HeroChip {
  icon: keyof typeof Ionicons.glyphMap
  text: string
}

interface HeroProps {
  /** سطر الترحيب، مثل: "مساء الخير، أحمد 👋" */
  greeting: string
  /** العنوان الكبير (اسم المتجر أو الدور) */
  title: string
  /** أيقونة الأفاتار (الافتراضي: متجر) */
  icon?: keyof typeof Ionicons.glyphMap
  /** شرائح أسفل الهيدر (تاريخ، فرع، دور…) */
  chips?: HeroChip[]
}

/**
 * بطاقة الهيدر البطولية المشتركة (نيلي → بنفسجي) مع دوائر زخرفية وأفاتار
 * وشرائح سفلية — تُستخدم في الرئيسية وحساب الكاشير وواجهة أمين المخزن.
 */
export function Hero({ greeting, title, icon = 'storefront', chips = [] }: HeroProps) {
  return (
    <LinearGradient
      colors={[colors.gradientFrom, colors.gradientTo]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <View style={styles.blob1} pointerEvents="none" />
      <View style={styles.blob2} pointerEvents="none" />

      <View style={styles.top}>
        <View style={styles.avatar}>
          <Ionicons name={icon} size={22} color={colors.onPrimary} />
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.greeting} numberOfLines={1}>
            {greeting}
          </Text>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
      </View>

      {chips.length > 0 ? (
        <View style={styles.footer}>
          {chips.map((c, i) => (
            <View key={i} style={styles.chip}>
              <Ionicons name={c.icon} size={13} color={colors.onPrimary} />
              <Text style={styles.chipText} numberOfLines={1}>
                {c.text}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: radius.xxl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.lg,
    overflow: 'hidden',
    ...shadow.button,
  },
  blob1: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.10)',
    top: -55,
    left: -35,
  },
  blob2: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.08)',
    bottom: -50,
    right: -20,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1, gap: 3 },
  greeting: { color: 'rgba(255,255,255,0.88)', fontSize: fontSize.sm, fontWeight: '600', textAlign: 'right' },
  title: { color: colors.onPrimary, fontSize: fontSize.xl, fontWeight: '800', textAlign: 'right', letterSpacing: -0.3 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
    flexShrink: 1,
  },
  chipText: { color: colors.onPrimary, fontSize: fontSize.xs, fontWeight: '700' },
})
