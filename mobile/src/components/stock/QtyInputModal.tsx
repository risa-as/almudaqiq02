import { useEffect, useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { ar } from '@/i18n/ar'
import { colors, fontSize, radius, spacing } from '@/theme'

interface QtyInputModalProps {
  visible: boolean
  /** اسم المنتج غالبًا */
  title: string
  /** سطر معلومات إضافي (مثلاً: "المسجّل: 12") */
  subtitle?: string
  initialValue?: string
  confirmLabel?: string
  onConfirm: (qty: number) => void
  onClose: () => void
}

/**
 * نافذة إدخال كمية بعد مسح/اختيار منتج — تُستخدم في الجرد وإنشاء التحويلات.
 * تقبل أعدادًا صحيحة ≥ 0 فقط (الكميات بالوحدة الأساسية).
 */
export function QtyInputModal({ visible, title, subtitle, initialValue, confirmLabel, onConfirm, onClose }: QtyInputModalProps) {
  const [value, setValue] = useState('')

  useEffect(() => {
    if (visible) setValue(initialValue ?? '')
  }, [visible, initialValue])

  const parsed = Number(value)
  const valid = value.trim() !== '' && Number.isFinite(parsed) && parsed >= 0

  const confirm = () => {
    if (!valid) return
    onConfirm(Math.round(parsed))
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            autoFocus
            selectTextOnFocus
            onSubmitEditing={confirm}
            returnKeyType="done"
          />
          <View style={styles.actions}>
            <Pressable style={[styles.button, styles.cancelButton]} onPress={onClose}>
              <Text style={styles.cancelText}>{ar.common.cancel}</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.confirmButton, !valid && styles.disabled]}
              onPress={confirm}
              disabled={!valid}
            >
              <Text style={styles.confirmText}>{confirmLabel ?? ar.common.confirm}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, textAlign: 'right' },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'right' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    backgroundColor: colors.background,
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
  button: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  cancelButton: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  confirmButton: { backgroundColor: colors.primary },
  disabled: { opacity: 0.5 },
  cancelText: { color: colors.textSecondary, fontWeight: '600', fontSize: fontSize.md },
  confirmText: { color: colors.onPrimary, fontWeight: '700', fontSize: fontSize.md },
})
