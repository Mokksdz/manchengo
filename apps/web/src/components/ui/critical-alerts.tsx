'use client';

import React from 'react';
import {
  AlertTriangle,
  PackageX,
  Factory,
  Shield,
  Bell,
  ChevronRight,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CRITICAL ALERTS SURFACE - No silent failures allowed
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * PURPOSE: Surface critical operational issues that require immediate attention
 * 
 * ALERT TYPES:
 *   - STOCK_RUPTURE: Product out of stock
 *   - PRODUCTION_BLOCKED: Cannot produce due to missing MP
 *   - SECURITY_INCIDENT: Unauthorized access attempts
 *   - SYSTEM_DEGRADED: Backend issues affecting operations
 * 
 * DESIGN PRINCIPLES:
 *   1. Visible but not blocking normal workflow
 *   2. Actionable - links to where user can fix the issue
 *   3. Dismissible only after acknowledgment
 *   4. Severity-based visual hierarchy
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertType = 
  | 'stock_rupture' 
  | 'production_blocked' 
  | 'security_incident'
  | 'system_degraded'
  | 'threshold_breach'
  | 'expiry_warning';

export interface CriticalAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  timestamp: Date;
  entityType?: string;
  entityId?: string;
  actionLabel?: string;
  actionPath?: string;
  isAcknowledged?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALERTS PANEL - Main container for operational alerts
// ═══════════════════════════════════════════════════════════════════════════════

interface AlertsPanelProps {
  alerts: CriticalAlert[];
  onAcknowledge: (alertId: string) => void;
  onNavigate: (path: string) => void;
  maxVisible?: number;
}

export function AlertsPanel({ 
  alerts, 
  onAcknowledge, 
  onNavigate,
  maxVisible = 5 
}: AlertsPanelProps) {
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' && !a.isAcknowledged);
  const warningAlerts = alerts.filter(a => a.severity === 'warning' && !a.isAcknowledged);
  const allUnacked = [...criticalAlerts, ...warningAlerts];
  
  if (allUnacked.length === 0) {
    return null;
  }

  const visibleAlerts = allUnacked.slice(0, maxVisible);
  const hiddenCount = allUnacked.length - maxVisible;

  return (
    <Card className="border-destructive/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Bell className="h-4 w-4 text-destructive" />
            Alertes actives
            <Badge variant="destructive" className="ml-2">
              {allUnacked.length}
            </Badge>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {visibleAlerts.map(alert => (
          <AlertItem 
            key={alert.id} 
            alert={alert} 
            onAcknowledge={onAcknowledge}
            onNavigate={onNavigate}
          />
        ))}
        
        {hiddenCount > 0 && (
          <button 
            className="text-sm text-muted-foreground hover:text-foreground w-full text-center py-2"
            onClick={() => onNavigate('/dashboard/alerts')}
          >
            +{hiddenCount} autres alertes...
          </button>
        )}
      </CardContent>
    </Card>
  );
}

function AlertItem({ 
  alert, 
  onAcknowledge, 
  onNavigate 
}: { 
  alert: CriticalAlert; 
  onAcknowledge: (id: string) => void;
  onNavigate: (path: string) => void;
}) {
  const getIcon = () => {
    switch (alert.type) {
      case 'stock_rupture':
        return <PackageX className="h-4 w-4" />;
      case 'production_blocked':
        return <Factory className="h-4 w-4" />;
      case 'security_incident':
        return <Shield className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getSeverityClasses = () => {
    switch (alert.severity) {
      case 'critical':
        return 'bg-destructive/10 border-destructive/30 text-destructive';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      default:
        return 'bg-muted border-border text-muted-foreground';
    }
  };

  return (
    <div className={`rounded-lg border p-3 ${getSeverityClasses()}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{getIcon()}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{alert.title}</span>
            <span className="text-xs opacity-70">
              <Clock className="h-3 w-3 inline mr-1" />
              {getTimeAgo(alert.timestamp)}
            </span>
          </div>
          <p className="text-xs mt-1 opacity-90">{alert.message}</p>
          
          <div className="flex items-center gap-2 mt-2">
            {alert.actionPath && (
              <Button 
                size="sm" 
                variant="outline" 
                className="h-7 text-xs"
                onClick={() => onNavigate(alert.actionPath!)}
              >
                {alert.actionLabel || 'Voir'}
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            )}
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-7 text-xs"
              onClick={() => onAcknowledge(alert.id)}
            >
              Accuser réception
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOP BAR ALERT INDICATOR - Persistent indicator in header
// ═══════════════════════════════════════════════════════════════════════════════

interface AlertIndicatorProps {
  criticalCount: number;
  warningCount: number;
  onClick: () => void;
}

export function AlertIndicator({ criticalCount, warningCount, onClick }: AlertIndicatorProps) {
  const totalCount = criticalCount + warningCount;
  
  if (totalCount === 0) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
        criticalCount > 0 
          ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
          : 'bg-yellow-500 text-white hover:bg-yellow-600'
      }`}
    >
      <Bell className="h-4 w-4" />
      <span>{totalCount}</span>
      {criticalCount > 0 && (
        <span className="absolute -top-1 -right-1 h-3 w-3 bg-white rounded-full animate-ping" />
      )}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INLINE STOCK RUPTURE ALERT - Shows in stock pages
// ═══════════════════════════════════════════════════════════════════════════════

interface StockRuptureAlertProps {
  products: Array<{ id: number; code: string; name: string }>;
  onNavigate: (path: string) => void;
}

export function StockRuptureAlert({ products, onNavigate }: StockRuptureAlertProps) {
  if (products.length === 0) return null;

  return (
    <Alert variant="destructive" className="mb-4">
      <PackageX className="h-4 w-4" />
      <AlertTitle>Rupture de stock</AlertTitle>
      <AlertDescription>
        <p className="mb-2">
          {products.length} produit{products.length > 1 ? 's' : ''} en rupture de stock:
        </p>
        <ul className="list-disc list-inside text-sm space-y-1">
          {products.slice(0, 5).map(p => (
            <li key={p.id}>{p.code} - {p.name}</li>
          ))}
          {products.length > 5 && (
            <li className="text-muted-foreground">
              +{products.length - 5} autres...
            </li>
          )}
        </ul>
        <Button 
          size="sm" 
          variant="outline" 
          className="mt-3"
          onClick={() => onNavigate('/dashboard/appro')}
        >
          Gérer l'approvisionnement
        </Button>
      </AlertDescription>
    </Alert>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTION BLOCKED ALERT - Shows in production pages
// ═══════════════════════════════════════════════════════════════════════════════

interface ProductionBlockedAlertProps {
  blockedOrders: Array<{
    id: string;
    orderNumber: string;
    missingMp: string[];
  }>;
  onNavigate: (path: string) => void;
}

export function ProductionBlockedAlert({ blockedOrders, onNavigate }: ProductionBlockedAlertProps) {
  if (blockedOrders.length === 0) return null;

  return (
    <Alert className="mb-4 bg-orange-50 border-orange-200">
      <Factory className="h-4 w-4 text-orange-600" />
      <AlertTitle className="text-orange-800">Production bloquée</AlertTitle>
      <AlertDescription className="text-orange-700">
        <p className="mb-2">
          {blockedOrders.length} ordre{blockedOrders.length > 1 ? 's' : ''} ne peu{blockedOrders.length > 1 ? 'vent' : 't'} pas démarrer:
        </p>
        <ul className="text-sm space-y-2">
          {blockedOrders.slice(0, 3).map(order => (
            <li key={order.id}>
              <span className="font-medium">{order.orderNumber}</span>
              <span className="text-orange-600 ml-2">
                MP manquantes: {order.missingMp.join(', ')}
              </span>
            </li>
          ))}
        </ul>
        <Button 
          size="sm" 
          variant="outline" 
          className="mt-3 border-orange-300 hover:bg-orange-100"
          onClick={() => onNavigate('/dashboard/appro')}
        >
          Vérifier les stocks
        </Button>
      </AlertDescription>
    </Alert>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY INCIDENT BANNER - Admin only, top of page
// ═══════════════════════════════════════════════════════════════════════════════

interface SecurityIncidentBannerProps {
  incidents: Array<{
    id: string;
    type: string;
    actor: string;
    timestamp: Date;
  }>;
  onViewDetails: () => void;
}

export function SecurityIncidentBanner({ incidents, onViewDetails }: SecurityIncidentBannerProps) {
  if (incidents.length === 0) return null;

  const recentIncident = incidents[0];

  return (
    <div className="bg-red-900 text-white px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Shield className="h-5 w-5" />
        <div>
          <span className="font-medium">Incident de sécurité détecté</span>
          <span className="mx-2">•</span>
          <span className="text-red-200">
            {recentIncident.type} par {recentIncident.actor}
          </span>
          <span className="mx-2">•</span>
          <span className="text-red-200">{getTimeAgo(recentIncident.timestamp)}</span>
        </div>
      </div>
      <Button 
        size="sm" 
        variant="secondary"
        onClick={onViewDetails}
      >
        Voir les détails
      </Button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY
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
