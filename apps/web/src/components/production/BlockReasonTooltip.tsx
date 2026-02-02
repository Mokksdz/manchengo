'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BLOCK REASON TOOLTIP — A3
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * 🎯 Question métier: "Pourquoi le système m'empêche de produire ?"
 * ⚠️ Erreur humaine empêchée: Ne pas comprendre la cause d'un blocage
 *
 * Règle UX:
 * ❌ "Stock insuffisant" (trop vague)
 * ✅ "Lait : 0.8 jour de couverture (seuil min: 2j)" (explicable)
 */

import { useState, useRef, ReactNode } from 'react';
import { AlertCircle, XCircle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BlockReasonTooltipProps {
  reasons: string[];
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function BlockReasonTooltip({
  reasons,
  children,
  position = 'bottom'
}: BlockReasonTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setIsOpen(false), 150);
  };

  if (reasons.length === 0) {
    return <>{children}</>;
  }

  // Position classes
  const positionClasses = {
    top: 'bottom-full left-0 mb-2',
    bottom: 'top-full left-0 mt-2',
    left: 'right-full top-0 mr-2',
    right: 'left-full top-0 ml-2',
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      {isOpen && (
        <div
          className={cn(
            'absolute z-50 w-80 rounded-[14px] p-4',
            positionClasses[position]
          )}
          style={{
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(40px) saturate(200%)',
            WebkitBackdropFilter: 'blur(40px) saturate(200%)',
            border: '1px solid rgba(255,255,255,0.45)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-black/[0.06]">
            <XCircle className="w-5 h-5 text-[#FF3B30]" />
            <span className="font-semibold text-sm text-[#1D1D1F]">Blocage detecte</span>
          </div>

          {/* Reasons list */}
          <ul className="space-y-2">
            {reasons.map((reason, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm">
                <span className="text-[#FF3B30] mt-0.5">&#8226;</span>
                <span className="text-[#1D1D1F]/80">{reason}</span>
              </li>
            ))}
          </ul>

          {/* Footer tip */}
          <div className="mt-3 pt-2 border-t border-black/[0.06] text-xs text-[#86868B]">
            Contactez APPRO pour resolution
          </div>

          {/* Arrow */}
          <div
            className={cn(
              'absolute w-3 h-3 rotate-45 rounded-[2px]',
              position === 'bottom' && 'top-0 left-4 -translate-y-1.5',
              position === 'top' && 'bottom-0 left-4 translate-y-1.5',
              position === 'left' && 'right-0 top-4 translate-x-1.5',
              position === 'right' && 'left-0 top-4 -translate-x-1.5',
            )}
            style={{
              background: 'rgba(255,255,255,0.85)',
              border: '1px solid rgba(255,255,255,0.45)',
            }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Version inline pour affichage dans une liste ou card
 */
export function BlockReasonInline({
  reasons,
  maxVisible = 2,
  variant = 'compact'
}: {
  reasons: string[];
  maxVisible?: number;
  variant?: 'compact' | 'detailed';
}) {
  const [expanded, setExpanded] = useState(false);

  if (reasons.length === 0) {
    return null;
  }

  const visibleReasons = expanded ? reasons : reasons.slice(0, maxVisible);
  const hasMore = reasons.length > maxVisible;

  if (variant === 'compact') {
    return (
      <BlockReasonTooltip reasons={reasons}>
        <div className="flex items-center gap-1 cursor-help">
          <AlertCircle className="w-4 h-4 text-[#FF3B30]" />
          <span className="text-sm text-[#FF3B30] font-medium">
            {reasons.length} blocage{reasons.length > 1 ? 's' : ''}
          </span>
        </div>
      </BlockReasonTooltip>
    );
  }

  return (
    <div className="space-y-1">
      {visibleReasons.map((reason, idx) => (
        <div
          key={idx}
          className="flex items-start gap-2 text-sm text-[#1D1D1F] bg-gradient-to-br from-[#FF3B30]/10 to-[#FF3B30]/5 px-3 py-2 rounded-[10px]"
        >
          <XCircle className="w-4 h-4 text-[#FF3B30] flex-shrink-0 mt-0.5" />
          <span>{reason}</span>
        </div>
      ))}

      {hasMore && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1 text-xs text-[#86868B] hover:text-[#1D1D1F] pl-2"
        >
          <ChevronDown className="w-3 h-3" />
          +{reasons.length - maxVisible} autre{reasons.length - maxVisible > 1 ? 's' : ''}
        </button>
      )}
    </div>
  );
}

/**
 * Badge de risque pour le planning (A2)
 */
export function PlanningRiskBadge({
  riskLevel,
  reasons
}: {
  riskLevel: 'OK' | 'WARNING' | 'CRITICAL';
  reasons?: string[];
}) {
  if (riskLevel === 'OK') {
    return (
      <span className="w-3 h-3 rounded-full bg-[#34C759]" title="Stock securise" />
    );
  }

  const content = (
    <span
      className={cn(
        'w-3 h-3 rounded-full',
        riskLevel === 'CRITICAL' ? 'bg-[#FF3B30]' : 'bg-[#FF9500]'
      )}
    />
  );

  if (reasons && reasons.length > 0) {
    return (
      <BlockReasonTooltip reasons={reasons}>
        {content}
      </BlockReasonTooltip>
    );
  }

  return content;
}
