import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { ar } from '@/i18n/ar'
import { colors, fontSize, spacing } from '@/theme'

export function LoadingView({ message }: { message?: string }) {
  return (
    <View style={styles.root}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.text}>{message ?? ar.common.loading}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, gap: spacing.md },
  text: { color: colors.textSecondary, fontSize: fontSize.md },
})
