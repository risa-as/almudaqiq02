export function formatCurrency(amount: number): string {
    // IQD is usually integer or 2 decimals? 
    // Usually for POS in IQD, decimals are rare unless dealing with cents which IQD doesn't really use in practice anymore (250, 500, 1000).
    // However, for precise costing we might keep decimals internally, but display nicely.
    return new Intl.NumberFormat('en-US', {
        style: 'decimal',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount) + ' د.ع';
}
