'use client';

import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Printer, Database, Save, ShieldCheck, Users, UserPlus, Trash2, Crown } from 'lucide-react';
import { useUser } from '@/hooks/useUser';
import { ROLE_LABELS, canManage } from '@/lib/roles';

import toast from 'react-hot-toast';
interface User {
    id: number;
    email: string;
    role: string;
    createdAt: string;
}

export default function SettingsPage() {
    const { role: myRole } = useUser();
    const isSuperAdmin = myRole === 'SUPER_ADMIN';

    const [activeTab, setActiveTab] = useState<'system' | 'users'>('system');

    // System Settings State
    const [printerName, setPrinterName] = useState('');
    const [autoPrint, setAutoPrint] = useState(false);
    const [taxRate, setTaxRate] = useState(0);

    const [storeName, setStoreName] = useState('البيان ميني ماركت');
    const [storePhone, setStorePhone] = useState('رقم الهاتف: 07XX XXX XXXX');
    const [storeAddress, setStoreAddress] = useState('العنوان: العراق');
    const [footerMessage, setFooterMessage] = useState('البضاعة المباعة لا ترد ولا تستبدل بعد 3 أيام');
    const [savingSettings, setSavingSettings] = useState(false);

    // User Management State
    const [users, setUsers] = useState<User[]>([]);
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState('CASHIER');
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [addingUser, setAddingUser] = useState(false);

    // Load settings from DB + localStorage on mount
    useEffect(() => {
        // Load printer and tax from localStorage (device-specific settings)
        const savedPrinter = localStorage.getItem('printerName');
        const savedTax = localStorage.getItem('taxRate');
        if (savedPrinter) setPrinterName(savedPrinter);
        if (savedTax) setTaxRate(Number(savedTax));

        // Load store settings from DB
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                if (data && !data.error) {
                    if (data.storeName) setStoreName(data.storeName);
                    if (data.storePhone) setStorePhone(data.storePhone || '');
                    if (data.storeAddress) setStoreAddress(data.storeAddress || '');
                    if (data.footerMessage) setFooterMessage(data.footerMessage || '');
                    setAutoPrint(data.autoPrint ?? false);
                }
            })
            .catch(console.error);

        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
            const res = await fetch('/api/users');
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleSaveSettings = async () => {
        setSavingSettings(true);
        try {
            // Save device-specific settings to localStorage
            localStorage.setItem('printerName', printerName);
            localStorage.setItem('taxRate', String(taxRate));

            // Save store settings to DB
            const res = await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ storeName, storePhone, storeAddress, footerMessage, autoPrint })
            });

            if (res.ok) {
                toast.success('تم حفظ إعدادات النظام بنجاح! ✅');
            } else {
                toast.error('❌ فشل حفظ الإعدادات في قاعدة البيانات');
            }
        } catch (error) {
            toast.error('❌ حدث خطأ أثناء الحفظ');
        } finally {
            setSavingSettings(false);
        }
    };

    const handleBackup = async () => {
        try {
            const res = await fetch('/api/settings/backup', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                toast.success(`✅ ${data.message}\nتم حفظ الملف: ${data.file}\nفي المسار: ${data.location}`);
            } else {
                toast(`❌ ${data.error}`);
            }
        } catch (error) {
            toast.error('❌ فشل النسخ الاحتياطي');
        }
    };

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEmail || !newPassword) return;

        setAddingUser(true);
        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: newEmail, password: newPassword, role: newRole }),
            });

            if (res.ok) {
                toast.success('تم إضافة المستخدم بنجاح ✅');
                setNewEmail('');
                setNewPassword('');
                fetchUsers();
            } else {
                const data = await res.json();
                toast.error('خطأ: ' + (data.error || 'فشلت العملية'));
            }
        } catch (error) {
            toast.error('فشلت العملية');
        } finally {
            setAddingUser(false);
        }
    };

    const handleDeleteUser = async (userId: number, email: string) => {
        if (!confirm(`هل أنت متأكد من حذف المستخدم "${email}"؟ هذا الإجراء لا يمكن التراجع عنه.`)) return;
        try {
            const res = await fetch(`/api/users?id=${userId}`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok) {
                toast.success('تم حذف المستخدم بنجاح ✅');
                fetchUsers();
            } else {
                toast.error('❌ ' + (data.error || 'فشل الحذف'));
            }
        } catch (error) {
            toast.error('❌ حدث خطأ أثناء الحذف');
        }
    };

    return (
        <div className="min-h-screen p-8" dir="rtl" style={{ background: 'var(--bg-page)' }}>
            <div className="max-w-5xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-100 p-3 rounded-xl text-blue-600">
                            <SettingsIcon size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">إعدادات النظام</h1>
                            <p className="text-gray-500 mt-1">إدارة المستخدمين وسجل النظام وقاعدة البيانات</p>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 border-b border-gray-200 mb-6">
                    <button
                        onClick={() => setActiveTab('system')}
                        className={`pb-4 px-4 font-bold text-lg transition-all ${activeTab === 'system' ? 'text-blue-600 border-b-4 border-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        الإعدادات العامة
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`pb-4 px-4 font-bold text-lg transition-all ${activeTab === 'users' ? 'text-blue-600 border-b-4 border-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        إدارة المستخدمين
                    </button>
                </div>

                {/* SYSTEM TAB */}
                {activeTab === 'system' && (
                    <div className="space-y-8 animate-fade-in-up">
                        {/* Printer Settings */}
                        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-6 border-b border-gray-100 flex items-center gap-3 bg-blue-50/50">
                                <Printer className="text-blue-600" />
                                <h2 className="text-xl font-bold text-gray-800">إعدادات الطباعة</h2>
                            </div>
                            <div className="p-8 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-600 mb-2">اسم الطابعة (Printer Name)</label>
                                        <input
                                            type="text"
                                            value={printerName}
                                            onChange={(e) => setPrinterName(e.target.value)}
                                            placeholder="مثال: EPSON TM-T20"
                                            className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-black"
                                        />
                                        <p className="text-xs text-gray-400 mt-2">يجب أن يطابق اسم الطابعة في إعدادات الويندوز.</p>
                                    </div>
                                    <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700">الطباعة التلقائية</label>
                                            <p className="text-xs text-gray-500">طباعة الإيصال مباشرة بعد الدفع</p>
                                        </div>
                                        <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                                            <input
                                                type="checkbox"
                                                checked={autoPrint}
                                                onChange={(e) => setAutoPrint(e.target.checked)}
                                                className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer peer checked:right-0 right-6 transition-all duration-300 border-gray-300 checked:border-blue-600"
                                            />
                                            <div className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer peer-checked:bg-blue-600 transition-colors"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Store Info Settings */}
                        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-6 border-b border-gray-100 flex items-center gap-3 bg-purple-50/50">
                                <SettingsIcon className="text-purple-600" />
                                <h2 className="text-xl font-bold text-gray-800">معلومات الفاتورة والمتجر</h2>
                            </div>
                            <div className="p-8 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-600 mb-2">اسم المتجر</label>
                                        <input
                                            type="text"
                                            value={storeName}
                                            onChange={(e) => setStoreName(e.target.value)}
                                            className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all text-black"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-600 mb-2">رقم الهاتف</label>
                                        <input
                                            type="text"
                                            value={storePhone}
                                            onChange={(e) => setStorePhone(e.target.value)}
                                            className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all text-black"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-600 mb-2">العنوان</label>
                                        <input
                                            type="text"
                                            value={storeAddress}
                                            onChange={(e) => setStoreAddress(e.target.value)}
                                            className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all text-black"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-600 mb-2">تذييل الفاتورة (ملاحظة سفلية)</label>
                                        <input
                                            type="text"
                                            value={footerMessage}
                                            onChange={(e) => setFooterMessage(e.target.value)}
                                            className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all text-black"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Financial Settings */}
                        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-6 border-b border-gray-100 flex items-center gap-3 bg-green-50/50">
                                <ShieldCheck className="text-green-600" />
                                <h2 className="text-xl font-bold text-gray-800">الإعدادات المالية</h2>
                            </div>
                            <div className="p-8">
                                <div className="max-w-xs">
                                    <label className="block text-sm font-bold text-gray-600 mb-2">نسبة الضريبة (%)</label>
                                    <input
                                        type="number"
                                        value={taxRate}
                                        onChange={(e) => setTaxRate(Number(e.target.value))}
                                        className="w-full bg-gray-50 border border-gray-200 p-4 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition-all font-bold text-lg text-black"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Database Settings */}
                        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-6 border-b border-gray-100 flex items-center gap-3 bg-indigo-50/50">
                                <Database className="text-indigo-600" />
                                <h2 className="text-xl font-bold text-gray-800">قاعدة البيانات</h2>
                            </div>
                            <div className="p-8">
                                <p className="text-sm text-gray-500 mb-4">إنشاء نسخة احتياطية محلية من جميع البيانات الحالية (المبيعات، المنتجات، العملاء، الإعدادات).</p>
                                <button
                                    onClick={handleBackup}
                                    className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-md hover:bg-indigo-700 transition-colors flex items-center gap-2"
                                >
                                    <Save size={20} />
                                    إنشاء نسخة احتياطية الآن
                                </button>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <button
                                onClick={handleSaveSettings}
                                disabled={savingSettings}
                                className="bg-blue-600 text-white px-8 py-4 rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 hover:shadow-xl hover:-translate-y-1 transition-all flex items-center gap-2 text-lg disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                <Save size={24} />
                                {savingSettings ? 'جاري الحفظ...' : 'حفظ الإعدادات العامة'}
                            </button>
                        </div>
                    </div>
                )}

                {/* USERS TAB */}
                {activeTab === 'users' && (
                    <div className="space-y-8 animate-fade-in-up">

                        {/* Add User Form */}
                        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-6 border-b border-gray-100 flex items-center gap-3 bg-indigo-50/50">
                                <UserPlus className="text-indigo-600" />
                                <h2 className="text-xl font-bold text-gray-800">إضافة مستخدم جديد</h2>
                            </div>
                            <div className="p-8">
                                <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                    <div className="md:col-span-1">
                                        <label className="block text-sm font-bold text-gray-600 mb-2">البريد الإلكتروني</label>
                                        <input
                                            required
                                            type="email"
                                            value={newEmail}
                                            onChange={(e) => setNewEmail(e.target.value)}
                                            placeholder="user@example.com"
                                            className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-black"
                                        />
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="block text-sm font-bold text-gray-600 mb-2">كلمة المرور</label>
                                        <input
                                            required
                                            type="password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-black"
                                        />
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="block text-sm font-bold text-gray-600 mb-2">الدور (Role)</label>
                                        <select
                                            value={newRole}
                                            onChange={(e) => setNewRole(e.target.value)}
                                            className="w-full bg-gray-50 border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-black"
                                        >
                                            <option value="CASHIER">كاشير</option>
                                            <option value="STOCK_KEEPER">أمين مخزن</option>
                                            <option value="BRANCH_MANAGER">مدير فرع</option>
                                            <option value="ADMIN">مدير</option>
                                            {isSuperAdmin && <option value="SUPER_ADMIN">سوبر أدمن</option>}
                                        </select>
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={addingUser}
                                        className="bg-indigo-600 text-white p-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200 disabled:opacity-50"
                                    >
                                        {addingUser ? 'جاري الإضافة...' : 'إضافة الآن'}
                                    </button>
                                </form>
                            </div>
                        </div>

                        {/* Users List */}
                        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-6 border-b border-gray-100 flex items-center gap-3 bg-gray-50/50">
                                <Users className="text-gray-600" />
                                <h2 className="text-xl font-bold text-gray-800">قائمة المستخدمين</h2>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-right">
                                    <thead className="bg-gray-50 text-gray-500 text-sm uppercase">
                                        <tr>
                                            <th className="px-6 py-4 font-bold">#</th>
                                            <th className="px-6 py-4 font-bold">البريد الإلكتروني</th>
                                            <th className="px-6 py-4 font-bold">الدور</th>
                                            <th className="px-6 py-4 font-bold">تاريخ الإنشاء</th>
                                            <th className="px-6 py-4 font-bold text-center">إجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {loadingUsers ? (
                                            <tr><td colSpan={5} className="p-8 text-center text-gray-400">جاري التحميل...</td></tr>
                                        ) : users.length === 0 ? (
                                            <tr><td colSpan={5} className="p-8 text-center text-gray-400">لا يوجد مستخدمين</td></tr>
                                        ) : (
                                            users.map((user, idx) => (
                                                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4 text-gray-400">{idx + 1}</td>
                                                    <td className="px-6 py-4 font-bold text-gray-800">{user.email}</td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit ${(ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] || ROLE_LABELS.CASHIER).bg} ${(ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] || ROLE_LABELS.CASHIER).color}`}>
                                                            {user.role === 'SUPER_ADMIN' && <Crown size={12} />}
                                                            {(ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] || ROLE_LABELS.CASHIER).label}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-500 text-sm">
                                                        {new Date(user.createdAt).toLocaleDateString('ar-IQ')}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        {(isSuperAdmin || user.role !== 'SUPER_ADMIN') && (
                                                            <button
                                                                onClick={() => handleDeleteUser(user.id, user.email)}
                                                                className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                                                title="حذف المستخدم"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>
                )}

            </div>
        </div>
    );
}
