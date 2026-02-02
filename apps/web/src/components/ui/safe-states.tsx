'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, WifiOff, PackageX, Loader2, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * SAFE STATE COMPONENTS - UI states that prevent user confusion
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * PURPOSE: Every possible state the UI can be in must be explicitly handled
 * 
 * STATES:
 *   - Empty: No data exists (not an error)
 *   - Loading: Operation in progress
 *   - Error: Something failed (with action)
 *   - Partial: Some widgets failed, others work
 *   - Degraded: Read-only mode due to backend issues
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// EMPTY STATE - No data exists (this is NOT an error)
// ═══════════════════════════════════════════════════════════════════════════════

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        {icon || <PackageX className="h-8 w-8 text-muted-foreground" />}
      </div>
      <h3 className="text-lg font-medium mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
      {action && (
        <Button onClick={action.onClick} variant="outline">
          {action.label}
        </Button>
      )}
    </div>
  );
}

// Specialized empty states for ERP modules
export function EmptyStockState({ onAddProduct }: { onAddProduct?: () => void }) {
  return (
    <EmptyState
      title="Aucun produit en stock"
      description="Commencez par ajouter des produits ou effectuer une réception."
      action={onAddProduct ? { label: 'Ajouter un produit', onClick: onAddProduct } : undefined}
    />
  );
}

export function EmptyProductionState({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      title="Aucun ordre de production"
      description="Créez un ordre de production pour commencer."
      action={onCreate ? { label: 'Créer un ordre', onClick: onCreate } : undefined}
    />
  );
}

export function EmptyAlertsState() {
  return (
    <EmptyState
      icon={<AlertCircle className="h-8 w-8 text-green-500" />}
      title="Aucune alerte active"
      description="Tout fonctionne normalement. Les alertes apparaîtront ici si nécessaire."
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOADING STATE - Operation in progress
// ═══════════════════════════════════════════════════════════════════════════════

interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingState({ message = 'Chargement...', size = 'md' }: LoadingStateProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <Loader2 className={`${sizeClasses[size]} animate-spin text-primary mb-4`} />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// Long operation loading (shows progress context)
interface LongOperationLoadingProps {
  title: string;
  description: string;
  progress?: number; // 0-100
}

export function LongOperationLoading({ title, description, progress }: LongOperationLoadingProps) {
  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        {progress !== undefined && (
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          Ne fermez pas cette fenêtre pendant l'opération.
        </p>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR STATE - Something failed (always with action)
// ═══════════════════════════════════════════════════════════════════════════════

interface ErrorStateProps {
  title: string;
  message: string;
  action: string;
  onRetry?: () => void;
  requestId?: string;
  variant?: 'error' | 'warning';
}

export function ErrorState({ 
  title, 
  message, 
  action, 
  onRetry, 
  requestId,
  variant = 'error' 
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className={`rounded-full p-4 mb-4 ${
        variant === 'error' ? 'bg-destructive/10' : 'bg-yellow-500/10'
      }`}>
        <AlertTriangle className={`h-8 w-8 ${
          variant === 'error' ? 'text-destructive' : 'text-yellow-600'
        }`} />
      </div>
      <h3 className="text-lg font-medium mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-2">{message}</p>
      <p className="text-sm text-muted-foreground max-w-sm mb-4 font-medium">{action}</p>
      
      {onRetry && (
        <Button onClick={onRetry} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Réessayer
        </Button>
      )}
      
      {requestId && (
        <p className="text-xs text-muted-foreground mt-4">
          Référence support: <code className="bg-muted px-1 rounded">{requestId}</code>
        </p>
      )}
    </div>
  );
}

// Network error (offline)
export function OfflineState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <WifiOff className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-2">Connexion perdue</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-4">
        Impossible de contacter le serveur. Vérifiez votre connexion internet.
      </p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Réessayer
        </Button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARTIAL FAILURE - Some widgets failed, others work
// ═══════════════════════════════════════════════════════════════════════════════

interface PartialFailureProps {
  title: string;
  onRetry?: () => void;
}

export function PartialFailureBanner({ title, onRetry }: PartialFailureProps) {
  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>Certaines données n'ont pas pu être chargées.</span>
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry} className="gap-1">
            <RefreshCw className="h-3 w-3" />
            Réessayer
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

// Widget that failed to load (shows in place of content)
export function WidgetError({ title, onRetry }: { title: string; onRetry?: () => void }) {
  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardContent className="flex flex-col items-center justify-center py-8">
        <AlertTriangle className="h-6 w-6 text-destructive mb-2" />
        <p className="text-sm text-muted-foreground mb-2">{title}</p>
        {onRetry && (
          <Button size="sm" variant="ghost" onClick={onRetry} className="gap-1">
            <RefreshCw className="h-3 w-3" />
            Réessayer
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEGRADED MODE - Read-only when backend unstable
// ═══════════════════════════════════════════════════════════════════════════════

export function DegradedModeBanner() {
  return (
    <Alert className="mb-4 bg-yellow-50 border-yellow-200">
      <AlertTriangle className="h-4 w-4 text-yellow-600" />
      <AlertTitle className="text-yellow-800">Mode lecture seule</AlertTitle>
      <AlertDescription className="text-yellow-700">
        Le système fonctionne en mode dégradé. Les modifications sont temporairement désactivées.
        Vous pouvez consulter les données mais pas les modifier.
      </AlertDescription>
    </Alert>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INFO BANNER - Non-blocking information
// ═══════════════════════════════════════════════════════════════════════════════

interface InfoBannerProps {
  title: string;
  description: string;
  onDismiss?: () => void;
}

export function InfoBanner({ title, description, onDismiss }: InfoBannerProps) {
  return (
    <Alert className="mb-4">
      <Info className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>{description}</span>
        {onDismiss && (
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Fermer
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
