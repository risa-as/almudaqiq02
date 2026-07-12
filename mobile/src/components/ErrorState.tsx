import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { ApiError } from '@/api/client'
import { ar } from '@/i18n/ar'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'

interface ErrorStateProps {
  error?: unknown
  message?: string
  onRetry?: () => void
}

/** يعرض رسالة الخطأ العربية القادمة من الخادم كما هي، مع زر إعادة محاولة. */
export function ErrorState({ error, message, onRetry }: ErrorStateProps) {
  const text =
    message ??
    (error instanceof ApiError ? error.message : error instanceof Error ? ar.common.unexpectedError : ar.common.unexpectedError)

  return (
    <View style={styles.root}>
      <Ionicons name="alert-circle-outline" size={44} color={colors.danger} />
      <Text style={styles.text}>{text}</Text>
      {onRetry ? (
        <Pressable style={styles.button} onPress={onRetry}>
          <Text style={styles.buttonText}>{ar.common.retry}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  text: { color: colors.text, fontSize: fontSize.md, textAlign: 'center', lineHeight: 22 },
  button: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xxl,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    ...shadow.button,
  },
  buttonText: { color: colors.onPrimary, fontSize: fontSize.md, fontWeight: '700' },
})
