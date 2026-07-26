'use client';

import { useQuery } from '@tanstack/react-query';

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'BRANCH_MANAGER' | 'CASHIER' | 'STOCK_KEEPER';

interface MeResponse {
    user: { role?: Role | null; username?: string | null } | null;
    isElectron?: boolean;
}

/**
 * هوية المستخدم الحالي — مكاشة عبر React Query بمفتاح واحد ['auth','me']
 * فلا يتكرر طلب /api/auth/me مع كل صفحة؛ إعادة التحميل العميق تجلبها من جديد.
 */
export function useUser() {
    const q = useQuery<MeResponse>({
        queryKey: ['auth', 'me'],
        queryFn: async () => {
            const r = await fetch('/api/auth/me');
            if (!r.ok) return { user: null, isElectron: false };
            return r.json();
        },
    });

    const role: Role | null = q.data?.user ? (q.data.user.role ?? 'CASHIER') : null;
    const username = q.data?.user?.username ?? null;

    return {
        role,
        username,
        loading: q.isPending,
        isElectron: q.data?.isElectron === true,
        isAdmin: role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'BRANCH_MANAGER',
    };
}
