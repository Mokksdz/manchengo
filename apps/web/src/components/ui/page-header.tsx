'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { BellRing } from 'lucide-react';

/**
 * PageHeader — Premium Apple Glass Design v2
 * Enhanced glassmorphism header with ambient depth
 */

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  badge?: { text: string; variant?: 'default' | 'success' | 'warning' | 'error' | 'info' };
  actions?: ReactNode;
  breadcrumb?: { label: string; href?: string }[];
  showNotifications?: boolean;
  notificationCount?: number;
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

export function PageHeader({ title, subtitle, icon, badge, actions, breadcrumb, showNotifications, notificationCount, className }: PageHeaderProps) {
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2 flex-1">
          {/* Live badge + ping */}
          {badge && (
            <div className="flex items-center mb-2 gap-2">
              <span className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase backdrop-blur-md border border-black/5',
                badgeGlassStyles[variant],
              )}>
                <span className={cn('w-[6px] h-[6px] rounded-full', dotColors[variant])} />
                {badge.text}
              </span>
              {variant === 'success' && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
              )}
            </div>
          )}

          <div className="flex items-start gap-3">
            {icon && (
              <div className="mt-0.5 hidden sm:flex w-11 h-11 rounded-[14px] border border-white/70 bg-white/65 backdrop-blur-[18px] items-center justify-center text-[#1D1D1F] shadow-[0_10px_24px_rgba(18,22,33,0.08),inset_0_1px_0_rgba(255,255,255,0.45)]">
                {icon}
              </div>
            )}
            <div>
              <h1 className="font-display text-[34px] font-black text-[#1D1D1F] tracking-[-0.04em] leading-tight">
                {title} <span className="text-[#EC7620]">.</span>
              </h1>
              {subtitle && (
                <p className="text-[15px] text-[#6E6E73] font-medium mt-1 max-w-md leading-relaxed">{subtitle}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          {showNotifications && (
            <button className="relative w-12 h-12 rounded-2xl bg-white/50 backdrop-blur-md border border-white/60 flex items-center justify-center text-[#6E6E73] hover:bg-white/80 hover:text-[#1D1D1F] hover:shadow-md transition-all group">
              <BellRing size={20} className="group-hover:animate-shake" />
              {(notificationCount ?? 0) > 0 && (
                <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-[#C62828] rounded-full border-2 border-white" />
              )}
            </button>
          )}
          {actions && <div className="flex items-center gap-2.5 shrink-0">{actions}</div>}
        </div>
      </div>
    </div>
  );
}
