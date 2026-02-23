'use client';

import Link from 'next/link';
import { Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * NextActionsList — Premium Glassmorphism Priority Actions
 *
 * Apple Silicon inspired:
 * - Frosted glass container with floating items
 * - Numbered priority pills with severity tinting
 * - Smooth hover transitions with depth
 * - Elegant dividers and spacing
 */

export type ActionSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface NextAction {
  id: string;
  label: string;
  severity: ActionSeverity;
  actionLabel: string;
  href: string;
  context?: string;
}

export interface NextActionsListProps {
  actions: NextAction[];
  emptyMessage?: string;
}

const severityConfig: Record<ActionSeverity, {
  dot: string;
  numberBg: string;
  numberText: string;
}> = {
  CRITICAL: {
    dot: 'bg-[#FF3B30]',
    numberBg: 'bg-gradient-to-br from-[#FF3B30]/10 to-[#FF6961]/5',
    numberText: 'text-[#FF3B30]/70',
  },
  WARNING: {
    dot: 'bg-[#FF9500]',
    numberBg: 'bg-gradient-to-br from-[#FF9500]/10 to-[#FFAC33]/5',
    numberText: 'text-[#FF9500]/70',
  },
  INFO: {
    dot: 'bg-[#007AFF]',
    numberBg: 'bg-gradient-to-br from-[#007AFF]/10 to-[#5AC8FA]/5',
    numberText: 'text-[#007AFF]/70',
  },
};

export function NextActionsList({ actions, emptyMessage }: NextActionsListProps) {
  if (actions.length === 0) {
    return (
      <div className="glass-card p-10 text-center">
        <div className="w-12 h-12 rounded-[16px] bg-gradient-to-br from-[#34C759]/10 to-[#30D158]/5 flex items-center justify-center mx-auto mb-4">
          <Check className="w-5.5 h-5.5 text-[#34C759]/70" />
        </div>
        <p className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight">
          {emptyMessage || 'Aucune action prioritaire'}
        </p>
        <p className="text-[13px] text-[#AEAEB2] mt-1.5">
          Situation sous contrôle
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.04]">
        <h3 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight">
          Actions prioritaires
        </h3>
        <span className="glass-pill text-[#86868B]">
          {actions.length}
        </span>
      </div>

      {/* Action items */}
      <div className="divide-y divide-black/[0.03]">
        {actions.slice(0, 3).map((action, index) => {
          const config = severityConfig[action.severity];
          return (
            <Link
              key={action.id}
              href={action.href}
              className="group flex items-center gap-4 px-6 py-4.5 hover:bg-white/40 transition-all duration-200"
            >
              {/* Priority number pill */}
              <span className={cn(
                'flex-shrink-0 w-7 h-7 rounded-[10px] flex items-center justify-center text-[12px] font-bold',
                config.numberBg,
                config.numberText
              )}>
                {index + 1}
              </span>

              {/* Status dot */}
              <div className={cn('flex-shrink-0 w-[6px] h-[6px] rounded-full', config.dot)} />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-[#1D1D1F] truncate tracking-[-0.005em]">
                  {action.label}
                </p>
                {action.context && (
                  <p className="text-[12px] text-[#AEAEB2] mt-0.5 truncate">
                    {action.context}
                  </p>
                )}
              </div>

              {/* Action */}
              <span className="flex-shrink-0 flex items-center gap-1 text-[13px] font-medium text-[#86868B] group-hover:text-[#1D1D1F] transition-colors duration-200">
                {action.actionLabel}
                <ChevronRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
