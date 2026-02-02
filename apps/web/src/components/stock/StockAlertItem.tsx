'use client';

import { memo, useState } from 'react';
import { 
  AlertTriangle, 
  Package, 
  Clock, 
  ClipboardList, 
  ExternalLink,
  ChevronRight,
  Loader2,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import Link from 'next/link';
import type { StockAlert } from '@/lib/api';

interface StockAlertItemProps {
  alert: StockAlert;
  onAction?: (alertId: string, action: string) => Promise<void>;
  onDismiss?: (alertId: string) => Promise<void>;
}

const severityConfig = {
  CRITICAL: {
    bg: 'bg-red-50 border-red-200 hover:bg-red-100',
    icon: 'text-red-600',
    badge: 'bg-red-100 text-red-800 border-red-300',
  },
  HIGH: {
    bg: 'bg-orange-50 border-orange-200 hover:bg-orange-100',
    icon: 'text-orange-600',
    badge: 'bg-orange-100 text-orange-800 border-orange-300',
  },
  MEDIUM: {
    bg: 'bg-amber-50 border-amber-200 hover:bg-amber-100',
    icon: 'text-amber-600',
    badge: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  LOW: {
    bg: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
    icon: 'text-blue-600',
    badge: 'bg-blue-100 text-blue-800 border-blue-300',
  },
};

const typeIcons: Record<string, React.ElementType> = {
  RUPTURE: Package,
  EXPIRY: Clock,
  INVENTORY: ClipboardList,
  DEFAULT: AlertTriangle,
};

export const StockAlertItem = memo(function StockAlertItem({ alert, onAction, onDismiss }: StockAlertItemProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [actionResult, setActionResult] = useState<'success' | 'error' | null>(null);

  const config = severityConfig[alert.severity];
  const Icon = typeIcons[alert.type] || typeIcons.DEFAULT;

  const handleAction = async () => {
    if (!onAction) return;
    
    setIsLoading(true);
    try {
      await onAction(alert.id, alert.actionRequired);
      setActionResult('success');
      setTimeout(() => setActionResult(null), 2000);
    } catch {
      setActionResult('error');
      setTimeout(() => setActionResult(null), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = async () => {
    if (!onDismiss || !alert.dismissable) return;
    
    setIsLoading(true);
    try {
      await onDismiss(alert.id);
      setIsDismissed(true);
    } catch {
      setActionResult('error');
    } finally {
      setIsLoading(false);
    }
  };

  if (isDismissed) {
    return null;
  }

  return (
    <TooltipProvider>
      <div
        className={`
          flex items-start gap-3 p-4 rounded-lg border transition-all duration-200
          ${config.bg}
          ${actionResult === 'success' ? 'ring-2 ring-green-400' : ''}
          ${actionResult === 'error' ? 'ring-2 ring-red-400' : ''}
        `}
      >
        {/* Icon */}
        <div className={`mt-0.5 ${config.icon}`}>
          <Icon className="h-5 w-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-medium text-[#1D1D1F] text-sm">
                {alert.title}
              </h4>
              <p className="text-sm text-[#6E6E73] mt-0.5">
                {alert.description}
              </p>
            </div>
            <Badge variant="outline" className={config.badge}>
              {alert.severity}
            </Badge>
          </div>

          {/* Meta */}
          <div className="flex items-center gap-4 mt-2 text-xs text-[#86868B]">
            <span>{alert.entityType} #{alert.entityId}</span>
            <span>{new Date(alert.createdAt).toLocaleString('fr-FR')}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-3">
            {alert.actionUrl ? (
              <Link href={alert.actionUrl}>
                <Button size="sm" variant="outline" className="gap-1">
                  {alert.actionRequired}
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </Link>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={handleAction}
                disabled={isLoading}
                className="gap-1"
              >
                {isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : actionResult === 'success' ? (
                  <CheckCircle className="h-3 w-3 text-green-600" />
                ) : actionResult === 'error' ? (
                  <XCircle className="h-3 w-3 text-red-600" />
                ) : null}
                {alert.actionRequired}
              </Button>
            )}

            {alert.dismissable && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleDismiss}
                    disabled={isLoading}
                    className="text-[#AEAEB2] hover:text-[#6E6E73]"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Masquer cette alerte</p>
                </TooltipContent>
              </Tooltip>
            )}

            {alert.actionUrl && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href={alert.actionUrl}>
                    <Button size="sm" variant="ghost" className="text-[#AEAEB2]">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Voir les détails</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
});
