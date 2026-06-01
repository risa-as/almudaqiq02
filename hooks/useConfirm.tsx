'use client';

import { useState, useCallback } from 'react';
import { ConfirmDialog, ConfirmVariant } from '@/components/ui/ConfirmDialog';
import React from 'react';

export interface ConfirmOptions {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: ConfirmVariant;
}

export function useConfirm() {
    const [state, setState] = useState<{
        options: ConfirmOptions;
        resolve: (v: boolean) => void;
    } | null>(null);

    const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            setState({ options, resolve });
        });
    }, []);

    const dialog = state ? (
        <ConfirmDialog
            open
            {...state.options}
            onConfirm={() => { state.resolve(true);  setState(null); }}
            onCancel={()  => { state.resolve(false); setState(null); }}
        />
    ) : null;

    return { confirm, dialog };
}
