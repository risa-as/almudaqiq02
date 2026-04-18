const fs = require('fs');
let content = fs.readFileSync('app/pos/page.tsx', 'utf8');

// 1. Add Clock to lucide-react imports if not there
if (content.includes('lucide-react') && !content.includes('Clock')) {
    content = content.replace(
        'import {',
        'import {\n    Clock,'
    );
}

// 2. Add the formatShiftDuration function
const timerFunc = `
    const formatShiftDuration = () => {
        if (!activeShift?.openedAt || !currentTime) return '00:00:00';
        const start = new Date(activeShift.openedAt).getTime();
        const now = currentTime.getTime();
        const diff = Math.floor((now - start) / 1000);
        if (diff < 0) return '00:00:00';
        const h = Math.floor(diff / 3600).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        return \`\${h}:\${m}:\${s}\`;
    };
`;
if (!content.includes('formatShiftDuration')) {
    content = content.replace(
        '// --- Fetch Offers, Categories & Shift ---',
        timerFunc + '\n    // --- Fetch Offers, Categories & Shift ---'
    );
}

// 3. Inject the UI next to activeShift buttons
const targetUI = `{activeShift && (
                        <>
                            <button`;
const replacementUI = `{activeShift && (
                        <>
                            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm" title="مدة الوردية الكلية">
                                <Clock size={16} className="animate-pulse opacity-80" />
                                <span className="tracking-wider" dir="ltr">{formatShiftDuration()}</span>
                            </div>
                            <button`;

if (!content.includes('formatShiftDuration()')) {
    content = content.replace(targetUI, replacementUI);
}

fs.writeFileSync('app/pos/page.tsx', content);
console.log('Timer injected successfully.');
