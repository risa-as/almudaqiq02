'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Home } from 'lucide-react';

export default function AdminBackButton() {
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkRole = async () => {
            try {
                const res = await fetch('/api/auth/me', { cache: 'no-store' });
                if (res.ok) {
                    const data = await res.json();
                    const role = data.user?.role?.toUpperCase();
                    if (role === 'ADMIN') {
                        setIsAdmin(true);
                    }
                }
            } catch (error) {
                console.error('Failed to check role', error);
            } finally {
                setLoading(false);
            }
        };

        checkRole();
    }, []);

    if (loading || !isAdmin) return null;

    return (
        <Link
            href="/"
            className="group flex items-center gap-2 bg-white hover:bg-blue-50 text-gray-600 hover:text-blue-600 border border-gray-200 hover:border-blue-200 px-5 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-0.5"
        >
            <Home size={18} className="group-hover:scale-110 transition-transform duration-300" />
            <span className="font-bold">الرئيسية</span>
        </Link>
    );
}
