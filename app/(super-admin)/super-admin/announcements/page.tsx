'use client'

import { useState, useEffect } from 'react'
import { Megaphone, Plus, Send, Loader2, Users, Info, AlertTriangle, Wrench } from 'lucide-react'

import toast from 'react-hot-toast';
interface Announcement {
  id: string
  title: string
  body: string
  type: 'INFO' | 'WARNING' | 'MAINTENANCE'
  createdAt: string
  expiresAt: string | null
  _count: { recipients: number }
}

const TYPE_CONFIG = {
  INFO:        { label: 'معلومات',  icon: Info,          color: 'bg-blue-50 text-blue-600 border-blue-200' },
  WARNING:     { label: 'تحذير',    icon: AlertTriangle,  color: 'bg-amber-50 text-amber-600 border-amber-200' },
  MAINTENANCE: { label: 'صيانة',    icon: Wrench,         color: 'bg-red-50 text-red-600 border-red-200' },
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading]             = useState(true)
  const [sending, setSending]             = useState(false)

  const [title,     setTitle]     = useState('')
  const [body,      setBody]      = useState('')
  const [type,      setType]      = useState<'INFO' | 'WARNING' | 'MAINTENANCE'>('INFO')
  const [expiresAt, setExpiresAt] = useState('')

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/super-admin/announcements')
      if (res.ok) setAnnouncements(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/super-admin/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, body, type,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        }),
      })
      if (res.ok) {
        setTitle(''); setBody(''); setExpiresAt('')
        load()
      } else {
        const d = await res.json()
        toast.error(d.error || 'فشل الإرسال');
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
            <div className="absolute inset-0 rounded-2xl opacity-40" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 60%)' }} />
            <Megaphone className="w-6 h-6 text-white relative" />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>الإعلانات</h1>
          <p className="text-sm text-slate-500 mt-1">أرسل إشعارات لجميع المنظمات أو مجموعة محددة</p>
        </div>
      </div>

      {/* Compose */}
      <div className="glass-panel p-6">
        <h2 className="text-base font-bold text-slate-800 mb-6 flex items-center gap-2">
          <Plus className="w-5 h-5 text-blue-600" />
          إعلان جديد
        </h2>
        <form onSubmit={handleSend} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">العنوان</label>
              <input
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium placeholder-slate-400 shadow-sm"
                placeholder="مثال: صيانة مجدولة يوم الجمعة"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">نوع الإعلان</label>
              <select
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium shadow-sm appearance-none cursor-pointer"
                value={type}
                onChange={e => setType(e.target.value as typeof type)}
              >
                <option value="INFO">معلومات</option>
                <option value="WARNING">تحذير</option>
                <option value="MAINTENANCE">صيانة</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">نص الإعلان</label>
            <textarea
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium placeholder-slate-400 shadow-sm resize-none"
              rows={3}
              placeholder="اكتب نص الإعلان هنا..."
              value={body}
              onChange={e => setBody(e.target.value)}
              required
            />
          </div>

          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-slate-700 mb-2">تاريخ الانتهاء (اختياري)</label>
              <input
                type="datetime-local"
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium shadow-sm"
                value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={sending}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-md active:scale-95 whitespace-nowrap"
            >
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              إرسال للجميع
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      <div className="glass-panel overflow-hidden">
        <div className="p-5 bg-slate-50/50 border-b border-white/40">
          <h2 className="font-bold text-slate-800">الإعلانات السابقة {announcements.length > 0 && <span className="text-slate-500 font-normal text-sm">({announcements.length})</span>}</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-16 text-slate-400">لا توجد إعلانات بعد</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {announcements.map(ann => {
              const cfg = TYPE_CONFIG[ann.type]
              const Icon = cfg.icon
              return (
                <div key={ann.id} className="p-6 transition-colors hover:bg-slate-50/50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <span className={`mt-0.5 flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border shrink-0 ${cfg.color}`}>
                        <Icon className="w-4 h-4" />
                        {cfg.label}
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 truncate text-lg">{ann.title}</p>
                        <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{ann.body}</p>
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3 text-xs font-medium text-slate-500 mt-4">
                          <span className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-md text-slate-600">
                            <Users className="w-3.5 h-3.5" />
                            {ann._count.recipients} مستأجر
                          </span>
                          <span>{new Date(ann.createdAt).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          {ann.expiresAt && (
                            <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
                              ينتهي: {new Date(ann.expiresAt).toLocaleDateString('ar-IQ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
