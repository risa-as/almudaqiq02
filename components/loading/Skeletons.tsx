import React from 'react';

export function CardSkeleton() {
  return (
    <div className="stat-card flex items-center justify-between p-6 animate-pulse">
      <div>
        <div className="h-4 w-24 bg-secondary-light rounded mb-4" />
        <div className="h-8 w-16 bg-secondary-light rounded" />
      </div>
      <div className="w-[52px] h-[52px] rounded-xl bg-secondary-light" />
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="w-full bg-card rounded-2xl shadow-sm border border-border overflow-hidden animate-pulse">
      {/* Table Header Skeleton */}
      <div className="bg-table-header-bg p-4 flex gap-4 border-b border-border">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={`th-${i}`} className="h-4 bg-secondary-light rounded flex-1" />
        ))}
      </div>
      
      {/* Table Rows Skeleton */}
      <div className="flex flex-col">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={`tr-${rowIndex}`} className="p-4 flex gap-4 border-b border-border last:border-0 items-center">
             {Array.from({ length: columns }).map((_, colIndex) => (
              <div 
                key={`td-${rowIndex}-${colIndex}`} 
                className={`h-4 bg-secondary-light rounded ${colIndex === 0 ? 'w-1/4' : 'flex-1'}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
