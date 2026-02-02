'use client';

import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Optional label below spinner */
  label?: string;
  /** Full-page centered (with height) or inline */
  fullPage?: boolean;
  /** Custom className */
  className?: string;
}

const sizeMap = {
  sm: 'w-5 h-5 border-2',
  md: 'w-8 h-8 border-2',
  lg: 'w-12 h-12 border-[3px]',
};

/**
 * Unified loading spinner — Apple-inspired, brand orange accent.
 * THE ONE spinner for the entire app. No more border-b-2, no more slate/purple spinners.
 */
export function LoadingSpinner({ size = 'md', label, fullPage = false, className }: LoadingSpinnerProps) {
  const spinner = (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div
        className={cn(
          'animate-spin rounded-full border-[#E5E5E5] border-t-[#EC7620]',
          sizeMap[size],
        )}
      />
      {label && <p className="text-[#AEAEB2] text-[13px]">{label}</p>}
    </div>
  );

  if (fullPage) {
    return (
      <div className="flex items-center justify-center h-64">
        {spinner}
      </div>
    );
  }

  return spinner;
}
