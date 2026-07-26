'use client';

import { useQuery } from '@tanstack/react-query';
import { authMeQueryOptions, type MeResponse, type Role } from '@/lib/query/auth-me';

/**
 * هوية المستخدم الحالي — مكاشة عبر React Query بمفتاح واحد ['auth','me']
 * مشترك مع BranchContext وFeatureContext، فلا يتكرر طلب /api/auth/me.
 */
export function useUser() {
    const q = useQuery<MeResponse>(authMeQueryOptions);

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
