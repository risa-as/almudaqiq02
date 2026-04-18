export function exportToCSV(filename: string, headers: string[], rows: any[][]) {
    // Add BOM for Excel UTF-8 Arabic support
    const BOM = '\uFEFF';

    // Convert headers to CSV string
    const headerString = headers.join(',') + '\n';

    // Convert rows to CSV string
    const rowString = rows.map(row => {
        return row.map(cell => {
            // Escape quotes and wrap in quotes if there's a comma
            let cellString = cell === null || cell === undefined ? '' : String(cell);
            if (cellString.includes(',') || cellString.includes('"') || cellString.includes('\n')) {
                cellString = '"' + cellString.replace(/"/g, '""') + '"';
            }
            return cellString;
        }).join(',');
    }).join('\n');

    const csvContent = BOM + headerString + rowString;

    // Create Blob and Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
