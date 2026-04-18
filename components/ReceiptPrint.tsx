import React from 'react';
import { formatCurrency } from '@/lib/format';

export interface ReceiptData {
    transactionId: number | string;
    receiptNumber?: string;
    date: string;
    items: {
        name: string;
        quantity: number;
        price: number;
        unitName: string;
    }[];
    totalAmount: number;
    isCredit?: boolean;
    customerName?: string;
    cashierName?: string;
}

interface ReceiptPrintProps {
    receipt: ReceiptData;
    isPreview?: boolean;
}

export const ReceiptPrint = React.forwardRef<HTMLDivElement, ReceiptPrintProps>(
    ({ receipt, isPreview = false }, ref) => {
        const [settings, setSettings] = React.useState({
            storeName: 'البيان ميني ماركت',
            storePhone: 'رقم الهاتف: 07XX XXX XXXX',
            storeAddress: 'العنوان: العراق',
            footerMessage: 'البضاعة المباعة لا ترد ولا تستبدل بعد 3 أيام'
        });

        React.useEffect(() => {
            fetch('/api/settings')
                .then(res => res.ok ? res.json() : null)
                .then(data => {
                    if (data) {
                        setSettings({
                            storeName: data.storeName || 'المتجر',
                            storePhone: data.storePhone || '',
                            storeAddress: data.storeAddress || '',
                            footerMessage: data.footerMessage || ''
                        });
                    }
                })
                .catch(() => {});
        }, []);

        return (
            <>
                <div
                    ref={ref}
                    id="printable-receipt"
                    className={`${isPreview ? 'block w-full max-w-sm mx-auto bg-white p-4 text-black' : 'hidden print:block font-sans text-black'}`}
                    dir="rtl"
                >
                    <div className="text-center mb-4 border-b-2 border-dashed border-gray-400 pb-3">
                        <h2 className="text-2xl font-extrabold mb-1">{settings.storeName}</h2>
                        {settings.storePhone && <p className="text-sm">{settings.storePhone}</p>}
                        {settings.storeAddress && <p className="text-sm">{settings.storeAddress}</p>}
                    </div>

                    <div className="border-b-2 border-dashed border-gray-400 pb-2 mb-2 text-sm flex justify-between">
                        <div>
                            <p><span className="font-bold">قائمة رقم:</span> {receipt.receiptNumber || receipt.transactionId}</p>
                            <p><span className="font-bold">التاريخ:</span> {new Date(receipt.date).toLocaleString('ar-IQ')}</p>
                        </div>
                    </div>

                    <div className="border-b-2 border-dashed border-gray-400 pb-2 mb-2 text-sm">
                        {receipt.cashierName && <p><span className="font-bold">الكاشير:</span> {receipt.cashierName}</p>}
                        <p><span className="font-bold">العميل:</span> {receipt.customerName || 'عام (نقدي)'}</p>
                        {receipt.isCredit && <p className="font-bold bg-black text-white px-1 mt-1 inline-block">دفع آجل (دين)</p>}
                    </div>

                    <table className="w-full text-sm mb-4">
                        <thead>
                            <tr className="border-b-2 border-dashed border-gray-400 pb-1">
                                <th className="text-right py-1 w-1/2">المادة</th>
                                <th className="text-center py-1 w-1/4">العدد</th>
                                <th className="text-left py-1 w-1/4">الاجمالي</th>
                            </tr>
                        </thead>
                        <tbody className="align-top">
                            {receipt.items.map((item, idx) => (
                                <tr key={idx} className="border-b border-gray-200 last:border-0">
                                    <td className="text-right py-1.5 pr-1">
                                        <div className="font-bold">{item.name}</div>
                                        <div className="text-xs text-gray-600 font-mono">
                                            {formatCurrency(item.price)} - {item.unitName}
                                        </div>
                                    </td>
                                    <td className="text-center py-1.5 font-bold text-lg">{item.quantity}</td>
                                    <td className="text-left py-1.5 font-mono font-bold">
                                        {formatCurrency(item.price * item.quantity)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="border-t-2 border-dashed border-gray-400 pt-2 flex justify-between items-center text-xl font-extrabold mb-4">
                        <span>المجموع الكلي:</span>
                        <span className="font-mono">{formatCurrency(receipt.totalAmount)}</span>
                    </div>

                    <div className="text-center text-sm font-bold mt-4 pt-4 border-t-2 border-dashed border-gray-400">
                        <p className="mb-1 text-lg">شكراً لزيارتكم!</p>
                        {settings.footerMessage && <p className="text-xs">{settings.footerMessage}</p>}
                        <p className="text-xs mt-2">Powered by Albayan ERP</p>
                    </div>
                </div>

                <style jsx global>{`
                @media print {
                    @page { margin: 0; size: 80mm auto; }
                    body * { visibility: hidden !important; }
                    #printable-receipt, #printable-receipt * { visibility: visible !important; }
                    #printable-receipt {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 78mm;
                        margin: 0 auto;
                        padding: 2mm;
                        background: white;
                        color: black;
                    }
                }
            `}</style>
            </>
        );
    }
);

ReceiptPrint.displayName = 'ReceiptPrint';
