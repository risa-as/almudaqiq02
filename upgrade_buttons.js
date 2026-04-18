const fs = require('fs');
const path = require('path');

function walk(dir) {
    let files = [];
    for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) files = files.concat(walk(p));
        else if (f.endsWith('.tsx')) files.push(p);
    }
    return files;
}

const files = walk('app');
files.forEach(file => {
    let code = fs.readFileSync(file, 'utf8');
    let dirty = false;

    // determine loading state variable
    let loadingVar = null;
    if (code.includes('const [loading,')) loadingVar = 'loading';
    else if (code.includes('loading}')) loadingVar = 'loading';
    else if (code.includes('const [isSubmitting')) loadingVar = 'isSubmitting';
    else if (code.includes('const [saving')) loadingVar = 'saving';
    else if (code.includes('const [isSaving')) loadingVar = 'isSaving';
    else if (code.match(/\[loading/i)) loadingVar = 'loading';

    if (loadingVar) {
        code = code.replace(/<button([^>]*)>([\s\S]*?)(إضافة|حفظ)(?![\s\S]*?جاري)([\s\S]*?)<\/button>/g, (match, attrs, pre, text, post) => {
             if (!attrs.includes('disabled') && !match.includes('onClick')) {
                dirty = true;
                const newAttrs = attrs + ` disabled={${loadingVar}}`;
                
                // Keep the icon (pre/post) but replace text with state
                let replacementText = `{${loadingVar} ? 'جاري ${text === 'إضافة' ? 'الإضافة...' : 'الحفظ...'}' : '${text}'}`;
                
                return `<button${newAttrs}>${pre}${replacementText}${post}</button>`;
             }
             return match;
        });
    }

    if (dirty) {
        fs.writeFileSync(file, code);
        console.log('Upgraded buttons in ' + file);
    }
});
