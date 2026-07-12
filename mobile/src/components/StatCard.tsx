import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'

interface StatCardProps {
  label: string
  value: string
  icon?: keyof typeof Ionicons.glyphMap
  /** لون التمييز (الافتراضي: البنفسجي الأساسي) */
  tint?: string
  tintSoft?: string
  hint?: string
}

export function StatCard({ label, value, icon, tint = colors.primary, tintSoft = colors.primarySoft, hint }: StatCardProps) {
  return (
    <View style={styles.card}>
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: tintSoft }]}>
          <Ionicons name={icon} size={20} color={tint} />
        </View>
      ) : null}
      <View style={styles.content}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, { color: tint }]} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    ...shadow.card,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.lg - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1, gap: 2 },
  label: { color: colors.textSecondary, fontSize: fontSize.sm, textAlign: 'right' },
  value: { fontSize: fontSize.xl, fontWeight: '800', textAlign: 'right' },
  hint: { color: colors.textMuted, fontSize: fontSize.xs, textAlign: 'right' },
})
