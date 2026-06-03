import React from 'react';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { formatCurrency } from '@/lib/format';
import { FileText, ArrowRight, User } from 'lucide-react';
import Link from 'next/link';
import PrintButton from './print-button';
import PageHeader from '@/components/ui/PageHeader';

export const dynamic = 'force-dynamic';

export default async function CustomerStatementPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    if (!id) {
        notFound();
    }

    const customer = await prisma.customer.findUnique({
        where: { id },
        include: {
            transactions: {
                orderBy: { date: 'asc' }, // Get in chronological order
                include: {
                    items: {
                        include: { product: true }
                    }
                }
            }
        }
    });

    if (!customer) {
        notFound();
    }

    // Calculate running balance
    let runningBalance = 0;
    const ledgerEntries = customer.transactions.map(tx => {
        let debit = 0; // الزبون أخذ بضاعة (عليه فلوس)
        let credit = 0; // الزبون سدد (إله فلوس)
        let note = '';

        if (tx.type === 'SALE') {
            const txTotal = Number(tx.totalAmount);
            const paid    = Number((tx as any).paidAmount ?? txTotal);
            const method  = (tx as any).paymentMethod ?? 'CASH';

            debit = txTotal;

            if (method === 'CREDIT') {
                // Fully deferred — nothing paid yet
                credit = 0;
            } else if (method === 'SPLIT') {
                // Partial upfront payment
                credit = paid;
            } else {
                // CASH or CARD — paid in full at point of sale
                credit = txTotal;
            }

            const methodLabel = method === 'CREDIT' ? 'آجل' : method === 'CARD' ? 'بطاقة' : method === 'SPLIT' ? 'دفع جزئي' : 'نقدي';
            note = `فاتورة مبيعات رقـم #${tx.id} (${tx.items.length} مواد) - ${methodLabel}`;
        } else if (tx.type === 'PAYMENT') {
            credit = Number(tx.totalAmount);
            note = `تسديد دفعة نقدي سند رقم #${tx.id}`;
        } else if (tx.type === 'RETURN' || tx.type === 'REFUND') {
            credit = Math.abs(Number(tx.totalAmount)); // إرجاع بضاعة ينزل من حسابه
            note = `مرتجع مبيعات رقم #${tx.id}`;
        }

        runningBalance += (debit - credit);

        return {
            id: tx.id,
            date: tx.date,
            note,
            debit,
            credit,
            balance: runningBalance,
            type: tx.type
        };
    });

    // Reversed for display (newest first)
    const displayEntries = [...ledgerEntries].reverse();

    return (
        <div className="min-h-screen bg-gray-50 p-6 md:p-12 text-right" dir="rtl">
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    #printable-statement, #printable-statement * { visibility: visible; }
                    #printable-statement { position: absolute; left: 0; top: 0; width: 100%; direction: rtl;}
                    .no-print { display: none !important; }
                    @page { margin: 10mm; }
                }
            `}</style>

            <div className="max-w-5xl mx-auto space-y-6">

                {/* Actions Header */}
                <div className="flex justify-between items-center no-print">
                    <Link href="/sales/customers" className="flex items-center gap-2 text-gray-500 hover:text-blue-600 font-bold transition-colors">
                        <ArrowRight size={20} />
                        العودة للعملاء
                    </Link>
                    <PrintButton />
                </div>

                {/* Printable Document */}
                <div id="printable-statement" className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 md:p-12 mt-4">

                    {/* Header Info */}
                    <div className="border-b-2 border-[var(--border-color)] pb-6 mb-6 flex justify-between items-start">
                        <div className="w-full">
                            <PageHeader
                                title="كشف حساب عميل تفصيلي"
                                subtitle={`تاريخ الكشف: ${new Date().toLocaleDateString('ar-IQ')} - ${new Date().toLocaleTimeString('ar-IQ')}`}
                                icon={FileText}
                                gradient="linear-gradient(135deg, #094B9F 0%, #063A8A 100%)"
                                actions={
                                    <div className="text-left bg-[var(--bg-page)] p-4 rounded-xl border border-[var(--border-color)] min-w-[250px] mr-auto">
                                        <div className="flex items-center gap-2 font-bold mb-1" style={{ color: 'var(--value-neutral)' }}>
                                            <User size={18} style={{ color: 'var(--icon-neutral)' }} />
                                            {customer.name}
                                        </div>
                                        <div className="text-sm mb-3" style={{ color: 'var(--value-muted)' }}>{customer.phone || 'لا توجد تفاصيل اتصال'}</div>

                                        <div className="text-xs mb-1" style={{ color: 'var(--value-muted)' }}>الرصيد النهائي (الدين الكلي)</div>
                                        <div className={`text-2xl font-extrabold ${Number(customer.balance) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            {formatCurrency(Number(customer.balance))}
                                        </div>
                                    </div>
                                }
                            />
                        </div>
                    </div>

                    {/* Ledger Table */}
                    <div className="bg-[var(--bg-card)] rounded-[var(--border-radius-card)] shadow-card border border-[var(--border-color)] overflow-hidden">
                        <div className="overflow-x-auto">
                        <table className="w-full text-right text-sm data-table">
                            <thead className="bg-gray-50/50 border-b border-[var(--border-color)]">
                                <tr>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">التاريخ</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">المدقق (التفاصيل)</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center text-red-700">مدين (عليه)</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center text-green-700">دائن (إله)</th>
                                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-left">الرصيد التراكمي</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {displayEntries.length === 0 ? (
                                    <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">لا توجد حركات سابقة لهذا العميل.</td></tr>
                                ) : (
                                    displayEntries.map((entry, idx) => (
                                        <tr key={idx} className="hover:bg-blue-50/50 transition-colors group">
                                            <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                                                {new Date(entry.date).toLocaleDateString('ar-IQ')} <br />
                                                <span className="text-xs text-gray-400">{new Date(entry.date).toLocaleTimeString('ar-IQ')}</span>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-gray-800">
                                                {entry.note}
                                            </td>
                                            <td className="px-6 py-4 text-center text-red-600 font-bold">
                                                {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-center text-green-600 font-bold">
                                                {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-left font-bold bg-gray-50/50">
                                                <span dir="ltr">{formatCurrency(entry.balance)}</span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            <tfoot className="bg-gray-800 text-white font-bold">
                                <tr>
                                    <td colSpan={2} className="px-6 py-4">الإجماليات الكلية</td>
                                    <td className="px-6 py-4 text-center text-red-300">
                                        {formatCurrency(ledgerEntries.reduce((s, i) => s + i.debit, 0))}
                                    </td>
                                    <td className="px-6 py-4 text-center text-green-300">
                                        {formatCurrency(ledgerEntries.reduce((s, i) => s + i.credit, 0))}
                                    </td>
                                    <td className="px-6 py-4 text-left text-xl">
                                        صافي: <span dir="ltr">{formatCurrency(Number(customer.balance))}</span>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                        </div>
                    </div>

                    {/* Print Footer */}
                    <div className="mt-12 pt-6 border-t border-gray-200 flex justify-between items-end no-print opacity-0 print:opacity-100 print:flex">
                        <div className="text-sm text-gray-500">
                            <p>طُبع بواسطة نظام الإدارة</p>
                            <p>Powered by Albayan ERP</p>
                        </div>
                        <div className="text-center w-48 border-t border-gray-900 pt-2 font-bold text-gray-800">
                            توقيع المحاسب
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
