'use client';

import React from 'react';
import { Printer } from 'lucide-react';

export default function PrintButton() {
    return (
        <button
            onClick={() => window.print()}
            className="btn-primary"
        >
            <Printer size={18} /> طباعة كشف الحساب
        </button>
    );
}
