import { hasFeature, type FeatureKey } from '@/features'
import { useAuthStore } from '@/stores/auth'

/** هل الميزة مفعّلة في خطة المستأجر الحالية؟ (بوابة عرض فقط — الخادم يظل الحَكم) */
export function useFeature(key: FeatureKey): boolean {
  return useAuthStore(s => hasFeature(s.features, key))
}
