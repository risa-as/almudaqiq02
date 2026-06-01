import React from 'react';
import { Loader2 } from 'lucide-react';

export default function Loading() {
    return (
        <div className="w-full h-full min-h-[60vh] flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
            <h3 className="text-xl font-bold text-gray-700">جاري التحميل...</h3>
            <p className="text-gray-500 text-sm">يرجى الانتظار بينما نقوم بجلب البيانات</p>
        </div>
    );
}
