'use client';
import { usePageTitle } from '@/hooks/usePageTitle';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, KeyRound, AlertCircle, Loader2, CheckCircle2, Cpu, Copy } from 'lucide-react';

export default function ActivatePage() {
  usePageTitle('تفعيل الحساب');
    const router = useRouter();
    const [key, setKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [machineId, setMachineId] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        // Fetch the machine ID to display to the client
        fetch('/api/license/machine-id')
            .then(res => res.json())
            .then(data => setMachineId(data.machineId ?? null))
            .catch(() => setMachineId('تعذر القراءة'));
    }, []);

    const handleCopyMachineId = () => {
        if (!machineId) return;
        navigator.clipboard.writeText(machineId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleActivate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!key.trim()) return;

        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/license/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: key.trim() }),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setSuccess(true);
                setTimeout(() => router.push('/'), 2000);
            } else {
                const errorMessages: Record<string, string> = {
                    EXPIRED: '⏰ انتهت صلاحية رمز التفعيل. يرجى التواصل مع المطور للحصول على رمز جديد.',
                    INVALID: '🚫 رمز التفعيل غير صحيح أو مزيف. يرجى التحقق منه والمحاولة مجدداً.',
                    MACHINE_MISMATCH: '💻 هذا الترخيص مرتبط بجهاز آخر ولا يمكن استخدامه هنا. يرجى التواصل مع المطور وتزويده ببصمة جهازك الظاهرة أدناه.',
                };
                setError(errorMessages[data.error] || data.message || 'حدث خطأ أثناء التفعيل');
            }
        } catch {
            setError('تعذر الاتصال بالنظام. يرجى المحاولة مجدداً.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="min-h-screen flex items-center justify-center p-4"
            dir="rtl"
            style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)' }}
        >
            {/* Decorative Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl" />
            </div>

            <div className="relative w-full max-w-md">
                {/* Logo / Icon */}
                <div className="flex justify-center mb-8">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/30">
                        <ShieldCheck size={40} className="text-white" />
                    </div>
                </div>

                {/* Card */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl space-y-6">
                    <div className="text-center">
                        <h1 className="text-2xl font-extrabold text-white mb-2">تفعيل النظام</h1>
                        <p className="text-white/50 text-sm">أدخل رمز التفعيل الذي حصلت عليه من المطور لبدء استخدام النظام</p>
                    </div>

                    {/* Machine ID Display */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Cpu size={16} className="text-cyan-400" />
                            <p className="text-white/60 text-xs font-bold uppercase tracking-wider">بصمة جهازك — أرسلها للمطور</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <code className="flex-1 text-cyan-300 font-mono text-sm bg-black/30 px-3 py-2 rounded-lg tracking-widest" dir="ltr">
                                {machineId ?? '...'}
                            </code>
                            <button
                                onClick={handleCopyMachineId}
                                disabled={!machineId}
                                className="flex items-center gap-1.5 text-xs font-bold text-cyan-300 hover:text-white bg-cyan-500/10 hover:bg-cyan-500/20 px-3 py-2 rounded-lg transition-colors disabled:opacity-40"
                                title="نسخ بصمة الجهاز"
                            >
                                {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                                {copied ? 'تم!' : 'نسخ'}
                            </button>
                        </div>
                    </div>

                    {success ? (
                        <div className="flex flex-col items-center gap-4 py-6">
                            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center">
                                <CheckCircle2 size={32} className="text-emerald-400" />
                            </div>
                            <p className="text-emerald-400 font-bold text-lg">تم التفعيل بنجاح! 🎉</p>
                            <p className="text-white/50 text-sm">جاري تحويلك إلى النظام...</p>
                        </div>
                    ) : (
                        <form onSubmit={handleActivate} className="space-y-5">
                            {error && (
                                <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                                    <AlertCircle size={18} className="text-red-400 mt-0.5 flex-shrink-0" />
                                    <p className="text-red-300 text-sm leading-relaxed">{error}</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-bold text-white/70 mb-2">
                                    <KeyRound size={14} className="inline ml-1 mb-0.5" />
                                    رمز التفعيل
                                </label>
                                <textarea
                                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white font-mono text-xs placeholder-white/20 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all resize-none"
                                    rows={5}
                                    placeholder="الصق رمز التفعيل هنا..."
                                    value={key}
                                    onChange={e => setKey(e.target.value)}
                                    dir="ltr"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !key.trim()}
                                className="w-full flex items-center justify-center gap-3 bg-gradient-to-l from-blue-600 to-blue-600 hover:from-blue-500 hover:to-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-extrabold py-4 rounded-xl transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-0.5"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 size={20} className="animate-spin" />
                                        جاري التحقق...
                                    </>
                                ) : (
                                    <>
                                        <ShieldCheck size={20} />
                                        تفعيل النظام
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>

                <p className="text-center text-white/20 text-xs mt-6">
                    هذا النظام محمي بحقوق الملكية الفكرية — للدعم الفني تواصل مع المطور
                </p>
            </div>
        </div>
    );
}
