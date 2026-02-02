'use client';

import { memo, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DataCardProps {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export const DataCard = memo(function DataCard({ title, subtitle, icon, actions, children, className, noPadding }: DataCardProps) {
  return (
    <div className={cn('bg-white rounded-[16px] border border-[#E5E5E5] shadow-apple-card', className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0F0F0]">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="w-10 h-10 rounded-[10px] bg-[#F5F5F5] flex items-center justify-center text-[#6E6E73]">
                {icon}
              </div>
            )}
            <div>
              {title && <h3 className="font-semibold text-[#1D1D1F]">{title}</h3>}
              {subtitle && <p className="text-[13px] text-[#86868B]">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn(!noPadding && 'p-6')}>{children}</div>
    </div>
  );
});
