'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QueryErrorStateProps {
  message?: string;
  onRetry?: () => void;
  variant?: 'compact' | 'full';
  className?: string;
}

export function QueryErrorState({
  message = 'Une erreur est survenue lors du chargement des données.',
  onRetry,
  variant = 'full',
  className,
}: QueryErrorStateProps) {
  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'glass-card flex items-center gap-3 px-4 py-3 rounded-xl border border-[#FF3B30]/15',
          className,
        )}
      >
        <AlertTriangle className="w-4 h-4 text-[#FF3B30] flex-shrink-0" />
        <span className="text-sm text-[#1D1D1F] flex-1 truncate">{message}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="glass-btn px-3 py-1.5 rounded-lg text-xs font-semibold text-[#1D1D1F] flex-shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Réessayer
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'glass-card flex flex-col items-center justify-center gap-4 py-16 px-8 text-center',
        className,
      )}
    >
      <div className="w-12 h-12 rounded-2xl bg-[#FF3B30]/10 flex items-center justify-center">
        <AlertTriangle className="w-6 h-6 text-[#FF3B30]" />
      </div>
      <div className="space-y-1">
        <p className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight">
          Erreur de chargement
        </p>
        <p className="text-sm text-[#86868B] max-w-sm">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="glass-btn px-5 py-2.5 rounded-xl text-sm font-semibold text-[#1D1D1F]"
        >
          <RefreshCw className="w-4 h-4" />
          Réessayer
        </button>
      )}
    </div>
  );
}
