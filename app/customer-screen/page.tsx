'use client';

import React, { useEffect, useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

interface CartItem {
    id: string; // unique cart item id
    productId: number;
    name: string;
    unitId: number;
    unitName: string;
    price: number;
    quantity: number;
    stock: number;
}

export default function CustomerScreenPage() {
    const [cart, setCart] = useState<CartItem[]>([]);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        // Read initial state
        const savedCart = localStorage.getItem('customerScreenCart');
        if (savedCart) {
            try {
                const parsed = JSON.parse(savedCart);
                setCart(parsed.cart || []);
                setTotal(parsed.total || 0);
            } catch (e) {
                console.error(e);
            }
        }

        // Listen for updates from the main POS window
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'customerScreenCart' && e.newValue) {
                try {
                    const parsed = JSON.parse(e.newValue);
                    setCart(parsed.cart || []);
                    setTotal(parsed.total || 0);
                } catch (err) {
                    console.error('Error parsing customer cart', err);
                }
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col p-8" dir="rtl">
            {/* Header */}
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm mb-8">
                <div className="flex items-center gap-4">
                    <img
                        src="/logo.png"
                        alt="Logo"
                        className="h-20 object-contain"
                        onError={(e) => e.currentTarget.style.display = 'none'}
                    />
                    <div>
                        <h1 className="text-2xl font-extrabold text-blue-900">سوبر ماركت البيان</h1>
                        <p className="text-xl text-gray-500 mt-2">أهلاً وسهلاً بكم!</p>
                    </div>
                </div>
                <div className="bg-blue-600 text-white px-8 py-4 rounded-2xl flex items-center gap-4 shadow-lg shadow-blue-200">
                    <ShoppingCart size={40} />
                    <div>
                        <p className="text-sm opacity-80 font-medium">الإجمالي المستحق</p>
                        <p className="text-2xl font-extrabold">{formatCurrency(total)}</p>
                    </div>
                </div>
            </div>

            {/* Cart Items */}
            <div className="flex-1 bg-white rounded-3xl shadow-sm border border-gray-100 p-8 overflow-hidden flex flex-col">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-4">مشترياتك الحالية</h2>

                <div className="flex-1 overflow-y-auto pr-4">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-300 space-y-4">
                            <ShoppingCart size={80} className="opacity-20" />
                            <p className="text-2xl font-medium text-gray-400">في انتظار إضافة المشتريات...</p>
                        </div>
                    ) : (
                        <table className="w-full text-right text-lg">
                            <thead className="text-gray-400 font-bold border-b border-gray-100">
                                <tr>
                                    <th className="pb-4 w-16">م</th>
                                    <th className="pb-4">المنتج</th>
                                    <th className="pb-4 text-center">الكمية</th>
                                    <th className="pb-4">السعر</th>
                                    <th className="pb-4 font-extrabold text-gray-800">المجموع</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {cart.map((item, idx) => (
                                    <tr key={item.id} className="hover:bg-gray-50 transition-colors animate-fade-in-up" style={{ animationDelay: `${Math.min(idx, 10) * 0.05}s` }}>
                                        <td className="py-6 text-gray-400">{idx + 1}</td>
                                        <td className="py-6">
                                            <p className="font-bold text-gray-900">{item.name}</p>
                                            <p className="text-sm text-gray-500">{item.unitName}</p>
                                        </td>
                                        <td className="py-6 text-center">
                                            <span className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl font-bold text-xl">{item.quantity}</span>
                                        </td>
                                        <td className="py-6 text-gray-500">{formatCurrency(item.price)}</td>
                                        <td className="py-6 font-extrabold text-gray-900">{formatCurrency(item.price * item.quantity)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <style jsx global>{`
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-up {
                    animation: fadeInUp 0.3s ease-out forwards;
                }
            `}</style>
        </div>
    );
}
