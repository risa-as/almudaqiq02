import { useEffect, useRef } from 'react'
import { AppState, I18nManager, StyleSheet, View } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useFonts } from 'expo-font'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/api/queryClient'
import { AlertHost } from '@/components/AppAlert'
import { OfflineBanner } from '@/components/OfflineBanner'
import { applyGlobalFont, fontAssets } from '@/theme/fonts'
import { useAuthStore } from '@/stores/auth'

// ── اتجاه التخطيط: LTR ثابت، والترتيب العربي يدويّ ───────────────────────────
// forceRTL(true) كان يرفع علم isRTL في جافاسكربت فورًا بينما يبقى رسم Yoga أفقيًا
// LTR حتى إعادة التشغيل (وقد لا يُطبَّق إطلاقًا في Expo Go). فيكذب العلم على الأنماط:
// يقول RTL والرسم LTR، فتنقلب الصفوف (المبلغ يمينًا والاسم يسارًا) بلا قاعدة ثابتة.
// لذا نثبّت التخطيط على LTR ونرتّب الواجهة عربيًا صراحةً عبر ثوابت utils/rtl
// (ROW / ALIGN_RIGHT) مع textAlign — نتيجة واحدة قبل إعادة التشغيل وبعدها.
I18nManager.allowRTL(false)
if (I18nManager.isRTL) {
  try {
    I18nManager.forceRTL(false)
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
        {/* مضيف التنبيهات الافتراضي — آخر عنصر ليرسم فوق الشاشات وشريط التبويب */}
        <AlertHost />
      </View>
    </QueryClientProvider>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
