'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * PageHeader — Apple Glass Design
 * Refined glassmorphism header with subtle depth
 */

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  badge?: { text: string; variant?: 'default' | 'success' | 'warning' | 'error' | 'info' };
  actions?: ReactNode;
  breadcrumb?: { label: string; href?: string }[];
  className?: string;
}

const dotColors = {
  default: 'bg-[#8E8E93]',
  success: 'bg-[#34C759]',
  warning: 'bg-[#FF9500]',
  error: 'bg-[#FF3B30]',
  info: 'bg-[#007AFF]',
};

const badgeGlassStyles = {
  default: 'bg-[#8E8E93]/8 text-[#8E8E93]',
  success: 'bg-[#34C759]/8 text-[#34C759]',
  warning: 'bg-[#FF9500]/8 text-[#FF9500]',
  error: 'bg-[#FF3B30]/8 text-[#FF3B30]',
  info: 'bg-[#007AFF]/8 text-[#007AFF]',
};

export function PageHeader({ title, subtitle, badge, actions, breadcrumb, className }: PageHeaderProps) {
  const variant = badge?.variant || 'default';

  return (
    <div className={cn('mb-10', className)}>
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="flex items-center gap-1.5 text-[13px] text-[#8E8E93] mb-4">
          {breadcrumb.map((item, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-[#D1D1D6]">/</span>}
              {item.href ? (
                <a href={item.href} className="hover:text-[#1D1D1F] transition-colors">{item.label}</a>
              ) : (
                <span className="text-[#1D1D1F] font-medium">{item.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-[28px] font-semibold text-[#1D1D1F] tracking-[-0.025em] leading-tight">{title}</h1>
          {(subtitle || badge) && (
            <div className="flex items-center gap-3">
              {subtitle && (
                <p className="text-[14px] text-[#86868B] leading-relaxed">{subtitle}</p>
              )}
              {badge && (
                <span className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold',
                  badgeGlassStyles[variant],
                )}>
                  <span className={cn('w-[6px] h-[6px] rounded-full', dotColors[variant])} />
                  {badge.text}
                </span>
              )}
            </div>
          )}
        </div>
        {actions && <div className="flex items-center gap-2.5">{actions}</div>}
      </div>
    </div>
  );
}
