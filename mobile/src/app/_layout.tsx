import { useEffect, useRef } from 'react'
import { AppState, I18nManager, StyleSheet, View } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useFonts } from 'expo-font'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/api/queryClient'
import { OfflineBanner } from '@/components/OfflineBanner'
import { applyGlobalFont, fontAssets } from '@/theme/fonts'
import { useAuthStore } from '@/stores/auth'

// ── تفعيل RTL (يسري بالكامل بعد أول إعادة تشغيل للتطبيق) ─────────────────────
I18nManager.allowRTL(true)
if (!I18nManager.isRTL) {
  try {
    I18nManager.forceRTL(true)
  } catch {
    // بعض المنصات ترفض التغيير وقت التشغيل — يُطبق عند الإقلاع التالي
  }
}

const FEATURES_REFRESH_AFTER_MS = 5 * 60_000

export default function RootLayout() {
  const restore = useAuthStore(s => s.restore)
  const backgroundedAt = useRef<number | null>(null)
  const [fontsLoaded, fontError] = useFonts(fontAssets)

  useEffect(() => {
    restore()
  }, [restore])

  // تحديث خريطة الميزات عند العودة للمقدمة بعد غياب طويل (ترقية الخطة تظهر بدون إعادة تثبيت)
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'background') {
        backgroundedAt.current = Date.now()
      } else if (state === 'active' && backgroundedAt.current) {
        if (Date.now() - backgroundedAt.current > FEATURES_REFRESH_AFTER_MS) {
          useAuthStore.getState().refreshFeatures()
        }
        backgroundedAt.current = null
      }
    })
    return () => sub.remove()
  }, [])

  // لا نعرض أي نص قبل تحميل الخطوط حتى لا يومض الخط الافتراضي؛ عند فشل التحميل
  // نكمل بالخط الافتراضي بدل تعطيل التطبيق.
  if (!fontsLoaded && !fontError) return null
  applyGlobalFont()

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <View style={styles.root}>
        <OfflineBanner />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="(admin)" />
          <Stack.Screen name="(cashier)" />
          <Stack.Screen name="(stock)" />
        </Stack>
      </View>
    </QueryClientProvider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
