'use client'
import { useState, useEffect } from 'react'
import { Bot, X, Trash2, Lightbulb } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { useBranch } from '@/contexts/BranchContext'
import { useChat } from '@/hooks/useChat'
import { QUESTION_CATEGORIES, getContextQuestions } from '@/lib/ai/quick-questions'

const WIDGET_TABS = QUESTION_CATEGORIES.filter(c => c.id !== 'general')
const WIDGET_GENERAL = QUESTION_CATEGORIES.find(c => c.id === 'general')!

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [showQuestions, setShowQuestions] = useState(false)
  const [activeWidgetTab, setActiveWidgetTab] = useState<string>(WIDGET_TABS[0].id)
  const pathname = usePathname()
  const { category: ctxCategory, questions: ctxQuestions } = getContextQuestions(pathname)
  const { selectedBranch } = useBranch()
  const { messages, input, setInput, isLoading, usage, sendMessage, retryLast, clearChat, messagesEndRef } = useChat({
    storageKey: 'ai_chat_history',
    branchId:   selectedBranch?.id,
  })

  const activeWidgetCat = [...WIDGET_TABS, WIDGET_GENERAL].find(c => c.id === activeWidgetTab) ?? WIDGET_TABS[0]

  function handleQuestionClick(text: string) {
    setShowQuestions(false)
    sendMessage(text)
  }

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [messages, isOpen, messagesEndRef])

  const usagePct     = usage ? Math.min(100, (usage.used / usage.limit) * 100) : 0
  const isNearLimit  = usage ? usage.remaining <= 5 && usage.remaining > 0 : false
  const isLimitReached = usage ? usage.remaining === 0 : false

  return (
    <>
      {/* ── Floating action button ─────────────────────────────────────────── */}
      {!isOpen && (
        <button
          id="tour-chat-fab"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 left-6 w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 z-[60]"
          style={{
            background:  'linear-gradient(135deg, #094B9F, #063A8A)',
            boxShadow:   '0 8px 24px rgba(9,75,159,0.4)',
          }}
          title="المساعد الذكي"
        >
          <Bot className="w-6 h-6 text-white" />
          {messages.length > 0 && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white" />
          )}
        </button>
      )}

      {/* ── Chat panel ────────────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed bottom-6 left-6 w-[calc(100vw-3rem)] sm:w-96 rounded-2xl overflow-hidden flex flex-col z-[60]"
          style={{
            height:    '540px',
            background: 'var(--bg-card)',
            border:    '1px solid var(--border-color)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(9,75,159,0.1)',
          }}
          dir="rtl"
        >
          {/* Header — always dark so white text is readable in both themes */}
          <div
            className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{
              background:   'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
              borderBottom: '1px solid rgba(9,75,159,0.35)',
            }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, #094B9F, #063A8A)', boxShadow: '0 2px 8px rgba(9,75,159,0.4)' }}
              >
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white leading-tight">المساعد الذكي</p>
                {usage && (
                  <p className={`text-[10px] font-medium leading-tight ${
                    isLimitReached ? 'text-red-400' : isNearLimit ? 'text-blue-400' : 'text-blue-300'
                  }`}>
                    {isLimitReached
                      ? 'تم استنفاد الحد اليومي'
                      : `${usage.remaining} استفسار متبقٍ من ${usage.limit}`
                    }
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setShowQuestions(v => !v)}
                className="p-1.5 rounded-lg transition-colors"
                style={showQuestions
                  ? { background: 'rgba(165,180,252,0.2)', color: '#93C5FD' }
                  : { color: 'rgba(255,255,255,0.6)' }
                }
                title="أسئلة سريعة"
              >
                <Lightbulb className="w-3.5 h-3.5" />
              </button>
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                  title="مسح المحادثة"
                >
                  <Trash2 className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.55)' }} />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                title="إغلاق"
              >
                <X className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.55)' }} />
              </button>
            </div>
          </div>

          {/* Usage progress bar */}
          {usage && usage.limit > 0 && (
            <div className="shrink-0 px-4 pt-2 pb-1" style={{ borderBottom: '1px solid rgba(9,75,159,0.1)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-500 font-medium">الاستخدام اليومي</span>
                <span className={`text-[10px] font-bold ${
                  isLimitReached ? 'text-red-400' : isNearLimit ? 'text-blue-400' : 'text-blue-400'
                }`}>
                  {usage.used} / {usage.limit}
                </span>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(9,75,159,0.1)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${usagePct}%`,
                    background: isLimitReached
                      ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                      : isNearLimit
                        ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                        : 'linear-gradient(90deg, #094B9F, #063A8A)',
                  }}
                />
              </div>
            </div>
          )}

          {/* Messages area + questions overlay wrapper */}
          <div className="flex-1 overflow-hidden relative">
            {/* Questions overlay */}
            {showQuestions && (
              <div
                className="absolute inset-0 flex flex-col z-10"
                style={{ background: 'var(--bg-card)' }}
              >
                {/* Category tabs */}
                <div
                  className="shrink-0 px-3 pt-3 pb-2"
                  style={{ borderBottom: '1px solid var(--border-color)' }}
                >
                  <div className="flex items-center gap-1 mb-2">
                    <Lightbulb className="w-3.5 h-3.5" style={{ color: '#094B9F' }} />
                    <span className="text-[11px] font-black" style={{ color: '#094B9F' }}>أسئلة سريعة</span>
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                    {WIDGET_TABS.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setActiveWidgetTab(cat.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all shrink-0"
                        style={activeWidgetTab === cat.id
                          ? { background: `linear-gradient(135deg, ${cat.bgFrom}, ${cat.bgTo})`, border: `1px solid ${cat.accent}40`, color: cat.accent }
                          : { background: 'var(--bg-page)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }
                        }
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                      </button>
                    ))}
                    <button
                      key={WIDGET_GENERAL.id}
                      onClick={() => setActiveWidgetTab(WIDGET_GENERAL.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all shrink-0"
                      style={activeWidgetTab === WIDGET_GENERAL.id
                        ? { background: `linear-gradient(135deg, ${WIDGET_GENERAL.bgFrom}, ${WIDGET_GENERAL.bgTo})`, border: `1px solid ${WIDGET_GENERAL.accent}40`, color: WIDGET_GENERAL.accent }
                        : { background: 'var(--bg-page)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }
                      }
                    >
                      <span>{WIDGET_GENERAL.icon}</span>
                      <span>{WIDGET_GENERAL.label}</span>
                    </button>
                  </div>
                </div>

                {/* Questions list */}
                <div className="flex-1 overflow-y-auto px-3 py-2" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--border-color) transparent' }}>
                  <div className="flex flex-col gap-1.5">
                    {activeWidgetCat.questions.map(q => (
                      <button
                        key={q.text}
                        onClick={() => handleQuestionClick(q.text)}
                        disabled={isLimitReached}
                        className="flex items-center gap-2 text-xs px-3 py-2.5 rounded-xl text-right transition-all hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{
                          background: `linear-gradient(135deg, ${activeWidgetCat.bgFrom}, ${activeWidgetCat.bgTo})`,
                          border: `1px solid ${activeWidgetCat.accent}25`,
                        }}
                      >
                        <span className="shrink-0 text-sm">{q.emoji}</span>
                        <span className="font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>{q.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Normal messages area */}
            <div
              className="h-full overflow-y-auto p-3"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}
            >
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
                    style={{ background: 'rgba(9,75,159,0.1)', border: '1px solid rgba(9,75,159,0.2)' }}
                  >
                    <Bot className="w-7 h-7 text-blue-400" />
                  </div>
                  <p className="text-sm font-bold text-slate-200 mb-1">مرحباً!</p>
                  <p className="text-xs text-slate-500 leading-relaxed mb-3">
                    اسألني عن مبيعاتك، مخزونك، أرباحك،<br />وكل ما يخص متجرك
                  </p>
                  {/* Context label */}
                  <div className="flex items-center gap-1.5 mb-2 self-start">
                    <span className="text-sm">{ctxCategory.icon}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest"
                      style={{ color: ctxCategory.accent }}>
                      أسئلة {ctxCategory.label}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5 w-full">
                    {ctxQuestions.map(q => (
                      <button
                        key={q.text}
                        onClick={() => sendMessage(q.text)}
                        disabled={isLimitReached}
                        className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl text-right transition-all hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{
                          background: ctxCategory.bgFrom,
                          border: `1px solid ${ctxCategory.accent}25`,
                          color: '#c4b5fd',
                        }}
                      >
                        <span className="shrink-0">{q.emoji}</span>
                        <span>{q.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map(msg => (
                <ChatMessage key={msg.id} {...msg} onRetry={msg.isError ? retryLast : undefined} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <ChatInput
            value={input}
            onChange={setInput}
            onSend={() => sendMessage()}
            isLoading={isLoading}
            disabled={isLimitReached}
          />
        </div>
      )}
    </>
  )
}
