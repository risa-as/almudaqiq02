'use client'
import { usePageTitle } from '@/hooks/usePageTitle';

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchJsonOr } from '@/lib/query/fetcher'
import {
  KeySquare, Plus, Loader2, CheckCircle2, Copy, Shield, Clock, Info,
  Eye, EyeOff, Wand2, Search, Ban, RotateCcw, User, AlertTriangle,
} from 'lucide-react'
import { PulseLoader } from '@/components/loading/PulseLoader'

import toast from 'react-hot-toast';

interface OfflineLicenseRecord {
  id: string
  clientName: string
  clientEmail: string | null
  clientPhone: string | null
  clientAddress: string | null
  clientUsername: string
  duration: string
  expiresAt: string | null
  machineId: string | null
  licenseKey: string
  isRevoked: boolean
  revokedAt: string | null
  notes: string | null
  generatedAt: string
  generatedBy: string | null
}

interface GenerateResult {
  licenseId: string
  licenseKey: string
  clientName: string
  clientUsername: string
  clientPassword: string
  duration: string
  expiresAt: string
}

const DURATION_LABELS: Record<string, string> = {
  '1M':       'شهر واحد',
  '3M':       '3 أشهر',
  '6M':       '6 أشهر',
  '1Y':       'سنة كاملة',
  'LIFETIME': 'مدى الحياة ♾️',
  'CUSTOM':   'مخصص (بالأيام)',
}

// Crypto-secure (not Math.random()): this value becomes the customer's real
// POS admin password, so it must come from the same quality RNG as the
// server-side generator (crypto.randomInt there, crypto.getRandomValues here).
function secureRandomInt(maxExclusive: number): number {
  const buf = new Uint32Array(1)
  // Reject values that would bias the modulo toward the low end.
  const limit = Math.floor(0xffffffff / maxExclusive) * maxExclusive
  let x: number
  do {
    crypto.getRandomValues(buf)
    x = buf[0]
  } while (x >= limit)
  return x % maxExclusive
}

