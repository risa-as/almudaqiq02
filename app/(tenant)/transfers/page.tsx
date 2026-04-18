'use client'

import { useEffect, useState } from 'react'
import { ArrowLeftRight, Plus, CheckCircle, XCircle, Clock, Truck, GitBranch } from 'lucide-react'
import { useBranch } from '@/contexts/BranchContext'

interface Transfer {
  id: string; status: string; notes?: string; createdAt: string
  fromBranch: { name: string }; toBranch: { name: string }
  items: string
}

const STATUS_CONFIG: Record<string, { label: string; class: string; icon: React.ElementType }> = {
  PENDING:   { label: 'معلق',    class: 'bg-yellow-100 text-yellow-700', icon: Clock },
  APPROVED:  { label: 'موافق',   class: 'bg-blue-100 text-blue-700',    icon: CheckCircle },
  COMPLETED: { label: 'منفذ',    class: 'bg-green-100 text-green-700',   icon: Truck },
  CANCELLED: { label: 'ملغى',    class: 'bg-red-100 text-red-700',      icon: XCircle },
}

export default function TransfersPage() {
  const { branches, loading: branchesLoading } = useBranch()
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [loading, setLoading]     = useState(true)

  const load = () => {
    setLoading(true)
    fetch('/api/transfers').then(r => r.json()).then(setTransfers).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  async function approve(id: string) {
    await fetch(`/api/transfers/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'APPROVED' }) })
    load()
  }

  async function complete(id: string) {
    await fetch(`/api/transfers/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'COMPLETED' }) })
    load()
  }

  async function cancel(id: string) {
    if (!confirm('هل تريد إلغاء هذا النقل؟')) return
    await fetch(`/api/transfers/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'CANCELLED' }) })
    load()
  }

  if (branchesLoading) {
    return <div className="min-h-[70vh] flex items-center justify-center"><div className="w-8 h-8 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" /></div>
  }

  if (branches.length <= 1) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center" dir="rtl">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="relative inline-flex items-center justify-center mb-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-100 to-indigo-200 flex items-center justify-center shadow-inner">
              <GitBranch className="w-10 h-10 text-indigo-500" />
            </div>
            <span className="absolute -top-1 -right-1 text-2xl">🏪</span>
            <span className="absolute -bottom-1 -left-1 text-2xl">📦</span>
          </div>
          <h2 className="text-2xl font-extrabold text-gray-800 mb-3">فرع واحد فقط!</h2>
          <p className="text-gray-500 leading-relaxed mb-2">
            ميزة نقل المخزون تعمل عندما يكون لديك <span className="font-bold text-indigo-600">فرعان أو أكثر</span>.
          </p>
          <p className="text-gray-400 text-sm">
            أضف فرعاً جديداً من إعدادات النظام لتتمكن من نقل البضائع بين الفروع.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-600 px-4 py-2 rounded-full text-sm font-bold">
            <ArrowLeftRight className="w-4 h-4" />
            نقل المخزون بين الفروع
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="relative w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
                style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}>
                <div className="absolute inset-0 rounded-xl opacity-40" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 60%)' }} />
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>نقل المخزون</h1>
              <p className="text-gray-500 text-sm mt-0.5">إدارة طلبات نقل المخزون بين الفروع</p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">جاري التحميل...</div>
      ) : transfers.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ArrowLeftRight className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>لا يوجد طلبات نقل</p>
        </div>
      ) : (
        <div className="space-y-3">
          {transfers.map(t => {
            const config = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.PENDING
            const Icon   = config.icon
            let items: any[] = []
            try { items = JSON.parse(t.items) } catch {}

            return (
              <div key={t.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <ArrowLeftRight className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">
                        {t.fromBranch.name} → {t.toBranch.name}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {items.length} صنف · {new Date(t.createdAt).toLocaleDateString('ar-IQ')}
                      </p>
                      {t.notes && <p className="text-xs text-gray-500 mt-1">{t.notes}</p>}
                    </div>
                  </div>
                  <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${config.class}`}>
                    <Icon className="w-3 h-3" />
                    {config.label}
                  </span>
                </div>

                {(t.status === 'PENDING' || t.status === 'APPROVED') && (
                  <div className="flex gap-2 mt-4 pt-4 border-t border-gray-50">
                    {t.status === 'PENDING' && (
                      <button onClick={() => approve(t.id)} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors">
                        موافقة
                      </button>
                    )}
                    {t.status === 'APPROVED' && (
                      <button onClick={() => complete(t.id)} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors">
                        تأكيد التنفيذ
                      </button>
                    )}
                    <button onClick={() => cancel(t.id)} className="text-xs border text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                      إلغاء
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
