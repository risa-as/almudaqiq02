'use client'

import { useState, useEffect } from 'react'
import { KeyRound, Plus, Loader2, CheckCircle2, Copy, Shield, Clock } from 'lucide-react'
import { PulseLoader } from '@/components/loading/PulseLoader'

import toast from 'react-hot-toast';
interface LicenseRecord {
  id: string
  clientName: string
  clientPhone: string | null
  clientAddress: string | null
  duration: string
  expiresAt: string | null
  generatedAt: string
  licenseKey: string
  machineId: string | null
}

const DURATION_LABELS: Record<string, string> = {
  '1M':       'شهر واحد',
  '3M':       '3 أشهر',
  '6M':       '6 أشهر',
  '1Y':       'سنة كاملة',
  'LIFETIME': 'مدى الحياة ♾️',
  'CUSTOM':   'مخصص (بالأيام)',
}

export default function LicensesPage() {
  const [licenses, setLicenses]             = useState<LicenseRecord[]>([])
  const [loading, setLoading]               = useState(true)
  const [generating, setGenerating]         = useState(false)
  const [newKey, setNewKey]                 = useState<string | null>(null)
  const [copied, setCopied]                 = useState(false)

  const [clientName,    setClientName]    = useState('')
  const [clientPhone,   setClientPhone]   = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [duration,      setDuration]      = useState('1Y')
  const [machineId,     setMachineId]     = useState('')
  const [customDays,    setCustomDays]    = useState(30)

  async function fetchLicenses() {
    setLoading(true)
    try {
      const res = await fetch('/api/super-admin/licenses')
      if (res.ok) {
        const data = await res.json()
        setLicenses(data.licenses)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLicenses() }, [])

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!clientName.trim()) return
    setGenerating(true)
    setNewKey(null)
    try {
      const res = await fetch('/api/super-admin/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName,
          clientPhone:   clientPhone.trim()   || null,
          clientAddress: clientAddress.trim() || null,
          duration:      duration === 'CUSTOM' ? `${customDays}d` : duration,
          machineId:     machineId.trim()      || null,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setNewKey(data.licenseKey)
        setClientName(''); setClientPhone(''); setClientAddress(''); setMachineId('')
        fetchLicenses()
      } else {
        toast.error(data.error || 'فشل توليد الترخيص');
      }
    } finally {
      setGenerating(false)
    }
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6 max-w-6xl animate-fade-in-up" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
            <div className="absolute inset-0 rounded-2xl opacity-40" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 60%)' }} />
            <KeyRound className="w-6 h-6 text-white relative" />
        </div>
        <div>
          <h1 className="text-[1.75rem] font-extrabold tracking-tight" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>إدارة التراخيص</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">توليد وتتبع تراخيص تطبيق سطح المكتب (Desktop App)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Generate Form - LHS on large screens */}
        <div className="xl:col-span-1">
          <div className="glass-panel rounded-[20px] p-6 shadow-sm border border-slate-200">
            <h2 className="text-[1rem] font-bold text-slate-800 mb-5 flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-500" />
              توليد ترخيص جديد
            </h2>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-[13px] font-bold text-slate-700 mb-1.5">اسم العميل *</label>
                <input
                  className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 text-[14px] text-slate-800 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm"
                  placeholder="مثال: سوبر ماركت الفرح"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-slate-700 mb-1.5">رقم الهاتف</label>
                <input
                  className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 text-[14px] text-slate-800 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm"
                  placeholder="مثال: 0770 123 4567"
                  value={clientPhone}
                  onChange={e => setClientPhone(e.target.value)}
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-slate-700 mb-1.5">العنوان</label>
                <input
                  className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 text-[14px] text-slate-800 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm"
                  placeholder="مثال: بغداد - حي الجامعة"
                  value={clientAddress}
                  onChange={e => setClientAddress(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-slate-700 mb-1.5">مدة الترخيص</label>
                <select
                  className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 text-[14px] text-slate-800 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm appearance-none cursor-pointer"
                  value={duration}
                  onChange={e => setDuration(e.target.value)}
                >
                  {Object.entries(DURATION_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              {duration === 'CUSTOM' && (
                <div className="animate-fade-in">
                  <label className="block text-[13px] font-bold text-slate-700 mb-1.5">عدد الأيام</label>
                  <input
                    type="number"
                    min={1}
                    className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 text-[14px] font-[family-name:var(--font-mono)] text-slate-800 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all shadow-sm"
                    value={customDays}
                    onChange={e => setCustomDays(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>
              )}
              <div>
                <label className="block text-[13px] font-bold text-slate-700 mb-1.5">
                  بصمة الجهاز (Machine ID)
                  <span className="block text-[11px] text-slate-500 font-medium mt-0.5">اتركه فارغاً للترخيص المفتوح (بدون تقييد لجهاز)</span>
                </label>
                <input
                  className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 text-[13px] font-[family-name:var(--font-mono)] text-slate-800 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 transition-all shadow-sm"
                  placeholder="مثال: aa:bb:cc:dd:ee:ff"
                  value={machineId}
                  onChange={e => setMachineId(e.target.value)}
                  dir="ltr"
                />
              </div>
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={generating}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-md shadow-emerald-500/20"
                >
                  {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
                  توليد واعتماد الترخيص
                </button>
              </div>
            </form>

            {newKey && (
              <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-2xl p-5 animate-fade-in shadow-inner">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-emerald-700 font-bold flex items-center gap-2 text-[14px]">
                    <CheckCircle2 className="w-4 h-4" />
                    تم التوليد بنجاح!
                  </p>
                  <button
                    onClick={() => handleCopy(newKey)}
                    className="flex items-center gap-1.5 text-[12px] font-bold text-emerald-700 hover:text-white bg-emerald-100 hover:bg-emerald-600 px-3 py-1.5 rounded-lg transition-all shadow-sm"
                  >
                    {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'تم النسخ!' : 'نسخ المفتاح'}
                  </button>
                </div>
                <textarea
                  readOnly
                  className="w-full bg-white text-emerald-800 font-[family-name:var(--font-mono)] text-[12px] p-3 rounded-xl resize-none border-2 border-emerald-100 outline-none shadow-sm focus:border-emerald-300 transition-colors"
                  rows={4}
                  value={newKey}
                  dir="ltr"
                />
              </div>
            )}
          </div>
        </div>

        {/* Table - RHS on large screens */}
        <div className="xl:col-span-2">
          {loading && licenses.length === 0 ? (
            <div className="glass-panel rounded-3xl p-16 flex justify-center"><PulseLoader /></div>
          ) : (
            <div className="bg-white rounded-[20px] shadow-sm shadow-slate-200/50 border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                   <Clock className="w-4 h-4 text-blue-600" />
                </div>
                <h2 className="font-bold text-slate-800 text-[15px]">سجل التراخيص الصادرة</h2>
                <span className="bg-slate-200 text-slate-600 text-[11px] font-black px-2.5 py-0.5 rounded-full font-[family-name:var(--font-mono)]">{licenses.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="text-right">م</th>
                      <th className="text-right">العميل</th>
                      <th className="text-right">المدة</th>
                      <th className="text-right">بصمة الجهاز</th>
                      <th className="text-right">التاريخ</th>
                      <th className="text-center">إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {licenses.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-12 text-slate-400 font-medium">لا توجد تراخيص مصدرة حالياً</td></tr>
                    ) : licenses.map((lic, idx) => (
                      <tr key={lic.id}>
                        <td className="text-slate-400 font-[family-name:var(--font-mono)]">{idx + 1}</td>
                        <td>
                          <span className="font-bold text-slate-800 block text-[14px]">{lic.clientName}</span>
                          {lic.clientPhone && <span className="text-[12px] text-slate-500 font-medium font-[family-name:var(--font-mono)] mt-0.5 block">{lic.clientPhone}</span>}
                        </td>
                        <td>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-700">
                            {DURATION_LABELS[lic.duration] ?? lic.duration}
                          </span>
                        </td>
                        <td className="font-[family-name:var(--font-mono)] text-[12px]">
                          {lic.machineId
                            ? <code className="text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-md border border-cyan-100">{lic.machineId}</code>
                            : <span className="text-slate-400 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">مفتوح الترخيص</span>}
                        </td>
                        <td>
                          <span className="block text-[13px] text-slate-700 font-medium">إصدار: {new Date(lic.generatedAt).toLocaleDateString('ar-IQ')}</span>
                          <span className="block text-[12px] text-slate-500 mt-0.5">
                            انتهاء: {lic.expiresAt ? new Date(lic.expiresAt).toLocaleDateString('ar-IQ') : 'مدى الحياة ♾️'}
                          </span>
                        </td>
                        <td className="text-center">
                          <button
                            onClick={() => handleCopy(lic.licenseKey)}
                            className="text-slate-400 hover:text-emerald-600 p-2 rounded-lg hover:bg-emerald-50 transition-colors bg-slate-50 border border-slate-100"
                            title="نسخ مفتاح الترخيص"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
