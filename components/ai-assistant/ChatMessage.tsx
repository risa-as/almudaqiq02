'use client'
import { useState } from 'react'
import { Bot, User, RotateCcw, Database, Sparkles, Check, Loader2 } from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
} from 'recharts'
import type { MessageChart } from '@/lib/ai/charts'
import type { ActionProposal } from '@/lib/ai/proposals'

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  toolsInvoked?: string[]
  charts?: MessageChart[]
  proposals?: ActionProposal[]
  isLoading?: boolean
  isStreaming?: boolean
  isError?: boolean
  onRetry?: () => void
}

/** Confirm-gated action card: nothing executes until the user presses the button. */
function ProposalCard({ proposal }: { proposal: ActionProposal }) {
  const [state, setState] = useState<'idle' | 'working' | 'done' | 'failed'>('idle')

  async function confirm() {
    if (state === 'working' || state === 'done') return
    setState('working')
    try {
      const res = await fetch(proposal.endpoint, {
        method:  proposal.method,
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(proposal.payload),
      })
      setState(res.ok ? 'done' : 'failed')
    } catch {
      setState('failed')
    }
  }

  return (
    <div className="mt-2.5 rounded-xl p-3"
      style={{ background: 'rgba(9,75,159,0.06)', border: '1px solid rgba(9,75,159,0.2)' }}>
      <p className="text-[11px] font-bold flex items-center gap-1.5 mb-1" style={{ color: '#094B9F' }}>
        <Sparkles className="w-3.5 h-3.5" />
        {proposal.title}
      </p>
      <p className="text-xs mb-2.5" style={{ color: 'var(--text-primary)' }}>{proposal.summary}</p>
      {state === 'done' ? (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600">
          <Check className="w-3.5 h-3.5" /> تم التنفيذ بنجاح
        </span>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={confirm}
            disabled={state === 'working'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #094B9F, #063A8A)' }}
          >
            {state === 'working'
              ? <><Loader2 className="w-3 h-3 animate-spin" /> جارٍ التنفيذ...</>
              : <><Check className="w-3 h-3" /> تأكيد وتنفيذ</>}
          </button>
          {state === 'failed' && (
            <span className="text-[11px] font-bold text-red-500">فشل التنفيذ — حاول مجدداً</span>
          )}
        </div>
      )}
    </div>
  )
}

const PIE_COLORS = ['#6366f1', '#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#14b8a6', '#a855f7']

function MessageChartView({ chart }: { chart: MessageChart }) {
  const axisStyle = { fontSize: 10, fill: 'var(--text-secondary, #94a3b8)' }
  return (
    <div className="mt-2.5 pt-2.5" style={{ borderTop: '1px dashed var(--border-color)' }}>
      <p className="text-[11px] font-bold mb-1.5" style={{ color: 'var(--text-secondary, #94a3b8)' }}>
        📊 {chart.title}
      </p>
      <div style={{ width: '100%', height: 150 }} dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          {chart.kind === 'area' ? (
            <AreaChart data={chart.data} margin={{ top: 4, left: 0, right: 4, bottom: 0 }}>
              <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={44} />
              <Tooltip formatter={(v: any) => Number(v).toLocaleString()} labelStyle={{ fontSize: 11 }} contentStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="value" stroke="#6366f1" fill="rgba(99,102,241,0.18)" strokeWidth={2} />
            </AreaChart>
          ) : chart.kind === 'bar' ? (
            <BarChart data={chart.data} margin={{ top: 4, left: 0, right: 4, bottom: 0 }}>
              <XAxis dataKey="label" tick={axisStyle} tickLine={false} axisLine={false} interval={0}
                angle={chart.data.length > 5 ? -30 : 0} height={chart.data.length > 5 ? 44 : 24} textAnchor="end" />
              <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={44} />
              <Tooltip formatter={(v: any) => Number(v).toLocaleString()} labelStyle={{ fontSize: 11 }} contentStyle={{ fontSize: 11 }} />
              <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <PieChart>
              <Tooltip formatter={(v: any) => Number(v).toLocaleString()} contentStyle={{ fontSize: 11 }} />
              <Pie data={chart.data} dataKey="value" nameKey="label" innerRadius={32} outerRadius={58} paddingAngle={2}>
                {chart.data.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// Friendly Arabic labels for the data sources the assistant consulted — shown so the
// user knows the answer is grounded in real data, without exposing technical names.
const TOOL_LABELS: Record<string, string> = {
  get_sales_report:           'تقرير المبيعات',
  get_inventory_levels:       'مستويات المخزون',
  get_financial_summary:      'الملخص المالي',
  get_top_products:           'أعلى المنتجات مبيعاً',
  get_branch_stats:           'إحصائيات الفروع',
  get_recent_transactions:    'أحدث المعاملات',
  get_shift_summary:          'ملخص الورديات',
  get_discount_report:        'تقرير الخصومات',
  get_staff_performance:      'أداء الموظفين',
  get_customer_insights:      'تحليل العملاء',
  get_purchase_orders_summary:'ملخص المشتريات',
  get_menu_performance:       'أداء المنتجات',
  get_hourly_heatmap:         'أوقات الذروة',
  get_offers_effectiveness:   'فعالية العروض',
  get_orders_analysis:        'تحليل الطلبات',
  get_expense_breakdown:      'تفصيل المصاريف',
  get_product_margins:        'هوامش الأرباح',
  get_branch_profit_detail:   'أرباح الفروع',
  get_stock_movements:        'حركة المخزون',
  get_supplier_prices:        'أسعار الموردين',
  get_reorder_forecast:       'توقع إعادة الطلب',
}

const toolLabel = (tool: string) =>
  TOOL_LABELS[tool] ?? tool.replace('get_', '').replace(/_/g, ' ')

export function ChatMessage({ role, content, toolsInvoked, charts, proposals, isLoading, isStreaming, isError, onRetry }: ChatMessageProps) {
  if (role === 'user') {
    return (
      <div className="flex justify-start gap-2 my-1.5">
        <div className="flex items-start gap-2 max-w-[85%]">
          <div
            className="p-3 rounded-2xl rounded-tl-sm text-sm text-white leading-relaxed"
            style={{ background: 'linear-gradient(135deg, #094B9F, #063A8A)' }}
          >
            {content}
          </div>
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1"
            style={{ background: 'rgba(9,75,159,0.2)' }}
          >
            <User className="w-3.5 h-3.5 text-blue-400" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-end gap-2 my-1.5">
      <div className="flex items-start gap-2 max-w-[90%]">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1"
          style={{ background: 'rgba(14,99,212,0.2)' }}
        >
          <Bot className="w-3.5 h-3.5 text-violet-400" />
        </div>
        <div
          className="rounded-2xl rounded-tr-sm text-sm leading-relaxed"
          style={{
            background: 'var(--bg-card)',
            border: `1px solid ${isError ? 'rgba(239,68,68,0.25)' : 'var(--border-color)'}`,
            padding: '10px 14px',
          }}
        >
          {isLoading ? (
            <div className="flex gap-1.5 items-center py-1 px-1">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          ) : (
            <>
              <p
                className="whitespace-pre-wrap"
                style={{ color: isError ? '#f87171' : 'var(--text-primary)' }}
              >
                {content}
              </p>
              {isError && onRetry && (
                <button
                  onClick={onRetry}
                  className="flex items-center gap-1.5 mt-2 text-xs px-2.5 py-1 rounded-lg transition-all hover:opacity-80"
                  style={{
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    color: '#f87171',
                  }}
                >
                  <RotateCcw className="w-3 h-3" />
                  حاول مرة أخرى
                </button>
              )}
              {!isError && !isStreaming && charts && charts.length > 0 && (
                charts.map((chart, i) => <MessageChartView key={i} chart={chart} />)
              )}
              {!isError && !isStreaming && proposals && proposals.length > 0 && (
                proposals.map((proposal, i) => <ProposalCard key={i} proposal={proposal} />)
              )}
              {!isError && toolsInvoked && toolsInvoked.length > 0 && (
                <div
                  className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2.5"
                  style={{ borderTop: '1px dashed var(--border-color)' }}
                >
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400">
                    <Database className="w-3 h-3" />
                    المصادر:
                  </span>
                  {[...new Set(toolsInvoked)].map(tool => (
                    <span
                      key={tool}
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{
                        background: 'rgba(9,75,159,0.1)',
                        color: '#818cf8',
                        border: '1px solid rgba(9,75,159,0.18)',
                      }}
                    >
                      {toolLabel(tool)}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