function generateClientSidePassword(length = 14): string {
  const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower   = 'abcdefghijkmnopqrstuvwxyz'
  const digits  = '23456789'
  const symbols = '!@#$%^&*-_=+'
  const all     = upper + lower + digits + symbols
  const pick    = (set: string) => set[secureRandomInt(set.length)]
  const chars   = [pick(upper), pick(lower), pick(digits), pick(symbols)]
  while (chars.length < length) chars.push(pick(all))
  for (let i = chars.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

function statusOf(lic: OfflineLicenseRecord): { label: string; cls: string } {
  if (lic.isRevoked) return { label: 'مُلغى', cls: 'bg-rose-500/10 text-rose-700 ring-1 ring-rose-500/25' }
  if (lic.expiresAt && new Date(lic.expiresAt).getTime() < Date.now()) {
    return { label: 'منتهي', cls: 'bg-orange-500/10 text-orange-700 ring-1 ring-orange-500/25' }
  }
  return { label: 'نشط', cls: 'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/25' }
}

export default function OfflineLicensesPage() {
  usePageTitle('تراخيص أوف لاين');
  const queryClient = useQueryClient()

  const [generating, setGenerating] = useState(false)
  const [result,     setResult]     = useState<GenerateResult | null>(null)
  const [copiedKey,      setCopiedKey]      = useState(false)
  const [copiedPassword, setCopiedPassword] = useState(false)

  const [clientName,     setClientName]     = useState('')
  const [clientUsername, setClientUsername] = useState('')
  const [clientPassword, setClientPassword] = useState('')
  const [showPassword,   setShowPassword]   = useState(false)
  const [clientEmail,    setClientEmail]    = useState('')
  const [clientPhone,    setClientPhone]    = useState('')
  const [clientAddress,  setClientAddress]  = useState('')
  const [duration,       setDuration]       = useState('1Y')
  const [customDays,     setCustomDays]     = useState(30)
  const [machineId,      setMachineId]      = useState('')
  const [notes,          setNotes]          = useState('')

  const [search, setSearch] = useState('')
  const [rowBusyId, setRowBusyId] = useState<string | null>(null)

  const licensesQuery = useQuery({
    queryKey: ['sa-offline-licenses', search],
    queryFn: () => fetchJsonOr<{ licenses: OfflineLicenseRecord[] }>(
      `/api/super-admin/offline-licenses${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ''}`,
      { licenses: [] }
    ),
  })
  const licenses = licensesQuery.data?.licenses ?? []
  const loading  = licensesQuery.isPending

  function resetForm() {
    setClientName(''); setClientUsername(''); setClientPassword('')
    setClientEmail(''); setClientPhone(''); setClientAddress('')
    setMachineId(''); setNotes('')
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!clientName.trim() || !clientUsername.trim()) return
    setGenerating(true)
    setResult(null)
    try {
      const res = await fetch('/api/super-admin/offline-licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName,
          clientUsername,
          clientPassword: clientPassword.trim() || undefined,
          clientEmail:    clientEmail.trim()    || undefined,
          clientPhone:    clientPhone.trim()    || undefined,
          clientAddress:  clientAddress.trim()  || undefined,
          duration:       duration === 'CUSTOM' ? `${customDays}d` : duration,
          machineId:      machineId.trim(),
          notes:          notes.trim()          || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult(data)
        resetForm()
        toast.success('تم توليد الترخيص بنجاح')
        await queryClient.invalidateQueries({ queryKey: ['sa-offline-licenses'] })
      } else {
        toast.error(data.error || 'فشل توليد الترخيص')
      }
    } catch {
      toast.error('تعذّر الاتصال بالخادم')
    } finally {
      setGenerating(false)
    }
  }

  async function handleToggleRevoke(lic: OfflineLicenseRecord) {
    setRowBusyId(lic.id)
    try {
      const res = await fetch('/api/super-admin/offline-licenses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lic.id, isRevoked: !lic.isRevoked }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(lic.isRevoked ? 'تم إلغاء الإلغاء — الترخيص نشط مجدداً' : 'تم إلغاء الترخيص')
        await queryClient.invalidateQueries({ queryKey: ['sa-offline-licenses'] })
      } else {
        toast.error(data.error || 'فشل تحديث حالة الترخيص')
      }
    } catch {
      toast.error('تعذّر الاتصال بالخادم')
    } finally {
      setRowBusyId(null)
    }
  }

  function handleCopy(text: string, which: 'key' | 'password') {
    navigator.clipboard.writeText(text)
    if (which === 'key') { setCopiedKey(true); setTimeout(() => setCopiedKey(false), 2000) }
    else { setCopiedPassword(true); setTimeout(() => setCopiedPassword(false), 2000) }
  }

  return (
    <div className="space-y-6 max-w-6xl animate-fade-in-up" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)' }}>
            <div className="absolute inset-0 rounded-2xl opacity-40" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 60%)' }} />
            <KeySquare className="w-6 h-6 text-white relative" />
        </div>
        <div>
          <h1 className="text-[1.75rem] font-extrabold tracking-tight" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>تراخيص أوف لاين</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">توليد تراخيص Ed25519 تُنشئ حساب دخول جاهز على تطبيق سطح المكتب دون الحاجة لاتصال بالإنترنت</p>
        </div>
      </div>

      {/* Info box */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-[13px] text-amber-800 font-medium leading-relaxed">
          <strong>بصمة الجهاز (Machine ID) إلزامية</strong> — يقرأها العميل من شاشة التفعيل في التطبيق ويرسلها لك.
          هي الضمان الوحيد ضد استخدام المفتاح الواحد على عدة أجهزة: تطبيق سطح المكتب أوف لاين بالكامل، فلا
          يمكن إحصاء التفعيلات ولا الإلغاء عن بُعد بعد الإصدار. الترخيص يوقَّع بمفتاح خاص (Ed25519) لا يغادر
          هذا الخادم. إلغاء الترخيص من هنا إجراء إعلامي فقط ولن يصل إلى جهاز يعمل بدون إنترنت.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Generate Form */}
        <div className="xl:col-span-1">
          <div className="glass-panel rounded-[20px] p-6 shadow-sm border border-slate-200">
            <h2 className="text-[1rem] font-bold text-slate-800 mb-5 flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-500" />
              توليد ترخيص جديد
            </h2>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-[13px] font-bold text-slate-700 mb-1.5">اسم العميل *</label>
                <input
                  className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 text-[14px] text-slate-800 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all shadow-sm"
                  placeholder="مثال: سوبر ماركت الفرح"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-slate-700 mb-1.5">اسم المستخدم *</label>
                <input
                  className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 text-[14px] font-[family-name:var(--font-mono)] text-slate-800 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all shadow-sm"
                  placeholder="مثال: alfarah_admin"
                  value={clientUsername}
                  onChange={e => setClientUsername(e.target.value)}
                  dir="ltr"
                  required
                  minLength={3}
                  maxLength={32}
                  pattern="[a-zA-Z0-9._-]+"
                  title="أحرف/أرقام إنجليزية أو . _ - فقط"
                />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-slate-700 mb-1.5">
                  كلمة المرور
                  <span className="block text-[11px] text-slate-500 font-medium mt-0.5">اتركها فارغة لتوليد كلمة قوية تلقائياً</span>
                </label>
                <div className="relative flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 pl-10 text-[14px] font-[family-name:var(--font-mono)] text-slate-800 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all shadow-sm"
                      placeholder="8 أحرف على الأقل"
                      value={clientPassword}
                      onChange={e => setClientPassword(e.target.value)}
                      dir="ltr"
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(s => !s)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setClientPassword(generateClientSidePassword()); setShowPassword(true) }}
                    className="flex-shrink-0 flex items-center gap-1.5 text-[12px] font-bold text-amber-700 hover:text-white bg-amber-50 hover:bg-amber-600 border border-amber-200 px-3 py-2.5 rounded-xl transition-all shadow-sm"
                    title="توليد كلمة مرور قوية"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-bold text-slate-700 mb-1.5">البريد الإلكتروني</label>
                <input
                  type="email"
                  className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 text-[14px] text-slate-800 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all shadow-sm"
                  placeholder="example@mail.com"
                  value={clientEmail}
                  onChange={e => setClientEmail(e.target.value)}
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-slate-700 mb-1.5">رقم الهاتف</label>
                <input
                  className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 text-[14px] text-slate-800 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all shadow-sm"
                  placeholder="مثال: 0770 123 4567"
                  value={clientPhone}
                  onChange={e => setClientPhone(e.target.value)}
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-slate-700 mb-1.5">العنوان</label>
                <input
                  className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 text-[14px] text-slate-800 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all shadow-sm"
                  placeholder="مثال: بغداد - حي الجامعة"
                  value={clientAddress}
                  onChange={e => setClientAddress(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-slate-700 mb-1.5">مدة الترخيص</label>
                <select
                  className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 text-[14px] text-slate-800 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all shadow-sm appearance-none cursor-pointer"
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
                  بصمة الجهاز (Machine ID) <span className="text-rose-600">*</span>
                  <span className="block text-[11px] text-slate-500 font-medium mt-0.5">إلزامي — يقرأه العميل من شاشة التفعيل في التطبيق</span>
                </label>
                <input
                  required
                  pattern="^[0-9a-fA-F]{2}([:-][0-9a-fA-F]{2}){5}$"
                  title="صيغة عنوان MAC، مثال: aa:bb:cc:dd:ee:ff"
                  className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 text-[13px] font-[family-name:var(--font-mono)] text-slate-800 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 transition-all shadow-sm"
                  placeholder="مثال: aa:bb:cc:dd:ee:ff"
                  value={machineId}
                  onChange={e => setMachineId(e.target.value)}
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-slate-700 mb-1.5">ملاحظات</label>
                <textarea
                  className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-2.5 text-[13px] text-slate-800 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all shadow-sm resize-none"
                  rows={2}
                  placeholder="ملاحظات داخلية اختيارية"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={generating}
                  className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-xl transition-all shadow-md shadow-amber-500/20"
                >
                  {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
                  {generating ? 'جاري التوليد...' : 'توليد الترخيص'}
                </button>
              </div>
            </form>

            {result && (
              <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-2xl p-5 animate-fade-in shadow-inner space-y-4">
                <p className="text-emerald-700 font-bold flex items-center gap-2 text-[14px]">
                  <CheckCircle2 className="w-4 h-4" />
                  تم التوليد بنجاح!
                </p>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] font-bold text-emerald-800">مفتاح الترخيص</span>
                    <button
                      onClick={() => handleCopy(result.licenseKey, 'key')}
                      className="flex items-center gap-1.5 text-[12px] font-bold text-emerald-700 hover:text-white bg-emerald-100 hover:bg-emerald-600 px-3 py-1.5 rounded-lg transition-all shadow-sm"
                    >
                      {copiedKey ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedKey ? 'تم النسخ!' : 'نسخ المفتاح'}
                    </button>
                  </div>
                  <textarea
                    readOnly
                    className="w-full bg-white text-emerald-800 font-[family-name:var(--font-mono)] text-[12px] p-3 rounded-xl resize-none border-2 border-emerald-100 outline-none shadow-sm focus:border-emerald-300 transition-colors"
                    rows={4}
                    value={result.licenseKey}
                    dir="ltr"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] font-bold text-emerald-800">كلمة المرور ({result.clientUsername})</span>
                    <button
                      onClick={() => handleCopy(result.clientPassword, 'password')}
                      className="flex items-center gap-1.5 text-[12px] font-bold text-emerald-700 hover:text-white bg-emerald-100 hover:bg-emerald-600 px-3 py-1.5 rounded-lg transition-all shadow-sm"
                    >
                      {copiedPassword ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedPassword ? 'تم النسخ!' : 'نسخ كلمة المرور'}
                    </button>
                  </div>
                  <div className="w-full bg-white text-emerald-800 font-[family-name:var(--font-mono)] text-[14px] font-bold p-3 rounded-xl border-2 border-emerald-100 shadow-sm" dir="ltr">
                    {result.clientPassword}
                  </div>
                </div>

                <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <p className="text-[12px] text-rose-700 font-bold leading-relaxed">
                    تُعرض كلمة المرور هذه مرة واحدة فقط ولا يتم تخزينها — انسخها وسلّمها للعميل الآن، فلن تكون متاحة مجدداً بعد مغادرة هذه الصفحة.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="xl:col-span-2 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2" />
            <input
              className="w-full bg-white border-2 border-slate-200 rounded-xl pr-11 pl-4 py-2.5 text-[14px] text-slate-800 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all shadow-sm"
              placeholder="بحث بالاسم أو اسم المستخدم..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {loading && licenses.length === 0 ? (
            <div className="glass-panel rounded-3xl p-16 flex justify-center"><PulseLoader /></div>
          ) : (
            <div className="bg-[var(--bg-card)] rounded-[var(--border-radius-card)] shadow-card border border-[var(--border-color)] overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                   <Clock className="w-4 h-4 text-amber-600" />
                </div>
                <h2 className="font-bold text-slate-800 text-[15px]">سجل التراخيص أوف لاين الصادرة</h2>
                <span className="bg-slate-200 text-slate-600 text-[11px] font-black px-2.5 py-0.5 rounded-full font-[family-name:var(--font-mono)]">{licenses.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead className="bg-gray-50/50 border-b border-[var(--border-color)]">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">العميل</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">اسم المستخدم</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">المدة</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">بصمة الجهاز</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">الحالة</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">التاريخ</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {licenses.length === 0 ? (
                      <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">لا توجد تراخيص أوف لاين مصدرة حالياً</td></tr>
                    ) : licenses.map((lic) => {
                      const status = statusOf(lic)
                      return (
                        <tr key={lic.id} className="hover:bg-amber-50/40 transition-colors group">
                          <td className="px-6 py-4">
                            <span className="font-bold text-slate-800 block text-[14px]">{lic.clientName}</span>
                            {(lic.clientEmail || lic.clientPhone) && (
                              <span className="text-[12px] text-slate-500 font-medium font-[family-name:var(--font-mono)] mt-0.5 block">
                                {lic.clientEmail || lic.clientPhone}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-slate-700 font-[family-name:var(--font-mono)]">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              {lic.clientUsername}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-700">
                              {DURATION_LABELS[lic.duration] ?? lic.duration}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-[family-name:var(--font-mono)] text-[12px]">
                            {lic.machineId
                              ? <code className="text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-md border border-cyan-100">{lic.machineId}</code>
                              : <span className="text-slate-400 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100">مفتوح الترخيص</span>}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${status.cls}`}>
                              {status.label}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="block text-[13px] text-slate-700 font-medium">إصدار: {new Date(lic.generatedAt).toLocaleDateString('ar-IQ')}</span>
                            <span className="block text-[12px] text-slate-500 mt-0.5">
                              انتهاء: {lic.expiresAt ? new Date(lic.expiresAt).toLocaleDateString('ar-IQ') : 'مدى الحياة ♾️'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleCopy(lic.licenseKey, 'key')}
                                className="text-slate-400 hover:text-emerald-600 p-2 rounded-lg hover:bg-emerald-50 transition-colors bg-slate-50 border border-slate-100"
                                title="نسخ مفتاح الترخيص"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleToggleRevoke(lic)}
                                disabled={rowBusyId === lic.id}
                                className={`p-2 rounded-lg transition-colors border disabled:opacity-50 ${
                                  lic.isRevoked
                                    ? 'text-emerald-600 hover:bg-emerald-50 bg-slate-50 border-slate-100'
                                    : 'text-rose-500 hover:bg-rose-50 bg-slate-50 border-slate-100'
                                }`}
                                title={lic.isRevoked ? 'إلغاء الإلغاء (تفعيل)' : 'إلغاء الترخيص'}
                              >
                                {rowBusyId === lic.id
                                  ? <Loader2 className="w-4 h-4 animate-spin" />
                                  : lic.isRevoked ? <RotateCcw className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
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
