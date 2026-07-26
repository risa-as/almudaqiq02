import { useCallback, useRef, useState } from 'react'
import { Pressable, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { Ionicons } from '@expo/vector-icons'
import { ar } from '@/i18n/ar'
import { colors, fontSize, radius, spacing } from '@/theme'

interface BarcodeScannerViewProps {
  /** يُستدعى مرة واحدة لكل قراءة (مع منع التكرار خلال نافذة قصيرة) */
  onScanned: (code: string) => void
  /** إيقاف القراءة مؤقتًا (مثلاً أثناء معالجة منتج) */
  paused?: boolean
  /** ارتفاع نافذة الكاميرا (الافتراضي 220) */
  height?: number
  /** واجهة كاميرا كاملة مخصصة لنقطة البيع. */
  fullScreen?: boolean
  onClose?: () => void
  /** نص الإرشاد أسفل الإطار في الوضع الكامل — يختلف بين البيع والاستعلام */
  hint?: string
}

const DEDUPE_MS = 1500

/**
 * الماسح المشترك (بيع/جرد/استلام): كاميرا + فلاش + إدخال يدوي كبديل كامل
 * عند رفض الإذن أو تعطل الكاميرا (FR-011 / FR-012).
 */
export function BarcodeScannerView({
  onScanned,
  paused = false,
  height = 220,
  fullScreen = false,
  onClose,
  hint = 'وجّه الكاميرا نحو باركود المنتج لإضافته للسلة',
}: BarcodeScannerViewProps) {
  const [permission, requestPermission] = useCameraPermissions()
  const [torch, setTorch] = useState(false)
  const [manualMode, setManualMode] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const lastScan = useRef<{ code: string; at: number }>({ code: '', at: 0 })

  const handleScan = useCallback(
    ({ data }: { data: string }) => {
      if (paused || !data) return
      const now = Date.now()
      if (lastScan.current.code === data && now - lastScan.current.at < DEDUPE_MS) return
      lastScan.current = { code: data, at: now }
      onScanned(data)
    },
    [onScanned, paused],
  )

  const submitManual = () => {
    const code = manualCode.trim()
    if (!code) return
    setManualCode('')
    onScanned(code)
  }

  if (fullScreen) {
    if (!permission?.granted) {
      return (
        <View style={styles.fullScreenFallback}>
          <StatusBar barStyle="light-content" />
          <Pressable style={styles.fullCloseButton} onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={30} color={colors.onPrimary} />
          </Pressable>
          <View style={styles.fallbackContent}>
            <View style={styles.fallbackIcon}><Ionicons name="camera-outline" size={34} color={colors.onPrimary} /></View>
            <Text style={styles.fallbackTitle}>{ar.scanner.permissionTitle}</Text>
            <Text style={styles.fallbackText}>{ar.scanner.permissionMessage}</Text>
            {permission?.canAskAgain !== false ? (
              <Pressable style={styles.fallbackButton} onPress={requestPermission}>
                <Text style={styles.fallbackButtonText}>{ar.scanner.grantPermission}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      )
    }

    return (
      <View style={styles.fullScreen}>
        <StatusBar barStyle="light-content" />
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'code128', 'qr'] }}
          onBarcodeScanned={paused ? undefined : handleScan}
        />
        <View style={styles.fullScreenShade} pointerEvents="none" />
        <View style={styles.fullTopBar}>
          <Pressable style={styles.fullRoundButton} onPress={() => setTorch(value => !value)}>
            <Ionicons name={torch ? 'flash' : 'flash-outline'} size={26} color={colors.onPrimary} />
          </Pressable>
          <Text style={styles.fullTitle}>مسح باركود المنتج</Text>
          <Pressable style={styles.fullRoundButton} onPress={onClose}>
            <Ionicons name="close" size={29} color={colors.onPrimary} />
          </Pressable>
        </View>
        <View style={styles.scanGuide} pointerEvents="none">
          <View style={styles.fullFrame} />
          <Text style={styles.fullHint}>{hint}</Text>
        </View>
      </View>
    )
  }

  const manualEntry = (
    <View style={styles.manualRow}>
      <TextInput
        style={styles.manualInput}
        value={manualCode}
        onChangeText={setManualCode}
        placeholder={ar.scanner.manualPlaceholder}
        placeholderTextColor={colors.textMuted}
        keyboardType="number-pad"
        onSubmitEditing={submitManual}
        returnKeyType="search"
      />
      <Pressable style={styles.manualButton} onPress={submitManual}>
        <Text style={styles.manualButtonText}>{ar.scanner.manualSubmit}</Text>
      </Pressable>
    </View>
  )

  // إذن غير ممنوح → شرح + زر طلب إذن + الإدخال اليدوي كبديل كامل
  if (!permission?.granted) {
    return (
      <View style={[styles.container, { minHeight: height }]}>
        <View style={styles.permissionBox}>
          <Ionicons name="camera-outline" size={36} color={colors.textMuted} />
          <Text style={styles.permissionTitle}>{ar.scanner.permissionTitle}</Text>
          <Text style={styles.permissionText}>{ar.scanner.permissionMessage}</Text>
          {permission?.canAskAgain !== false ? (
            <Pressable style={styles.grantButton} onPress={requestPermission}>
              <Text style={styles.grantButtonText}>{ar.scanner.grantPermission}</Text>
            </Pressable>
          ) : null}
        </View>
        {manualEntry}
      </View>
    )
  }

  return (
    <View style={[styles.container, { minHeight: height }]}>
      {manualMode ? (
        <View style={[styles.manualOnly, { height: height - 60 }]}>
          <Ionicons name="keypad-outline" size={32} color={colors.textMuted} />
          <Text style={styles.permissionText}>{ar.scanner.manualEntry}</Text>
        </View>
      ) : (
        <View style={[styles.cameraWrap, { height: height - 60 }]}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torch}
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'code128', 'qr'] }}
            onBarcodeScanned={paused ? undefined : handleScan}
          />
          <View style={styles.overlay} pointerEvents="none">
            <View style={styles.frame} />
            <Text style={styles.hint}>{ar.scanner.aimHint}</Text>
          </View>
          <View style={styles.controls}>
            <Pressable style={styles.controlButton} onPress={() => setTorch(t => !t)}>
              <Ionicons name={torch ? 'flash' : 'flash-outline'} size={20} color={colors.onPrimary} />
            </Pressable>
            <Pressable style={styles.controlButton} onPress={() => setManualMode(true)}>
              <Ionicons name="keypad-outline" size={20} color={colors.onPrimary} />
            </Pressable>
          </View>
        </View>
      )}
      {manualMode ? (
        <Pressable style={styles.backToCamera} onPress={() => setManualMode(false)}>
          <Ionicons name="camera-outline" size={16} color={colors.primary} />
          <Text style={styles.backToCameraText}>{ar.scanner.aimHint}</Text>
        </Pressable>
      ) : null}
      {manualEntry}
    </View>
  )
}

