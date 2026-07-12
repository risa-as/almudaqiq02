import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { ar } from '@/i18n/ar'
import { useNetworkStore } from '@/stores/network'
import { colors, fontSize, spacing } from '@/theme'

/**
 * لافتة «لا يوجد اتصال» أعلى التطبيق (T047).
 * تظهر عندما يفشل أي طلب بخطأ شبكة (ApiError status 0) — الحالة تُضبط من
 * src/api/client.ts عبر useNetworkStore، وتختفي تلقائيًا مع أول استجابة ناجحة.
 */
export function OfflineBanner() {
  const isOffline = useNetworkStore(s => s.isOffline)
  const insets = useSafeAreaInsets()

  if (!isOffline) return null

  return (
    <View style={[styles.banner, { paddingTop: insets.top + spacing.xs }]}>
      <Ionicons name="cloud-offline-outline" size={16} color={colors.onPrimary} />
      <Text style={styles.text}>{ar.common.offlineNotice}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#1E293B', // slate-800 — واضحة دون أن تكون صارخة
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  text: { color: colors.onPrimary, fontSize: fontSize.sm, fontWeight: '600', textAlign: 'right' },
})
