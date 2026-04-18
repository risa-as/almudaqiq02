'use client'

import { useEffect, useState } from 'react'
import { Plus, Building2, Copy, Check } from 'lucide-react'

import toast from 'react-hot-toast';
interface Branch {
  id: string; name: string; address?: string; phone?: string
  isActive: boolean; activationCode: string; createdAt: string
  _count: { transactions: number; users: number }
}

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading]   = useState(true)
  const [form, setForm]         = useState({ name: '', address: '', phone: '' })
  const [showForm, setShowForm] = useState(false)
  const [copied, setCopied]     = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    fetch('/api/branches').then(r => r.json()).then(setBranches).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  async function createBranch(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/branches', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    if (res.ok) { setShowForm(false); setForm({ name: '', address: '', phone: '' }); load() }
    else { const d = await res.json(); toast(d.error); }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="relative w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
                style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}>
                <div className="absolute inset-0 rounded-xl opacity-40" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 60%)' }} />
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>الفروع</h1>
              <p className="text-gray-500 text-sm mt-0.5">{branches.length} فرع</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm transition-colors font-bold shadow-md"
          style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
        >
          <Plus className="w-4 h-4" />
          إضافة فرع
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowForm(false)}>
          <form onSubmit={createBranch} onClick={e => e.stopPropagation()} className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <h2 className="text-lg font-semibold">إضافة فرع جديد</h2>
            <div>
              <label className="text-sm text-gray-600 block mb-1">اسم الفرع *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-1">العنوان</label>
              <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-1">الهاتف</label>
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="submit" className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm hover:bg-blue-700 transition-colors">إنشاء الفرع</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 border rounded-lg text-sm hover:bg-gray-50 transition-colors">إلغاء</button>
            </div>
          </form>
        </div>
      )}

      {/* Branches grid */}
      {loading ? (
        <div className="text-center text-gray-400 py-16">جاري التحميل...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map(b => (
            <div key={b.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-500" />
                  <div>
                    <h3 className="font-semibold text-gray-900">{b.name}</h3>
                    {b.address && <p className="text-xs text-gray-400 mt-0.5">{b.address}</p>}
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${b.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {b.isActive ? 'نشط' : 'غير نشط'}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-lg font-bold text-gray-900">{b._count.transactions.toLocaleString('ar-IQ')}</p>
                  <p className="text-xs text-gray-500">معاملة</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-lg font-bold text-gray-900">{b._count.users}</p>
                  <p className="text-xs text-gray-500">موظف</p>
                </div>
              </div>

              <div className="mt-3 p-2 bg-blue-50 rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-500">رمز التفعيل</p>
                  <p className="font-mono text-sm font-bold text-blue-700">{b.activationCode}</p>
                </div>
                <button
                  onClick={() => copyCode(b.activationCode)}
                  className="p-1.5 hover:bg-blue-100 rounded transition-colors"
                  title="نسخ"
                >
                  {copied === b.activationCode ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-blue-500" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
