'use client'
import { usePageTitle } from '@/hooks/usePageTitle';
import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot, Trash2, Zap, Lightbulb, History, X } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import { ChatMessage } from '@/components/ai-assistant/ChatMessage'
import { ChatInput } from '@/components/ai-assistant/ChatInput'
import { useBranch } from '@/contexts/BranchContext'
import { useChat, type ConversationSummary } from '@/hooks/useChat'
import { QUESTION_CATEGORIES, type QuestionCategory } from '@/lib/ai/quick-questions'

// All categories except 'general' shown as tabs; general merged into first tab display
const TABS = QUESTION_CATEGORIES.filter(c => c.id !== 'general')
const GENERAL = QUESTION_CATEGORIES.find(c => c.id === 'general')!

function CategoryTab({
  cat,
  active,
  onClick,
}: {
  cat: QuestionCategory
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-150 shrink-0"
      style={
        active
          ? {
              background: `linear-gradient(135deg, ${cat.bgFrom}, ${cat.bgTo})`,
              border: `1px solid ${cat.accent}40`,
              color: cat.accent,
              boxShadow: `0 2px 10px ${cat.accent}20`,
            }
          : {
              background: 'var(--bg-page)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
            }
      }
    >
      <span>{cat.icon}</span>
      <span>{cat.label}</span>
      <span
        className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
        style={{
          background: active ? `${cat.accent}20` : 'var(--color-secondary-light)',
          color: active ? cat.accent : 'var(--text-secondary)',
        }}
      >
        {cat.questions.length}
      </span>
    </button>
  )
}

