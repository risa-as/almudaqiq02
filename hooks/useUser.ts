'use client';

import { useState, useEffect } from 'react';

export function useUser() {
    const [role,    setRole]    = useState<'SUPER_ADMIN' | 'ADMIN' | 'BRANCH_MANAGER' | 'CASHIER' | 'STOCK_KEEPER' | null>(null);
    const [username, setUsername] = useState<string | null>(null);
    const [loading,  setLoading]  = useState(true);

    useEffect(() => {
        fetch('/api/auth/me')
            .then(r => r.ok ? r.json() : { user: null })
            .then(data => {
                if (data?.user) {
                    setRole(data.user.role || 'CASHIER');
                    setUsername(data.user.username);
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    return {
        role,
        username,
        loading,
        isAdmin: role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'BRANCH_MANAGER',
    };
}
