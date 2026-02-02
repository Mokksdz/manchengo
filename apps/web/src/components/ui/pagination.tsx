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
    <div className="flex items-center justify-between bg-white rounded-2xl border border-[#E5E5E5] shadow-apple-card px-6 py-4">
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
          className="p-2 border border-[#E5E5E5] rounded-[10px] hover:bg-[#FAFAFA] disabled:opacity-40 transition-all"
        >
          <ChevronLeft className="w-4 h-4 text-[#6E6E73]" />
        </button>
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          aria-label="Page suivante"
          className="p-2 border border-[#E5E5E5] rounded-[10px] hover:bg-[#FAFAFA] disabled:opacity-40 transition-all"
        >
          <ChevronRight className="w-4 h-4 text-[#6E6E73]" />
        </button>
      </div>
    </div>
  );
}
