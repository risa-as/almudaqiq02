import { Pressable, type PressableProps } from 'react-native'

/**
 * زر تبويب مخصّص لشريط التنقل السفلي.
 *
 * يستبدل زر React Navigation الافتراضي (الذي يُظهر دائرة تموّج borderless قبيحة
 * فوق الأيقونة على أندرويد) بضغطة نظيفة: تلاشٍ خفيف فقط، بلا أي ripple.
 * يُمرَّر عبر `screenOptions.tabBarButton`؛ نوعه `PressableProps` لأن حمولة الزر
 * الفعلية (BottomTabBarButtonProps) قابلة للإسناد إليه — فلا حاجة لاستيراد هش من
 * أعماق حزمة expo-router.
 *
 * مهم: الملاحة تُمرِّر `android_ripple: { borderless: true }` ضمن خصائص الزر
 * (BottomTabItem.js في expo-router)، فلا يكفي «عدم ضبطه» — لو نشرنا `...rest`
 * وحده لعادت الدائرة. لذلك نضبطه null صراحةً **بعد** النشر فيَغلِب عليه.
 */
export function TabBarButton({ style, ...rest }: PressableProps) {
  return (
    <Pressable
      {...rest}
      android_ripple={null}
      style={state => [
        typeof style === 'function' ? style(state) : style,
        { opacity: state.pressed ? 0.6 : 1 },
      ]}
    />
  )
}
