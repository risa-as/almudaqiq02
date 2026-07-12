import React from 'react'
import { StyleSheet, Text, TextInput } from 'react-native'
import {
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
  Cairo_800ExtraBold,
} from '@expo-google-fonts/cairo'

/** خريطة الخطوط لتمريرها إلى useFonts في الجذر. */
export const fontAssets = {
  Cairo_400Regular,
  Cairo_500Medium,
  Cairo_600SemiBold,
  Cairo_700Bold,
  Cairo_800ExtraBold,
}

/** يحوّل fontWeight إلى متغيّر Cairo المطابق حتى تبقى هرمية الأوزان محفوظة. */
function familyForWeight(weight?: string | number): string {
  switch (String(weight ?? '400')) {
    case '100':
    case '200':
    case '300':
    case '400':
    case 'normal':
      return 'Cairo_400Regular'
    case '500':
      return 'Cairo_500Medium'
    case '600':
      return 'Cairo_600SemiBold'
    case '700':
    case 'bold':
      return 'Cairo_700Bold'
    case '800':
    case '900':
      return 'Cairo_800ExtraBold'
    default:
      return 'Cairo_400Regular'
  }
}

let patched = false

/**
 * يطبّق خط Cairo على كامل التطبيق دون لمس كل شاشة: يعترض render لكل من Text
 * و TextInput ويحقن fontFamily المناسب لوزن النص. يُستدعى مرة واحدة بعد تحميل الخطوط.
 */
export function applyGlobalFont(): void {
  if (patched) return
  patched = true

  type StyledElement = React.ReactElement<{ style?: unknown }>
  type Renderable = { render?: (...a: unknown[]) => StyledElement }

  for (const Comp of [Text, TextInput] as unknown as Renderable[]) {
    const orig = Comp.render
    if (typeof orig !== 'function') continue
    Comp.render = function patchedRender(this: unknown, ...args: unknown[]) {
      const el = orig.apply(this, args) as StyledElement
      const flat = StyleSheet.flatten(el.props?.style as never) as { fontWeight?: string | number } | undefined
      const fontFamily = familyForWeight(flat?.fontWeight)
      // العائلة أولًا (أدنى أولوية)، ثم أنماط العنصر، ثم إلغاء fontWeight لمنع
      // التثخين الصناعي على iOS مع الحفاظ على الوزن المخبوز داخل العائلة.
      return React.cloneElement(el, {
        style: [{ fontFamily }, el.props.style, { fontWeight: 'normal' as const }],
      })
    }
  }
}
