'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}

/**
 * Unified pagination component — Apple-inspired style.
 */
export function Pagination({ page, totalPages, total, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between rounded-[18px] border border-white/75 bg-white/75 px-6 py-4 shadow-[0_16px_36px_rgba(18,22,33,0.08),inset_0_1px_0_rgba(255,255,255,0.5)] backdrop-blur-[22px]">
      <p className="text-sm text-[#6E6E73]">
        Page <span className="font-medium text-[#1D1D1F]">{page}</span> sur{' '}
        <span className="font-medium text-[#1D1D1F]">{totalPages}</span>{' '}
        ({total} résultats)
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          aria-label="Page precedente"
          className="p-2 border border-white/80 rounded-[11px] bg-white/65 hover:bg-white/80 disabled:opacity-40 transition-all backdrop-blur-[14px]"
        >
          <ChevronLeft className="w-4 h-4 text-[#6E6E73]" />
        </button>
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          aria-label="Page suivante"
          className="p-2 border border-white/80 rounded-[11px] bg-white/65 hover:bg-white/80 disabled:opacity-40 transition-all backdrop-blur-[14px]"
        >
          <ChevronRight className="w-4 h-4 text-[#6E6E73]" />
        </button>
      </div>
    </div>
  );
}
