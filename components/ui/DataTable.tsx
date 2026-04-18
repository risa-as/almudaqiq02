import React from 'react';

interface Column<T> {
    key: string;
    header: string;
    render?: (row: T) => React.ReactNode;
    align?: 'left' | 'center' | 'right';
}

interface DataTableProps<T> {
    data: T[];
    columns: Column<T>[];
    emptyMessage?: string;
    onRowClick?: (row: T) => void;
}

/**
 * Unified data table component.
 * Uses CSS variables for consistent padding, colors, headers, and hover effects.
 */
export default function DataTable<T extends { id?: string | number }>({
    data,
    columns,
    emptyMessage = 'لا توجد بيانات متاحة',
    onRowClick
}: DataTableProps<T>) {
    return (
        <div className="bg-white rounded-[var(--border-radius-card)] shadow-card border border-[var(--border-color)] overflow-hidden">
            <div className="overflow-x-auto">
                <table className="data-table">
                    <thead>
                        <tr>
                            {columns.map((col, idx) => (
                                <th
                                    key={col.key || idx}
                                    style={{ textAlign: col.align || 'right' }}
                                >
                                    {col.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-color)]">
                        {data.length > 0 ? (
                            data.map((row, idx) => (
                                <tr
                                    key={row.id || idx}
                                    onClick={() => onRowClick && onRowClick(row)}
                                    style={{ cursor: onRowClick ? 'pointer' : 'default' }}
                                >
                                    {columns.map((col, cIdx) => (
                                        <td
                                            key={col.key || cIdx}
                                            style={{ textAlign: col.align || 'right' }}
                                        >
                                            {col.render ? col.render(row) : (row as any)[col.key]}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={columns.length} className="text-center py-12 text-[var(--value-muted)] font-bold">
                                    {emptyMessage}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
