import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Screen } from '@/components/Screen'
import { colors, fontSize, spacing } from '@/theme'

/** شاشة مؤقتة أثناء البناء التدريجي — تُستبدل بالتنفيذ الفعلي. */
export function Placeholder({ title }: { title: string }) {
  return (
    <Screen title={title} scroll={false}>
      <View style={styles.body}>
        <Ionicons name="construct-outline" size={40} color={colors.textMuted} />
        <Text style={styles.text}>قيد الإنشاء</Text>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  text: { color: colors.textSecondary, fontSize: fontSize.md },
})
