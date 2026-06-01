'use client'
import { Send } from 'lucide-react'
import { useRef, useEffect } from 'react'

interface ChatInputProps {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  isLoading: boolean
  disabled?: boolean
}

export function ChatInput({ value, onChange, onSend, isLoading, disabled }: ChatInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [value])

  return (
    <div
      className="flex items-end gap-2 p-3 shrink-0"
      style={{ borderTop: '1px solid var(--border-color)' }}
    >
      <textarea
        ref={ref}
        dir="rtl"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (!isLoading && value.trim()) onSend()
          }
        }}
        placeholder={disabled ? 'تم استنفاد الحد اليومي — يتجدد غداً' : 'اسألني عن مبيعاتك، مخزونك، أرباحك...'}
        disabled={isLoading || disabled}
        rows={1}
        className="flex-1 resize-none rounded-xl px-3 py-2 text-sm outline-none transition-all disabled:opacity-50 [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:hidden"
        style={{
          background: 'var(--bg-page)',
          border: '1px solid var(--border-color)',
          color: 'var(--text-primary)',
          maxHeight: '120px',
          lineHeight: '1.5',
          scrollbarWidth: 'none',
        }}
      />
      <button
        onClick={onSend}
        disabled={isLoading || disabled || !value.trim()}
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-150 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: 'linear-gradient(135deg, #094B9F, #063A8A)',
          boxShadow: '0 4px 12px rgba(9,75,159,0.3)',
        }}
        title="إرسال"
      >
        <Send className="w-4 h-4 text-white" />
      </button>
    </div>
  )
}
