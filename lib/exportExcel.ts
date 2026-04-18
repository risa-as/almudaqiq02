export function exportToCSV(data: any[], filename: string, columnHeaders?: Record<string, string>) {
    if (!data || !data.length) {
        alert("لا توجد بيانات للتصدير");
        return;
    }

    // Get raw headers from keys
    const rawHeaders = Object.keys(data[0]);

    // Map headers if provided, else use raw
    const headerRow = rawHeaders.map(h => columnHeaders ? (columnHeaders[h] || h) : h);

    // Convert to CSV string, handling quotes, commas, and formatting
    const csvContent = [
        headerRow.map(h => `"${h}"`).join(','),
        ...data.map(row =>
            rawHeaders.map(header => {
                let cell = row[header] === null || row[header] === undefined ? '' : row[header];
                if (typeof cell === 'string') {
                    cell = cell.replace(/"/g, '""'); // Escape inner quotes
                    cell = `"${cell}"`; // Wrap in quotes
                } else if (typeof cell === 'number') {
                    cell = `"${cell}"`; // Also quote numbers to prevent excel parsing issues with long IDs
                }
                return cell;
            }).join(',')
        )
    ].join('\n');

    // Add BOM for Excel UTF-8 Arabic support
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
