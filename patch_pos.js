const fs = require('fs');

let content = fs.readFileSync('app/pos/page.tsx', 'utf8');

// 1. Add import
if (!content.includes(`import { useBranch }`)) {
    content = content.replace(
        `import toast from 'react-hot-toast';`,
        `import toast from 'react-hot-toast';\nimport { useBranch, BranchProvider } from '@/contexts/BranchContext';`
    );
}

// 2. Add useBranch hook
if (!content.includes('const { selectedBranch, branches, setSelectedBranch, isOwner } = useBranch();')) {
    content = content.replace(
        `export default function POSPage() {`,
        `export default function POSPage() {\n    const { selectedBranch, branches, setSelectedBranch, isOwner, loading: branchLoading } = useBranch();`
    );
}

// 3. Helper for branch param
if (!content.includes('const branchQuery = selectedBranch?.id')) {
    content = content.replace(
        `// --- Fetch Offers, Categories & Shift ---`,
        `// --- Fetch Offers, Categories & Shift ---\n    const branchQuery = selectedBranch?.id && selectedBranch.id !== 'all' ? \`?branchId=\${selectedBranch.id}\` : '';\n    const branchQueryAmp = selectedBranch?.id && selectedBranch.id !== 'all' ? \`&branchId=\${selectedBranch.id}\` : '';`
    );
}

// 4. Update GET Fetches
content = content.replace(/fetch\('\/api\/shifts'\)/g, "fetch(`/api/shifts${branchQuery}`)");
content = content.replace(/fetch\('\/api\/offers\?active=true'\)/g, "fetch(`/api/offers?active=true${branchQueryAmp}`)");
content = content.replace(/fetch\('\/api\/categories'\)/g, "fetch(`/api/categories${branchQuery}`)");
content = content.replace(/let url = \`\/api\/products\`\;/g, "let url = `/api/products${branchQuery}`;");
content = content.replace(/url = \`\/api\/products\/search\?q=\$\{searchQuery\}\`\;/g, "url = `/api/products/search?q=${searchQuery}${branchQueryAmp}`;");
content = content.replace(/fetch\(\`\/api\/products\/search\?q=\$\{searchCode\}\`\)/g, "fetch(`/api/products/search?q=${searchCode}${branchQueryAmp}`)");
content = content.replace(/fetch\(\`\/api\/products\/search\?q=\$\{code\}\`\)/g, "fetch(`/api/products/search?q=${code}${branchQueryAmp}`)");
content = content.replace(/fetch\(\`\/api\/customers\/search\?q=\$\{search\}\`\)/g, "fetch(`/api/customers/search?q=${search}${branchQueryAmp}`)");

// 5. Update POST Fetches mapping body
content = content.replace(
    /body: JSON\.stringify\(\{ openingAmount: Number\(openingAmount\) \}\)/g,
    "body: JSON.stringify({ openingAmount: Number(openingAmount), branchId: selectedBranch?.id })"
);

content = content.replace(
    /body: JSON\.stringify\(\{ closingAmount: Number\(closingAmount\), notes: closingNotes \}\)/g,
    "body: JSON.stringify({ closingAmount: Number(closingAmount), notes: closingNotes, branchId: selectedBranch?.id })"
);

content = content.replace(
    /body: JSON\.stringify\(\{ items, totalAmount, shiftId: activeShift\?.id \}\)/g,
    "body: JSON.stringify({ items, totalAmount, shiftId: activeShift?.id, branchId: selectedBranch?.id })"
);

content = content.replace(
    /body: JSON\.stringify\(\{ items, totalAmount, shiftId: activeShift\?.id, customerId: selectedCustomerId, isCredit \}\)/g,
    "body: JSON.stringify({ items, totalAmount, shiftId: activeShift?.id, customerId: selectedCustomerId, isCredit, branchId: selectedBranch?.id })"
);

content = content.replace(
    /body: JSON\.stringify\(\{ transactionId: refundTx\.id, items: itemsToRefund, notes: reason \}\)/g,
    "body: JSON.stringify({ transactionId: refundTx.id, items: itemsToRefund, notes: reason, branchId: selectedBranch?.id })"
);

// 6. Dependencies for effects
content = content.replace(
    `    }, []); // Empty dep array for shift/category load`,
    `    }, [selectedBranch]);`
);
content = content.replace(
    `    }, []);\n\n    // --- Keyboard Shortcuts ---`,
    `    }, [selectedBranch]);\n\n    // --- Keyboard Shortcuts ---`
);
// Fix the empty dependency arrays for the first effect
content = content.replace(
    /fetch\('\/api\/categories\$.*catch\(console\.error\);\n    \}, \[\]\);/g,
    match => match.replace("}, []);", "}, [selectedBranch]);")
);

// 7. Inject Branch Selector in the Top Bar (next to Settings button)
const topBarSettingsBtnStr = `<button onClick={() => router.push('/settings')} className="bg-gray-100 p-2.5 rounded-xl text-gray-700 hover:bg-gray-200 transition-colors">`;
const branchSelectorHtml = `
                        {isOwner && branches.length > 1 && (
                            <div className="relative mr-2 w-48">
                                <select 
                                    value={selectedBranch?.id || 'all'}
                                    onChange={e => {
                                        const b = branches.find(x => x.id === e.target.value);
                                        if (b) setSelectedBranch(b);
                                        else if (e.target.value === 'all') setSelectedBranch({ id: 'all', name: 'جميع الفروع' });
                                    }}
                                    className="w-full appearance-none bg-blue-50 border border-blue-200 text-blue-800 text-sm font-bold rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="all">-- كل الفروع --</option>
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
`;
if (!content.includes('branches.map(b =>')) {
    content = content.replace(topBarSettingsBtnStr, branchSelectorHtml + '\n                        ' + topBarSettingsBtnStr);
}

// 8. Add a loading state block
if (!content.includes('جاري تحميل بيانات الفرع')) {
    content = content.replace(
        `return (\n        <div className="flex h-screen bg-gray-50 font-sans" dir="rtl">\n            <style>`,
        `return (\n        <div className="flex h-screen bg-gray-50 font-sans" dir="rtl">\n            <style>{ \`\n                .pos-loading-overlay { position: fixed; inset: 0; background: rgba(255,255,255,0.8); z-index: 9999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); }\n            \` }</style>\n            {branchLoading && <div className="pos-loading-overlay"><div className="text-xl font-bold text-blue-600 animate-pulse">جاري البدء وتهيئة بيانات الفرع...</div></div>}\n            <style>`
    );
}


fs.writeFileSync('app/pos/page.tsx', content);
console.log('POS successfully patched with useBranch context.');
