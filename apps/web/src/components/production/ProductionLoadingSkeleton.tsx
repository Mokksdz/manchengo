'use client';

import { Skeleton, SkeletonTable } from '@/components/ui/skeleton-loader';

/**
 * Full-page loading skeleton shown while production data is being fetched.
 * Renders a header, KPI strip, and tab placeholder with a table skeleton.
 */
export function ProductionLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header skeleton */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="w-11 h-11 rounded-[14px]" />
          <div>
            <Skeleton className="h-6 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </div>
      {/* KPI strip skeleton */}
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass-card p-5">
            <Skeleton className="h-4 w-20 mb-3" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
      {/* Tab placeholder */}
      <div className="glass-card overflow-hidden">
        <div className="flex border-b border-black/[0.04] px-4 py-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-5 w-24" />
          ))}
        </div>
        <SkeletonTable rows={5} columns={4} />
      </div>
    </div>
  );
}
