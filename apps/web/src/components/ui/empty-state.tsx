'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Unified empty state component — consistent across all pages.
 */
export function EmptyState({ icon, title, subtitle, action, className }: EmptyStateProps) {
  return (
    <div className={cn('text-center py-12', className)}>
      <div className="w-16 h-16 mx-auto mb-4 text-[#D1D1D6] flex items-center justify-center">
        {icon}
      </div>
      <p className="font-medium text-[#6E6E73]">{title}</p>
      {subtitle && <p className="text-[13px] text-[#AEAEB2] mt-1">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
