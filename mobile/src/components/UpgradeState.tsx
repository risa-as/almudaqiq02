import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { ar } from '@/i18n/ar'
import { colors, fontSize, radius, spacing } from '@/theme'

/** حالة "الميزة مقفلة بالخطة" — تُعرض عند الوصول المباشر لشاشة مبوّبة بميزة غير مفعّلة. */
export function UpgradeState({ featureLabel }: { featureLabel?: string }) {
  return (
    <View style={styles.root}>
      <View style={styles.iconWrap}>
        <Ionicons name="lock-closed" size={32} color={colors.violet} />
      </View>
      <Text style={styles.title}>{featureLabel ?? ar.features.locked}</Text>
      <Text style={styles.subtitle}>{ar.features.lockedHint}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm, backgroundColor: colors.background },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center' },
})
