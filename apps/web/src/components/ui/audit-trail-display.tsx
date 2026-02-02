'use client';

import React from 'react';
import { Clock, User, AlertTriangle, CheckCircle, XCircle, RefreshCw, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * AUDIT TRAIL DISPLAY - Show who did what (read-only)
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * PURPOSE: Make audit information visible to operators
 * 
 * DESIGN PRINCIPLES:
 *   1. Read-only - operators cannot modify audit data
 *   2. Clear attribution - who, what, when
 *   3. Non-intrusive - doesn't block workflow
 *   4. Contextual - shows relevant info per module
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

export type AuditActionType = 
  | 'create' 
  | 'update' 
  | 'delete' 
  | 'approve' 
  | 'reject' 
  | 'cancel'
  | 'override'
  | 'security';

interface AuditEntry {
  id: string;
  action: AuditActionType;
  actionLabel: string;
  actorName: string;
  actorRole: string;
  timestamp: Date;
  entityType: string;
  entityId: string;
  summary?: string;
  isHighRisk?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAST ACTION BADGE - Shows last critical action inline
// ═══════════════════════════════════════════════════════════════════════════════

interface LastActionBadgeProps {
  action: string;
  actorName: string;
  timestamp: Date;
  isHighRisk?: boolean;
}

export function LastActionBadge({ action, actorName, timestamp, isHighRisk }: LastActionBadgeProps) {
  const timeAgo = getTimeAgo(timestamp);
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs ${
            isHighRisk 
              ? 'bg-orange-100 text-orange-800 border border-orange-200' 
              : 'bg-muted text-muted-foreground'
          }`}>
            {isHighRisk && <Shield className="h-3 w-3" />}
            <User className="h-3 w-3" />
            <span className="font-medium">{actorName}</span>
            <span>•</span>
            <span>{action}</span>
            <span>•</span>
            <Clock className="h-3 w-3" />
            <span>{timeAgo}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Dernière action: {action}</p>
          <p>Par: {actorName}</p>
          <p>Le: {timestamp.toLocaleString('fr-FR')}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENTITY AUDIT FOOTER - Shows at bottom of entity cards/modals
// ═══════════════════════════════════════════════════════════════════════════════

interface EntityAuditFooterProps {
  createdBy: string;
  createdAt: Date;
  lastModifiedBy?: string;
  lastModifiedAt?: Date;
}

export function EntityAuditFooter({ 
  createdBy, 
  createdAt, 
  lastModifiedBy, 
  lastModifiedAt 
}: EntityAuditFooterProps) {
  return (
    <div className="border-t pt-3 mt-4 text-xs text-muted-foreground space-y-1">
      <div className="flex items-center gap-2">
        <span>Créé par</span>
        <span className="font-medium text-foreground">{createdBy}</span>
        <span>le</span>
        <span>{createdAt.toLocaleDateString('fr-FR')}</span>
        <span>à</span>
        <span>{createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      {lastModifiedBy && lastModifiedAt && (
        <div className="flex items-center gap-2">
          <span>Modifié par</span>
          <span className="font-medium text-foreground">{lastModifiedBy}</span>
          <span>le</span>
          <span>{lastModifiedAt.toLocaleDateString('fr-FR')}</span>
          <span>à</span>
          <span>{lastModifiedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT TIMELINE - Shows history of actions on an entity
// ═══════════════════════════════════════════════════════════════════════════════

interface AuditTimelineProps {
  entries: AuditEntry[];
  maxVisible?: number;
  onShowMore?: () => void;
}

export function AuditTimeline({ entries, maxVisible = 5, onShowMore }: AuditTimelineProps) {
  const visibleEntries = entries.slice(0, maxVisible);
  const hasMore = entries.length > maxVisible;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Historique des actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {visibleEntries.map((entry, index) => (
            <AuditTimelineEntry 
              key={entry.id} 
              entry={entry} 
              isLast={index === visibleEntries.length - 1 && !hasMore}
            />
          ))}
          
          {hasMore && onShowMore && (
            <button 
              onClick={onShowMore}
              className="text-sm text-primary hover:underline"
            >
              Voir {entries.length - maxVisible} actions de plus...
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AuditTimelineEntry({ entry, isLast }: { entry: AuditEntry; isLast: boolean }) {
  const getActionIcon = (action: AuditActionType) => {
    switch (action) {
      case 'create':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'update':
        return <RefreshCw className="h-4 w-4 text-blue-600" />;
      case 'delete':
      case 'cancel':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'approve':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'reject':
        return <XCircle className="h-4 w-4 text-orange-600" />;
      case 'override':
        return <Shield className="h-4 w-4 text-orange-600" />;
      case 'security':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="flex gap-3">
      {/* Timeline line */}
      <div className="flex flex-col items-center">
        <div className={`rounded-full p-1 ${
          entry.isHighRisk ? 'bg-orange-100' : 'bg-muted'
        }`}>
          {getActionIcon(entry.action)}
        </div>
        {!isLast && <div className="w-px h-full bg-border mt-1" />}
      </div>
      
      {/* Content */}
      <div className="flex-1 pb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{entry.actionLabel}</span>
          {entry.isHighRisk && (
            <Badge variant="outline" className="text-orange-600 border-orange-200">
              Override
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          <span>{entry.actorName}</span>
          <span className="mx-1">•</span>
          <span>{entry.actorRole}</span>
          <span className="mx-1">•</span>
          <span>{entry.timestamp.toLocaleString('fr-FR')}</span>
        </div>
        {entry.summary && (
          <p className="text-sm text-muted-foreground mt-1">{entry.summary}</p>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODULE LAST ACTIONS - Shows recent actions per module
// ═══════════════════════════════════════════════════════════════════════════════

interface ModuleLastActionsProps {
  moduleName: string;
  actions: Array<{
    id: string;
    action: string;
    actor: string;
    target: string;
    timestamp: Date;
    isHighRisk?: boolean;
  }>;
}

export function ModuleLastActions({ moduleName, actions }: ModuleLastActionsProps) {
  if (actions.length === 0) {
    return null;
  }

  const lastAction = actions[0];

  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2 mt-4">
      <span>Dernière action {moduleName}:</span>
      <LastActionBadge
        action={lastAction.action}
        actorName={lastAction.actor}
        timestamp={lastAction.timestamp}
        isHighRisk={lastAction.isHighRisk}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'à l\'instant';
  if (diffMins < 60) return `il y a ${diffMins} min`;
  if (diffHours < 24) return `il y a ${diffHours}h`;
  if (diffDays === 1) return 'hier';
  if (diffDays < 7) return `il y a ${diffDays} jours`;
  return date.toLocaleDateString('fr-FR');
}
