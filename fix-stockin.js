const fs = require('fs');

let code = fs.readFileSync('app/(tenant)/inventory/stock-in/page.tsx', 'utf8');

const brokenTarget = `    const handleUnitChange = (unitId: string) => {
                        <label className="block text-lg font-bold text-gray-700 mb-4">ابحث عن المنتج لإضافته</label>`;

const fix = `    const handleUnitChange = (unitId: string) => {
        setSelectedUnitId(unitId);
        if (selectedProduct) {
            const unit = selectedProduct.units.find(u => u.id === unitId);
            if (unit) {
                setCostPrice(String(selectedProduct.costPrice * unit.conversionFactor));
            }
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProduct || !selectedUnitId || !quantity) return;

        // For admins viewing "all branches", we need a specific branch
        if (isOwner && selectedBranch?.id === 'all' && branches.length > 1) {
            toast.error('يرجى تحديد فرع معين من القائمة في الشريط الجانبي لإضافة المخزون.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/inventory/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productId: selectedProduct.id,
                    unitId: selectedUnitId,
                    quantity: Number(quantity),
                    costPrice: Number(costPrice),
                    expiryDate: expiryDate || null,
                    batchNumber: batchNumber || null,
                    supplierId: supplierId || null,
                    paidAmount: paidAmount || null,
                    branchId: selectedBranch?.id !== 'all' ? selectedBranch?.id : (branches.length === 1 ? branches[0].id : undefined),
                })
            });

            if (!res.ok) throw new Error('Failed');

            toast.success('تمت إضافة المخزون بنجاح!');
            router.push('/inventory');
        } catch (err) {
            toast.error('فشل حفظ المخزون. تأكد من البيانات.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8" dir="rtl">
            <div className="max-w-3xl mx-auto">

                <h1 className="text-2xl font-extrabold text-gray-900 mb-8 flex items-center gap-3">
                    <Package className="text-blue-600" size={32} />
                    إدخال مخزون جديد (توريد)
                </h1>

                {/* Branch warning for admins in 'all' mode */}
                {isOwner && selectedBranch?.id === 'all' && branches.length > 1 && (
                    <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
                        <AlertTriangle className="text-amber-500 shrink-0" size={20} />
                        <p className="text-amber-800 text-sm font-bold">
                            أنت تعرض جميع الفروع. يرجى تحديد فرع معين من القائمة في الشريط الجانبي لإضافة مخزون.
                        </p>
                    </div>
                )}

                {/* Step 1: Search Product */}
                {!selectedProduct ? (
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                        <label className="block text-lg font-bold text-gray-700 mb-4">ابحث عن المنتج لإضافته</label>`;

if (code.includes(brokenTarget)) {
    code = code.replace(brokenTarget, fix);
    fs.writeFileSync('app/(tenant)/inventory/stock-in/page.tsx', code);
    console.log('Fixed successfully');
} else {
    console.log('Target not found in file');
}
