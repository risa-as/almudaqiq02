const fs = require('fs');
let content = fs.readFileSync('app/pos/page.tsx', 'utf8');

const target1 = `    const handleOpenShift = async () => {\r\n        if (!openingAmount) { toast('أدخل مبلغ العهدة الافتتاحي'); return; }\r\n        try {`;
const target2 = `    const handleOpenShift = async () => {\n        if (!openingAmount) { toast('أدخل مبلغ العهدة الافتتاحي'); return; }\n        try {`;

const replacement = `    const handleOpenShift = async () => {\n        if (!openingAmount) { toast('أدخل مبلغ العهدة الافتتاحي'); return; }\n        if (!selectedBranch || selectedBranch.id === 'all') { toast.error('لفتح وردية، يجب اختيار فرع محدد من الشريط العلوي (لا يمكن فتح وردية لكل الفروع)'); return; }\n        try {`;

if (content.includes(target1)) {
    content = content.replace(target1, replacement);
} else if (content.includes(target2)) {
    content = content.replace(target2, replacement);
} else {
    // Fallback if neither exact match
    content = content.replace(
        /const handleOpenShift = async \(\) => \{\s*if \(\!openingAmount\) \{ toast\('أدخل مبلغ العهدة الافتتاحي'\); return; \}\s*try \{/,
        replacement
    );
}

fs.writeFileSync('app/pos/page.tsx', content);
console.log('Patched');
