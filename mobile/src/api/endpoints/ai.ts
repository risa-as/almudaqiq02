import { api, ApiError } from '../client'

/**
 * POST /api/ai/chat — عقد الطلب مطابق لخطاف الويب useChat لكن بوضع غير متدفق:
 * نرسل stream:false (وضع المسار الافتراضي) فيعيد الخادم JSON واحدًا كاملًا
 * { reply, toolsInvoked, charts, proposals, conversationId, used, limit, remaining }
 * — fetch في React Native لا يدعم قراءة NDJSON تدفقيًا بشكل موثوق.
 *
 * التاريخ history يُرسل من العميل (آخر 20 رسالة) لمحادثة جديدة؛ وعند تمرير
 * conversationId يتجاهله الخادم ويقرأ التاريخ الموثوق من قاعدة البيانات.
 */
export interface ChatHistoryItem {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatResponse {
  reply: string
  toolsInvoked?: string[]
  conversationId?: string | null
  used?: number
  limit?: number
  remaining?: number
}

/**
 * أخطاء المسار (429/503) تحمل حقل error برمز إنجليزي + حقل reply عربي، لكن عميل
 * api() يلتقط حقل error فقط — لذلك نترجم الرموز المعروفة لرسائل عربية مكافئة
 * لما يعرضه الويب (FR-018).
 */
const ERROR_REPLIES: Record<string, string> = {
  rate_limited: 'أرسلت عدة استفسارات متتالية بسرعة. انتظر دقيقة ثم حاول مجددًا.',
  daily_limit_reached: 'وصلت إلى الحد اليومي للمساعد الذكي. يتجدد الحد تلقائيًا في منتصف الليل.',
  quota_exceeded: 'خدمة الذكاء الاصطناعي وصلت إلى حدها اليومي من جانب المزوّد. يرجى المحاولة لاحقًا.',
  service_overloaded: 'خدمة الذكاء الاصطناعي مشغولة حاليًا بسبب الضغط العالي. جرّب مرة أخرى بعد لحظات.',
  ai_unavailable: 'عذرًا، المساعد الذكي غير متاح حاليًا. يرجى المحاولة مرة أخرى.',
}

export async function sendChatMessage(params: {
  message: string
  history: ChatHistoryItem[]
  /** يُمرَّر كما هو ('all' مقبولة لدى هذا المسار)؛ الخادم يقفل مدير الفرع على فرعه. */
  branchId: string | null
  conversationId: string | null
}): Promise<ChatResponse> {
  try {
    return await api<ChatResponse>('/api/ai/chat', {
      method: 'POST',
      body: {
        message: params.message,
        history: params.history.slice(-20),
        branchId: params.branchId,
        conversationId: params.conversationId,
        stream: false,
      },
    })
  } catch (err) {
    if (err instanceof ApiError && ERROR_REPLIES[err.message]) {
      throw new ApiError(err.status, ERROR_REPLIES[err.message])
    }
    throw err
  }
}

// ── GET /api/ai/conversations — سجل محادثات المستخدم ─────────────────────────
export interface ConversationSummary {
  id: string
  title: string
  updatedAt: string
  messagesCount: number
}

export async function fetchConversations(): Promise<ConversationSummary[]> {
  const data = await api<{ conversations: ConversationSummary[] }>('/api/ai/conversations')
  return data.conversations ?? []
}
