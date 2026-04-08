import React from 'react';

interface SkeletonProps {
    className?: string;
    style?: React.CSSProperties;
}

/** Single skeleton line */
export function Skeleton({ className = '', style }: SkeletonProps) {
    return <div className={`skeleton ${className}`} style={style} />;
}

/** Stats cards skeleton row */
export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
    return (
        <div className={`grid grid-cols-2 lg:grid-cols-${count} gap-4 mb-6`}>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="stat-card flex items-start gap-4">
                    <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-2.5 w-16" />
                    </div>
                </div>
            ))}
        </div>
    );
}

/** Table skeleton */
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
    return (
        <div
            className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid var(--border-color)', background: 'white' }}
        >
            {/* Header */}
            <div className="flex gap-4 px-5 py-3.5"
                style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)', borderBottom: '2px solid var(--border-color)' }}>
                {Array.from({ length: cols }).map((_, i) => (
                    <Skeleton key={i} className="h-3" style={{ flex: i === 0 ? 2 : 1 }} />
                ))}
            </div>
            {/* Rows */}
            {Array.from({ length: rows }).map((_, r) => (
                <div key={r} className="flex gap-4 px-5 py-4"
                    style={{ borderTop: '1px solid var(--border-light)' }}>
                    {Array.from({ length: cols }).map((_, c) => (
                        <Skeleton key={c} className="h-4" style={{ flex: c === 0 ? 2 : 1 }} />
                    ))}
                </div>
            ))}
        </div>
    );
}

/** Full page loading skeleton */
export default function LoadingSkeleton() {
    return (
        <div className="p-6 space-y-6 animate-fade-in">
            {/* Page header skeleton */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Skeleton className="w-12 h-12 rounded-2xl" />
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="h-3 w-28" />
                    </div>
                </div>
                <Skeleton className="h-10 w-32 rounded-xl" />
            </div>
            <StatCardsSkeleton />
            <TableSkeleton />
        </div>
    );
}
