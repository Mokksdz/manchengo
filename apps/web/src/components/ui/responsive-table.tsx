'use client';

import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSIVE TABLE — Apple Glass Design System
// ═══════════════════════════════════════════════════════════════════════════════
//
// Desktop (lg:): standard glass table
// Mobile (< lg): stacked glass-card cards with key-value pairs

export interface Column<T> {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  mobileHidden?: boolean;
  mobileLabel?: string;
  className?: string;
}

export interface ResponsiveTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  mobileCardTitle?: (item: T) => React.ReactNode;
  mobileCardBadge?: (item: T) => React.ReactNode;
  /** Extra className on the desktop table <tr> */
  rowClassName?: (item: T) => string;
  /** Extra className on the mobile card wrapper */
  cardClassName?: (item: T) => string;
  /** Render custom content at the bottom of each mobile card */
  mobileCardFooter?: (item: T) => React.ReactNode;
  /** Desktop thead className override */
  theadClassName?: string;
  /** Desktop tbody className override */
  tbodyClassName?: string;
  /** Sortable header click handler — receives the column key */
  onHeaderClick?: (key: string) => void;
  /** Which column headers are sortable */
  sortableHeaders?: string[];
  /** Render a custom header cell (for sort icons etc.) */
  renderHeader?: (column: Column<T>) => React.ReactNode;
}

export function ResponsiveTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage = 'Aucun élément à afficher',
  mobileCardTitle,
  mobileCardBadge,
  rowClassName,
  cardClassName,
  mobileCardFooter,
  theadClassName,
  tbodyClassName,
  onHeaderClick,
  sortableHeaders,
  renderHeader,
}: ResponsiveTableProps<T>) {
  const mobileColumns = columns.filter((col) => !col.mobileHidden);

  // ─── Empty state ────────────────────────────────────────────────────────────
  if (data.length === 0) {
    return (
      <div className="glass-card p-12 text-center">
        <p className="text-[#86868B]">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      {/* ═══ DESKTOP TABLE (lg and above) ═══ */}
      <div className="glass-card overflow-hidden hidden lg:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={theadClassName ?? 'border-b border-black/[0.04]'}>
              <tr>
                {columns.map((col) => {
                  const isSortable = sortableHeaders?.includes(col.key);
                  return (
                    <th
                      key={col.key}
                      className={cn(
                        'p-4 text-xs font-medium text-[#86868B] uppercase',
                        isSortable && 'cursor-pointer hover:bg-white/40',
                        col.className
                      )}
                      onClick={isSortable && onHeaderClick ? () => onHeaderClick(col.key) : undefined}
                    >
                      {renderHeader ? renderHeader(col) : col.header}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className={tbodyClassName ?? 'divide-y divide-black/[0.03]'}>
              {data.map((item) => (
                <tr
                  key={keyExtractor(item)}
                  className={cn(
                    'hover:bg-white/40 transition-colors',
                    onRowClick && 'cursor-pointer',
                    rowClassName?.(item)
                  )}
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn('p-4', col.className)}>
                      {col.render(item)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ MOBILE CARDS (below lg) ═══ */}
      <div className="lg:hidden space-y-3">
        {data.map((item) => (
          <div
            key={keyExtractor(item)}
            className={cn(
              'glass-card-hover rounded-2xl p-4',
              onRowClick && 'cursor-pointer',
              cardClassName?.(item)
            )}
            onClick={onRowClick ? () => onRowClick(item) : undefined}
          >
            {/* Card Header: title + badge */}
            {(mobileCardTitle || mobileCardBadge) && (
              <div className="flex items-start justify-between gap-3 mb-3">
                {mobileCardTitle && (
                  <div className="font-semibold text-[#1D1D1F] text-sm leading-tight">
                    {mobileCardTitle(item)}
                  </div>
                )}
                {mobileCardBadge && (
                  <div className="flex-shrink-0">
                    {mobileCardBadge(item)}
                  </div>
                )}
              </div>
            )}

            {/* Key-value grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {mobileColumns.map((col) => {
                // Skip title column if it's already rendered as card title
                return (
                  <div key={col.key} className="min-w-0">
                    <p className="text-[11px] font-medium text-[#86868B] uppercase tracking-wider mb-0.5">
                      {col.mobileLabel ?? col.header}
                    </p>
                    <div className="text-sm text-[#1D1D1F]">
                      {col.render(item)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Optional footer (e.g. action buttons) */}
            {mobileCardFooter && (
              <div className="mt-3 pt-3 border-t border-black/[0.04]">
                {mobileCardFooter(item)}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
