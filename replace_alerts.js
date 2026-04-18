const fs = require('fs');
const path = require('path');

function walk(dir) {
    let files = [];
    fs.readdirSync(dir).forEach(f => {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) files = files.concat(walk(p));
        else if (f.endsWith('.tsx') || f.endsWith('.ts')) files.push(p);
    });
    return files;
}

const files = walk('app');
let modifiedCount = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // Check if file uses alert
    if (content.includes('alert(') && !content.includes('// disable-toast-replacement')) {
        
        // Add import if missing
        if (!content.includes("from 'react-hot-toast'") && !content.includes('from "react-hot-toast"')) {
            // Find the last import
            const lastImportMatch = [...content.matchAll(/^import.*?;?\s*$/gm)].pop();
            
            if (lastImportMatch) {
                const insertPos = lastImportMatch.index + lastImportMatch[0].length;
                content = content.slice(0, insertPos) + "\nimport toast from 'react-hot-toast';" + content.slice(insertPos);
            } else if (content.includes("'use client'") || content.includes('"use client"')) {
                // Add right after use client
                content = content.replace(/(['"]use client['"];?)/, "$1\nimport toast from 'react-hot-toast';");
            } else {
                content = "import toast from 'react-hot-toast';\n" + content;
            }
        }
        
        // Replace alerts with intelligent toasts
        let newContent = content.replace(/alert\(([\s\S]*?)\);?/g, (match, msg) => {
            if (msg.includes('نجاح') || msg.includes('تم') || msg.includes('مكتمل')) {
                return `toast.success(${msg});`;
            } else if (msg.includes('خطأ') || msg.includes('فارغ') || msg.includes('فشل') || msg.includes('تحقق') || msg.includes('تأكد') || msg.includes('يرجى')) {
                return `toast.error(${msg});`;
            } else {
                return `toast(${msg});`; // default
            }
        });

        if (content !== newContent) {
            fs.writeFileSync(file, newContent);
            console.log('Updated alerts in', file);
            modifiedCount++;
        }
    }
});

console.log(`Replaced alerts in ${modifiedCount} files.`);
