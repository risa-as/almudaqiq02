'use client';

import React, { useEffect, useState } from 'react';
import AdminBackButton from '@/components/AdminBackButton';
import { ShieldAlert, Search, Database, Clock, User as UserIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { useBranch } from '@/contexts/BranchContext';

interface AuditLog {
    id: number;
    userId: number | null;
    username: string | null;
    action: string;
    entity: string;
    entityId: string | null;
    details: string | null;
    createdAt: string;
}

export default function AuditReportPage() {
    const { selectedBranch, loading: branchLoading } = useBranch();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (branchLoading) return;
        fetchLogs();
    }, [selectedBranch, branchLoading]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const branchParam = selectedBranch?.id && selectedBranch.id !== 'all'
                ? `?branchId=${selectedBranch.id}` : '';
            const res = await fetch(`/api/audit${branchParam}`);
            if (res.ok) {
                setLogs(await res.json());
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const formatAction = (action: string) => {
        switch (action) {
            case 'UPDATE_PRODUCT': return <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded">تعديل منتج</span>;
            case 'DELETE_PRODUCT': return <span className="text-red-600 bg-red-50 px-2 py-1 rounded">حذف منتج</span>;
            case 'UPDATE_CUSTOMER': return <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded">تعديل عميل</span>;
            case 'DELETE_CUSTOMER': return <span className="text-red-600 bg-red-50 px-2 py-1 rounded">حذف عميل</span>;
            default: return <span className="text-gray-600 bg-gray-100 px-2 py-1 rounded">{action}</span>;
        }
    };

    const filteredLogs = logs.filter(log =>
        (log.details?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (log.username?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (log.entity?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen flex flex-col p-6 md:p-12 mb-20 md:mb-0" dir="rtl" style={{ background: 'var(--bg-page)' }}>
            <div className="max-w-7xl mx-auto w-full space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 animate-fade-in-up">
                    <div>
                        <div className="mb-2"><AdminBackButton /></div>
                        <div className="flex items-center gap-4">
                            <div className="relative w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg"
                                style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' }}>
                                <div className="absolute inset-0 rounded-2xl opacity-40" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 60%)' }} />
                                <ShieldAlert size={22} color="white" />
                            </div>
                            <h1 className="text-2xl font-extrabold tracking-tight" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                سجل التدقيق (Audit Log)
                            </h1>
                        </div>
                        <p className="text-gray-500 mt-1 max-w-xl">
                            مراقبة جميع العمليات والتعديلات الحساسة التي تمت على النظام، لمعرفة من قام بالتغيير ومتى. (متاح للمدير فقط)
                        </p>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            placeholder="بحث في السجل (اسم المستخدم، الحدث، التفاصيل)..."
                            className="w-full bg-gray-50 border border-gray-200 text-gray-700 font-bold rounded-xl pr-10 pl-4 py-3 outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Search className="absolute right-3 top-3.5 text-gray-400" size={20} />
                    </div>
                </div>

                {/* Data Table */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-right">
                            <thead>
                                <tr className="bg-gray-50/80 border-b border-gray-100 text-gray-500">
                                    <th className="py-4 px-6 font-bold">التاريخ والوقت</th>
                                    <th className="py-4 px-6 font-bold">المستخدم</th>
                                    <th className="py-4 px-6 font-bold">الإجراء (الحدث)</th>
                                    <th className="py-4 px-6 font-bold">العنصر (ID)</th>
                                    <th className="py-4 px-6 font-bold">تفاصيل التعديل</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="py-12 text-center text-gray-500 font-bold">
                                            جاري تحميل السجل...
                                        </td>
                                    </tr>
                                ) : filteredLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-12 text-center text-gray-500 font-bold">
                                            لا توجد حركات مسجلة مطابقة للبحث.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLogs.map(log => (
                                        <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="py-4 px-6 whitespace-nowrap text-gray-500 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <Clock size={16} className="text-gray-400" />
                                                    {new Date(log.createdAt).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 whitespace-nowrap">
                                                <div className="flex items-center gap-2 font-bold text-gray-900">
                                                    <UserIcon size={16} className="text-gray-400" />
                                                    {log.username || 'System'}
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 whitespace-nowrap font-bold">
                                                {formatAction(log.action)}
                                            </td>
                                            <td className="py-4 px-6 whitespace-nowrap">
                                                <div className="flex items-center gap-2 font-bold text-gray-700">
                                                    <Database size={16} className="text-gray-400" />
                                                    {log.entity} <span className="text-gray-400">#{log.entityId}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-gray-600 text-sm max-w-sm truncate" title={log.details || ''}>
                                                {log.details}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