function QuestionGrid({
  cat,
  onSend,
  disabled,
}: {
  cat: QuestionCategory
  onSend: (q: string) => void
  disabled: boolean
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
          style={{ background: cat.bgFrom, border: `1px solid ${cat.accent}30` }}
        >
          {cat.icon}
        </div>
        <div>
          <p className="text-sm font-black" style={{ color: cat.accent }}>
            {cat.label}
          </p>
          <p className="text-[11px] text-slate-600">{cat.questions.length} سؤال متاح</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {cat.questions.map(q => (
          <button
            key={q.text}
            onClick={() => onSend(q.text)}
            disabled={disabled}
            className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl text-right transition-all hover:scale-[1.01] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{
              background: `linear-gradient(135deg, ${cat.bgFrom}, ${cat.bgTo})`,
              border: `1px solid ${cat.accent}20`,
            }}
          >
            <span className="text-base shrink-0 mt-0.5">{q.emoji}</span>
            <span className="text-[12px] font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
              {q.text}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function AssistantPage() {
  usePageTitle('المساعد الذكي');
  const { selectedBranch } = useBranch()
  const {
    messages, input, setInput, isLoading, usage,
    sendMessage, retryLast, clearChat, messagesEndRef,
    conversationId, listConversations, loadConversation, deleteConversation,
  } = useChat({ storageKey: 'ai_chat_history_page', branchId: selectedBranch?.id })

  const [activeTab, setActiveTab] = useState<string>(TABS[0].id)
  const [showQuestions, setShowQuestions] = useState(false)
  const [questionsTab, setQuestionsTab] = useState<string>(TABS[0].id)
  const [showHistory, setShowHistory] = useState(false)

  const queryClient = useQueryClient()
  const conversationsQuery = useQuery<ConversationSummary[]>({
    queryKey: ['ai-conversations'],
    queryFn: () => listConversations(),
    enabled: showHistory,
  })
  const conversations = conversationsQuery.data ?? []

  function toggleHistory() {
    setShowHistory(v => !v)
  }

  async function handleResume(id: string) {
    const ok = await loadConversation(id)
    if (ok) setShowHistory(false)
  }

  async function handleDeleteConversation(id: string) {
    await deleteConversation(id)
    queryClient.invalidateQueries({ queryKey: ['ai-conversations'] })
  }

  const questionsActiveCat = [...TABS, GENERAL].find(c => c.id === questionsTab) ?? TABS[0]

  function handleQuestionClick(text: string) {
    setShowQuestions(false)
    sendMessage(text)
  }

  useEffect(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [messages, messagesEndRef])

  const usagePct       = usage ? Math.min(100, (usage.used / usage.limit) * 100) : 0
  const isNearLimit    = usage ? usage.remaining <= 5 && usage.remaining > 0 : false
  const isLimitReached = usage ? usage.remaining === 0 : false

  const activeCat = TABS.find(c => c.id === activeTab) ?? TABS[0]

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] max-w-4xl mx-auto" dir="rtl">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <PageHeader
        title="المساعد الذكي"
        subtitle={`${QUESTION_CATEGORIES.reduce((s, c) => s + c.questions.length, 0)} سؤال جاهز عبر ${TABS.length} فئة`}
        icon={Bot}
        gradient="linear-gradient(135deg, #094B9F, #063A8A)"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQuestions(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
              style={showQuestions
                ? { background: 'rgba(9,75,159,0.15)', color: '#094B9F', border: '1px solid rgba(9,75,159,0.3)' }
                : { background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }
              }
            >
              <Lightbulb className="w-3.5 h-3.5" />
              أسئلة سريعة
            </button>
            <button
              onClick={toggleHistory}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
              style={showHistory
                ? { background: 'rgba(9,75,159,0.15)', color: '#094B9F', border: '1px solid rgba(9,75,159,0.3)' }
                : { background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0' }
              }
            >
              <History className="w-3.5 h-3.5" />
              سجل المحادثات
            </button>
            {messages.length > 0 && (
              <button onClick={clearChat}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
                style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca' }}>
                <Trash2 className="w-3.5 h-3.5" />
                مسح المحادثة
              </button>
            )}
          </div>
        }
      />

      {/* ── Conversation history panel ─────────────────────────────── */}
      {showHistory && (
        <div className="shrink-0 mb-3 rounded-2xl px-4 py-3"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
              <History className="w-3.5 h-3.5" />
              محادثاتك السابقة
            </span>
            <button onClick={() => setShowHistory(false)} className="p-1 rounded-lg hover:opacity-70">
              <X className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>
          {conversations.length === 0 ? (
            <p className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>لا توجد محادثات محفوظة بعد</p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1" style={{ scrollbarWidth: 'thin' }}>
              {conversations.map(c => (
                <div key={c.id}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 transition-all"
                  style={{
                    background: c.id === conversationId ? 'rgba(9,75,159,0.08)' : 'transparent',
                    border: `1px solid ${c.id === conversationId ? 'rgba(9,75,159,0.2)' : 'transparent'}`,
                  }}>
                  <button onClick={() => handleResume(c.id)} className="flex-1 text-right hover:opacity-80">
                    <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{c.title}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {c.messagesCount} رسالة · {new Date(c.updatedAt).toLocaleDateString('ar')}
                    </p>
                  </button>
                  <button onClick={() => handleDeleteConversation(c.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="حذف">
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Usage bar ──────────────────────────────────────────────── */}
      {usage && usage.limit > 0 && (
        <div className="shrink-0 mb-3 rounded-2xl px-4 py-3"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Zap className={`w-3.5 h-3.5 ${isLimitReached ? 'text-red-400' : isNearLimit ? 'text-blue-400' : 'text-blue-400'}`} />
              <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>الاستخدام اليومي للمساعد الذكي</span>
            </div>
            <span className={`text-xs font-black ${isLimitReached ? 'text-red-400' : isNearLimit ? 'text-blue-400' : 'text-blue-400'}`}>
              {usage.used} / {usage.limit} استفسار
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(9,75,159,0.1)' }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${usagePct}%`,
                background: isLimitReached
                  ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                  : isNearLimit
                    ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                    : 'linear-gradient(90deg, #094B9F, #063A8A)',
              }} />
          </div>
          {isLimitReached && (
            <p className="text-xs text-red-400 font-medium mt-1.5">تم استنفاد الحد اليومي. يتجدد تلقائياً في منتصف الليل.</p>
          )}
          {isNearLimit && (
            <p className="text-xs text-blue-400 font-medium mt-1.5">تبقّى {usage.remaining} استفسار فقط اليوم.</p>
          )}
        </div>
      )}

      {/* ── Messages / Empty State ─────────────────────────────────── */}
      <div className="flex-1 overflow-hidden rounded-2xl mb-3 relative"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>

        {/* Questions overlay */}
        {showQuestions && (
          <div className="absolute inset-0 flex flex-col z-10 rounded-2xl" style={{ background: 'var(--bg-card)' }}>
            {/* Header */}
            <div className="shrink-0 px-5 pt-4 pb-3" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(9,75,159,0.12)', border: '1px solid rgba(9,75,159,0.25)' }}>
                  <Lightbulb className="w-4 h-4" style={{ color: '#094B9F' }} />
                </div>
                <div>
                  <p className="text-sm font-black" style={{ color: '#094B9F' }}>أسئلة سريعة</p>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>اختر فئة وانقر على أي سؤال لإرساله</p>
                </div>
              </div>
              {/* Category tabs */}
              <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {TABS.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setQuestionsTab(cat.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0"
                    style={questionsTab === cat.id
                      ? { background: `linear-gradient(135deg, ${cat.bgFrom}, ${cat.bgTo})`, border: `1px solid ${cat.accent}40`, color: cat.accent, boxShadow: `0 2px 8px ${cat.accent}15` }
                      : { background: 'var(--bg-page)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }
                    }
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                    <span className="text-[10px] opacity-60">({cat.questions.length})</span>
                  </button>
                ))}
                <button
                  onClick={() => setQuestionsTab(GENERAL.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0"
                  style={questionsTab === GENERAL.id
                    ? { background: `linear-gradient(135deg, ${GENERAL.bgFrom}, ${GENERAL.bgTo})`, border: `1px solid ${GENERAL.accent}40`, color: GENERAL.accent }
                    : { background: 'var(--bg-page)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }
                  }
                >
                  <span>{GENERAL.icon}</span>
                  <span>{GENERAL.label}</span>
                  <span className="text-[10px] opacity-60">({GENERAL.questions.length})</span>
                </button>
              </div>
            </div>

            {/* Questions grid */}
            <div className="flex-1 overflow-y-auto px-5 py-4" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--border-color) transparent' }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {questionsActiveCat.questions.map(q => (
                  <button
                    key={q.text}
                    onClick={() => handleQuestionClick(q.text)}
                    disabled={isLimitReached}
                    className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl text-right transition-all hover:scale-[1.01] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                    style={{
                      background: `linear-gradient(135deg, ${questionsActiveCat.bgFrom}, ${questionsActiveCat.bgTo})`,
                      border: `1px solid ${questionsActiveCat.accent}25`,
                    }}
                  >
                    <span className="text-base shrink-0 mt-0.5">{q.emoji}</span>
                    <span className="text-[12px] font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>{q.text}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="h-full overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
        {messages.length === 0 ? (
          <div className="flex flex-col h-full">

            {/* Welcome banner */}
            <div className="shrink-0 px-6 pt-6 pb-4 text-center"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="w-14 h-14 rounded-3xl flex items-center justify-center mx-auto mb-3"
                style={{ background: 'rgba(9,75,159,0.1)', border: '1px solid rgba(9,75,159,0.2)' }}>
                <Bot className="w-7 h-7 text-blue-400" />
              </div>
              <p className="text-base font-black text-slate-200 mb-1">مرحباً بك في المساعد الذكي</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                اختر سؤالاً من الفئات أدناه، أو اكتب سؤالك الخاص في المربع بالأسفل
              </p>
            </div>

            {/* Category tabs */}
            <div className="shrink-0 px-4 pt-4 pb-3">
              <div className="flex gap-2 overflow-x-auto pb-1"
                style={{ scrollbarWidth: 'none' }}>
                {TABS.map(cat => (
                  <CategoryTab
                    key={cat.id}
                    cat={cat}
                    active={activeTab === cat.id}
                    onClick={() => setActiveTab(cat.id)}
                  />
                ))}
                {/* General tab */}
                <CategoryTab
                  cat={GENERAL}
                  active={activeTab === GENERAL.id}
                  onClick={() => setActiveTab(GENERAL.id)}
                />
              </div>
            </div>

            {/* Questions grid for active tab */}
            <div className="flex-1 overflow-y-auto px-4 pb-4"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.05) transparent' }}>
              <QuestionGrid
                cat={activeTab === GENERAL.id ? GENERAL : activeCat}
                onSend={sendMessage}
                disabled={isLimitReached}
              />

              {/* Stats footer */}
              <div className="mt-6 pt-4 flex flex-wrap gap-3 justify-center"
                style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                {TABS.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveTab(cat.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80"
                    style={{
                      background: cat.bgFrom,
                      border: `1px solid ${cat.accent}20`,
                      color: cat.accent,
                    }}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                    <span className="opacity-60">({cat.questions.length})</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4">
            {messages.map(msg => (
              <ChatMessage key={msg.id} {...msg} onRetry={msg.isError ? retryLast : undefined} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
        </div>
      </div>

      {/* ── Input ──────────────────────────────────────────────────── */}
      <div className="shrink-0 rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={() => sendMessage()}
          isLoading={isLoading}
          disabled={isLimitReached}
        />
      </div>
    </div>
  )
}
