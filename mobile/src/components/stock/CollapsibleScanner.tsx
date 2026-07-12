import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { BarcodeScannerView } from '@/components/BarcodeScannerView'
import { colors, fontSize, radius, shadow, spacing } from '@/theme'

interface CollapsibleScannerProps {
  onScanned: (code: string) => void
  paused?: boolean
  height?: number
  /** نص زر الفتح (الافتراضي: "مسح باركود") */
  openLabel?: string
  /** فتح الماسح ابتدائيًا */
  initiallyOpen?: boolean
}

/** ماسح الباركود المشترك مطويًا خلف زر — يوفّر مساحة الشاشة حتى يُطلب المسح. */
export function CollapsibleScanner({ onScanned, paused, height = 220, openLabel = 'مسح باركود', initiallyOpen = false }: CollapsibleScannerProps) {
  const [open, setOpen] = useState(initiallyOpen)

  if (!open) {
    return (
      <Pressable style={styles.openButton} onPress={() => setOpen(true)}>
        <Ionicons name="barcode-outline" size={20} color={colors.onPrimary} />
        <Text style={styles.openText}>{openLabel}</Text>
      </Pressable>
    )
  }

  return (
    <View style={styles.wrap}>
      <BarcodeScannerView onScanned={onScanned} paused={paused} height={height} />
      <Pressable style={styles.closeButton} onPress={() => setOpen(false)}>
        <Ionicons name="chevron-up" size={16} color={colors.textSecondary} />
        <Text style={styles.closeText}>إخفاء الماسح</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 48,
    ...shadow.button,
  },
  openText: { color: colors.onPrimary, fontWeight: '700', fontSize: fontSize.md },
  wrap: { gap: spacing.xs },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  closeText: { color: colors.textSecondary, fontSize: fontSize.sm },
})
