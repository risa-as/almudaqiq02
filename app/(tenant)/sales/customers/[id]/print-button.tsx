'use client';

import React from 'react';
import { Printer } from 'lucide-react';

export default function PrintButton() {
    return (
        <button
            onClick={() => window.print()}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 shadow-md transition-colors"
        >
            <Printer size={18} /> طباعة كشف الحساب
        </button>
    );
}
