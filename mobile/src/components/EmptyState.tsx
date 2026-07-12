import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { ar } from '@/i18n/ar'
import { colors, fontSize, spacing } from '@/theme'

interface EmptyStateProps {
  message?: string
  icon?: keyof typeof Ionicons.glyphMap
}

export function EmptyState({ message, icon = 'file-tray-outline' }: EmptyStateProps) {
  return (
    <View style={styles.root}>
      <Ionicons name={icon} size={44} color={colors.textMuted} />
      <Text style={styles.text}>{message ?? ar.common.empty}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  text: { color: colors.textSecondary, fontSize: fontSize.md, textAlign: 'center' },
})
