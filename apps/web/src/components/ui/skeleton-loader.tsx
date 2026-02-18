'use client';

import { cn } from '@/lib/utils';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SKELETON LOADERS — Manchengo Smart ERP
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * R11: Skeleton loaders pour remplacer les spinners
 *
 * Provides smooth loading states that match the final UI layout.
 * Better UX than spinners: reduces perceived loading time and prevents
 * layout shift (CLS improvement).
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ── Base Skeleton Block ──
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-[8px] bg-[#E5E5E5]/60',
        className,
      )}
      {...props}
    />
  );
}

// ── KPI Card Skeleton ──
export function SkeletonKpiCard() {
  return (
    <div className="rounded-[14px] border border-white/75 bg-white/72 p-5 shadow-[0_10px_24px_rgba(18,22,33,0.06),inset_0_1px_0_rgba(255,255,255,0.5)] backdrop-blur-[18px]">
      <Skeleton className="h-3 w-24 mb-3" />
      <Skeleton className="h-8 w-16 mb-2" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

// ── KPI Grid Skeleton (4 cards) ──
export function SkeletonKpiGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonKpiCard key={i} />
      ))}
    </div>
  );
}

// ── Chart Skeleton ──
export function SkeletonChart({ height = 300 }: { height?: number }) {
  return (
    <div className="rounded-[14px] border border-white/75 bg-white/72 p-5 shadow-[0_10px_24px_rgba(18,22,33,0.06),inset_0_1px_0_rgba(255,255,255,0.5)] backdrop-blur-[18px]">
      <Skeleton className="h-4 w-40 mb-4" />
      <div className="flex items-end gap-2" style={{ height }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t-[4px]"
            style={{ height: `${30 + Math.random() * 70}%` }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Table Row Skeleton ──
export function SkeletonTableRow({ columns = 5 }: { columns?: number }) {
  return (
    <div className="flex items-center gap-4 py-3 px-4 border-b border-[#F0F0F0]">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-4"
          style={{ width: `${i === 0 ? 20 : 15 + Math.random() * 20}%` }}
        />
      ))}
    </div>
  );
}

// ── Table Skeleton ──
export function SkeletonTable({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="rounded-[14px] border border-white/75 bg-white/76 overflow-hidden shadow-[0_10px_24px_rgba(18,22,33,0.06),inset_0_1px_0_rgba(255,255,255,0.5)] backdrop-blur-[18px]">
      {/* Header */}
      <div className="flex items-center gap-4 py-3 px-4 bg-white/65 border-b border-white/70">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3" style={{ width: `${15 + Math.random() * 15}%` }} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow key={i} columns={columns} />
      ))}
    </div>
  );
}

// ── Alert Card Skeleton ──
export function SkeletonAlertCard() {
  return (
    <div className="rounded-[12px] border border-white/75 bg-white/72 p-4 flex items-start gap-3 shadow-[0_8px_20px_rgba(18,22,33,0.06),inset_0_1px_0_rgba(255,255,255,0.5)] backdrop-blur-[16px]">
      <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
      <div className="flex-1">
        <Skeleton className="h-4 w-48 mb-2" />
        <Skeleton className="h-3 w-64 mb-2" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

// ── Dashboard Page Skeleton (full page) ──
export function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      {/* Title */}
      <Skeleton className="h-7 w-48 mb-2" />
      <Skeleton className="h-4 w-64 mb-6" />

      {/* KPI Grid */}
      <SkeletonKpiGrid />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <SkeletonChart />
        <SkeletonChart />
      </div>

      {/* Table */}
      <SkeletonTable rows={3} />
    </div>
  );
}
