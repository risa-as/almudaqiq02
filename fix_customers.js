const fs = require('fs');
let code = fs.readFileSync('app/(tenant)/sales/customers/page.tsx', 'utf8');

if (!code.includes('isSubmitting')) {
    code = code.replace(/const \[loading,\s*setLoading\]\s*=\s*useState\(true\);/, "const [loading, setLoading] = useState(true);\n    const [isSubmitting, setIsSubmitting] = useState(false);");
    
    code = code.replace(/const handleSubmit = async \(e: React\.FormEvent\) => {\s+e\.preventDefault\(\);\s+try {/, "const handleSubmit = async (e: React.FormEvent) => {\n        e.preventDefault();\n        setIsSubmitting(true);\n        try {");
    
    code = code.replace(/toast\.error\('حدث خطأ أثناء الحفظ'\);\s+}\s+};/, "toast.error('حدث خطأ أثناء الحفظ');\n        } finally {\n            setIsSubmitting(false);\n        }\n    };");
}

if (!code.includes('isPaying')) {
    code = code.replace(/const \[paymentAmount,\s*setPaymentAmount\]\s*=\s*useState\(''\);/, "const [paymentAmount, setPaymentAmount] = useState('');\n    const [isPaying, setIsPaying] = useState(false);");
    
    code = code.replace(/if \(\!confirm\(`تأكيد استلام مبلغ(.*?)return;\s+try {/, "if (!confirm(`تأكيد استلام مبلغ$1return;\n\n        setIsPaying(true);\n        try {");
    
    code = code.replace(/toast\.error\('حدث خطأ'\);\s+}\s+};/, "toast.error('حدث خطأ');\n        } finally {\n            setIsPaying(false);\n        }\n    };");
}

fs.writeFileSync('app/(tenant)/sales/customers/page.tsx', code);
console.log('Done mapping customer states');
