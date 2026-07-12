'use client'
import { useRef, useState } from 'react'
import { Upload, Download, X, CheckCircle, AlertTriangle, Loader2, FileSpreadsheet, ChevronDown, ChevronUp } from 'lucide-react'

interface ImportResult {
  total: number
  created: number
  skipped: number
  errors: number
  errorDetails: string[]
}

interface Props {
  onClose: () => void
  onImported: () => void
}

const TEMPLATE_ROWS = [
  {
    'اسم المنتج':    'بسكويت شاي',
    'القسم':         'مواد غذائية',
    'المورد':        'شركة النور',
    'سعر الشراء':   1500,
    'اسم الوحدة':   'قطعة',
    'سعر البيع':    2000,
    'معامل التحويل': 1,
    'الباركود':      '6281234567890',
    'الكمية الأولية': 100,
  },
  {
    'اسم المنتج':    'زيت نباتي 1 لتر',
    'القسم':         'مواد غذائية',
    'المورد':        'شركة النور',
    'سعر الشراء':   3000,
    'اسم الوحدة':   'كرتون (12 حبة)',
    'سعر البيع':    3500,
    'معامل التحويل': 12,
    'الباركود':      '',
    'الكمية الأولية': 50,
  },
]

export function ImportModal({ onClose, onImported }: Props) {
  const fileRef    = useRef<HTMLInputElement>(null)
  const [dragging, setDragging]   = useState(false)
  const [file, setFile]           = useState<File | null>(null)
  const [loading, setLoading]     = useState(false)
  const [result, setResult]       = useState<ImportResult | null>(null)
  const [showErrors, setShowErrors] = useState(false)

  async function downloadTemplate() {
    // exceljs is heavy — load it on demand so it stays out of the page bundle.
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('المنتجات', { views: [{ rightToLeft: true }] })

    const headers = Object.keys(TEMPLATE_ROWS[0])
    const widths  = [25, 18, 18, 14, 20, 14, 16, 18, 16]
    ws.columns = headers.map((h, i) => ({ header: h, key: h, width: widths[i] ?? 16 }))
    for (const row of TEMPLATE_ROWS) ws.addRow(row)
    ws.getRow(1).font = { bold: true }

    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'نموذج_استيراد_المخزون.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleFile(f: File) {
    if (!f.name.match(/\.(xlsx|csv)$/i)) {
      alert('يرجى رفع ملف Excel حديث (.xlsx) أو CSV — صيغة .xls القديمة غير مدعومة')
      return
    }
    setFile(f)
    setResult(null)
  }

  async function handleImport() {
    if (!file) return
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res  = await fetch('/api/inventory/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? 'حدث خطأ'); return }
      setResult(data)
      if (data.created > 0) onImported()
    } catch {
      alert('تعذر الاتصال بالخادم')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" dir="rtl"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4"
          style={{ background: 'linear-gradient(135deg, #094B9F, #063A8A)', boxShadow: '0 4px 16px rgba(9,75,159,0.3)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">استيراد المنتجات من Excel</h2>
              <p className="text-blue-200 text-[11px] font-medium">قم بتحميل النموذج ثم رفع الملف المعبّأ</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Step 1 — Download template */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
            <p className="text-xs font-extrabold text-blue-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-black">١</span>
              تحميل النموذج
            </p>
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              حمّل ملف Excel النموذجي، عبّئ بياناتك فيه، ثم ارفعه أدناه.
            </p>
            <div className="text-[11px] text-slate-500 mb-3 space-y-1">
              {[
                ['اسم المنتج', 'مطلوب'],
                ['سعر البيع', 'مطلوب'],
                ['سعر الشراء', 'اختياري'],
                ['اسم الوحدة', 'اختياري — افتراضي: قطعة'],
                ['معامل التحويل', 'اختياري — افتراضي: 1'],
                ['القسم / المورد', 'اختياري — ينشأ تلقائياً'],
                ['الباركود', 'اختياري — يُولَّد تلقائياً'],
                ['الكمية الأولية', 'اختياري — افتراضي: 0'],
              ].map(([label, note]) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-300 shrink-0" />
                  <span className="font-bold text-slate-700">{label}</span>
                  <span className="text-slate-400">— {note}</span>
                </div>
              ))}
            </div>
            <button onClick={downloadTemplate}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #094B9F, #063A8A)', boxShadow: '0 4px 12px rgba(9,75,159,0.3)' }}>
              <Download className="w-4 h-4" /> تحميل النموذج
            </button>
          </div>

          {/* Step 2 — Upload file */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <p className="text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-slate-600 text-white flex items-center justify-center text-[10px] font-black">٢</span>
              رفع الملف
            </p>

            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/30'
              }`}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => {
                e.preventDefault(); setDragging(false)
                const f = e.dataTransfer.files[0]
                if (f) handleFile(f)
              }}
            >
              <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileSpreadsheet className="w-8 h-8 text-emerald-500" />
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-700">{file.name}</p>
                    <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); setFile(null); setResult(null) }}
                    className="p-1 rounded-lg hover:bg-red-50 text-red-400 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-500">اسحب الملف هنا أو انقر للاختيار</p>
                  <p className="text-xs text-slate-400 mt-1">xlsx, csv</p>
                </>
              )}
            </div>
          </div>

          {/* Result */}
          {result && (
            <div className={`rounded-xl border p-4 space-y-3 ${result.errors > 0 || result.skipped > 0 ? 'border-blue-200 bg-blue-50' : 'border-emerald-200 bg-emerald-50'}`}>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                <p className="text-sm font-extrabold text-slate-700">نتيجة الاستيراد</p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: 'الإجمالي', val: result.total,   color: 'text-slate-700',  bg: 'bg-white' },
                  { label: 'تم إنشاؤه', val: result.created, color: 'text-emerald-700', bg: 'bg-emerald-100' },
                  { label: 'تخطي/خطأ',  val: result.skipped + result.errors, color: 'text-blue-700', bg: 'bg-blue-100' },
                ].map(s => (
                  <div key={s.label} className={`rounded-lg py-2 ${s.bg}`}>
                    <p className={`text-xl font-black ${s.color}`}>{s.val}</p>
                    <p className="text-[10px] font-bold text-slate-500">{s.label}</p>
                  </div>
                ))}
              </div>
              {result.errorDetails.length > 0 && (
                <div>
                  <button onClick={() => setShowErrors(v => !v)}
                    className="flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 transition-colors">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    تفاصيل التخطي والأخطاء ({result.errorDetails.length})
                    {showErrors ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  {showErrors && (
                    <div className="mt-2 max-h-32 overflow-y-auto space-y-1 rounded-lg border border-blue-200 bg-white p-2"
                      style={{ scrollbarWidth: 'thin' }}>
                      {result.errorDetails.map((d, i) => (
                        <p key={i} className="text-[11px] text-blue-800 font-medium">{d}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-5">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm transition-all">
            {result ? 'إغلاق' : 'إلغاء'}
          </button>
          {!result && (
            <button onClick={handleImport} disabled={!file || loading}
              className="flex-1 py-2.5 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}>
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الاستيراد...</>
                : <><Upload className="w-4 h-4" /> بدء الاستيراد</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