const styles = StyleSheet.create({
  fullScreen: { flex: 1, backgroundColor: '#0F172A' },
  fullScreenShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(15,23,42,0.16)' },
  fullTopBar: { position: 'absolute', top: 54, left: spacing.lg, right: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fullRoundButton: { width: 60, height: 60, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,23,42,0.64)' },
  fullTitle: { color: colors.onPrimary, fontSize: fontSize.xl, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 8 },
  scanGuide: { position: 'absolute', top: '37%', left: 0, right: 0, alignItems: 'center', gap: spacing.lg },
  fullFrame: { width: '66%', aspectRatio: 1.5, borderWidth: 4, borderColor: colors.onPrimary, borderRadius: radius.xl },
  fullHint: { color: colors.onPrimary, maxWidth: '84%', textAlign: 'center', fontSize: fontSize.md, fontWeight: '700', lineHeight: 25, textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 7 },
  fullScreenFallback: { flex: 1, backgroundColor: colors.text, padding: spacing.xl },
  fullCloseButton: { position: 'absolute', top: 54, right: spacing.lg, width: 60, height: 60, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  fallbackContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  fallbackIcon: { width: 76, height: 76, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.14)' },
  fallbackTitle: { color: colors.onPrimary, fontSize: fontSize.xl, fontWeight: '800' },
  fallbackText: { color: 'rgba(255,255,255,0.78)', textAlign: 'center', lineHeight: 22, fontSize: fontSize.sm },
  fallbackButton: { backgroundColor: colors.onPrimary, borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  fallbackButtonText: { color: colors.primary, fontWeight: '800', fontSize: fontSize.md },
  container: { gap: spacing.sm },
  cameraWrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  frame: {
    width: '70%',
    height: 90,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    borderRadius: radius.md,
  },
  hint: { color: 'rgba(255,255,255,0.9)', fontSize: fontSize.sm },
  controls: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  controlButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  permissionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  permissionText: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  grantButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
  },
  grantButtonText: { color: colors.onPrimary, fontWeight: '700', fontSize: fontSize.sm },
  manualOnly: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  manualRow: { flexDirection: 'row', gap: spacing.sm },
  manualInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    color: colors.text,
    textAlign: 'right',
  },
  manualButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualButtonText: { color: colors.onPrimary, fontWeight: '700', fontSize: fontSize.sm },
  backToCamera: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'center' },
  backToCameraText: { color: colors.primary, fontSize: fontSize.sm },
})
