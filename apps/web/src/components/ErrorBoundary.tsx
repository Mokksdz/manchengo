'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { createLogger } from '@/lib/logger';

const log = createLogger('ErrorBoundary');

/**
 * ErrorBoundary Component for Manchengo ERP
 * 
 * WHY CRITICAL FOR ERP:
 * - A single JS error should NOT crash the entire application
 * - Users should see a controlled error UI, not a blank screen
 * - Errors should be logged for debugging
 * - Users should have a way to recover (retry/refresh)
 * 
 * This prevents:
 * - Complete app crashes from API failures
 * - Blank screens that confuse users
 * - Lost work due to unhandled errors
 */

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  module?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { module = 'Unknown', onError } = this.props;
    
    log.error(`Error in ${module}`, {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    if (onError) {
      onError(error, errorInfo);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleRefresh = () => {
    window.location.reload();
  };

  render() {
    const { hasError, error } = this.state;
    const { children, fallback, module = 'ce module' } = this.props;

    if (hasError) {
      if (fallback) {
        return fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 bg-red-50 rounded-lg border border-red-200">
          <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-lg font-semibold text-[#1D1D1F] mb-2">
            Une erreur est survenue
          </h2>
          <p className="text-[#6E6E73] text-center mb-4 max-w-md">
            {module} a rencontré un problème. Vous pouvez réessayer ou rafraîchir la page.
          </p>
          {process.env.NODE_ENV !== 'production' && error && (
            <pre className="text-xs text-red-600 bg-red-100 p-2 rounded mb-4 max-w-full overflow-auto">
              {error.message}
            </pre>
          )}
          <div className="flex gap-3" role="group" aria-label="Actions de récupération">
            <button
              onClick={this.handleRetry}
              aria-label="Réessayer le chargement du module"
              className="flex items-center gap-2 px-4 py-2 bg-white border border-[#E5E5E5] rounded-lg text-[#1D1D1F] hover:bg-[#FAFAFA] transition-colors"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              Réessayer
            </button>
            <button
              onClick={this.handleRefresh}
              aria-label="Rafraîchir la page complète"
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              Rafraîchir la page
            </button>
          </div>
        </div>
      );
    }

    return children;
  }
}

/**
 * Module-specific ErrorBoundary wrapper
 * Pre-configured for common ERP modules
 */
export function DashboardErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary module="Le tableau de bord">
      {children}
    </ErrorBoundary>
  );
}

export function ApproErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary module="Le module Approvisionnement">
      {children}
    </ErrorBoundary>
  );
}

export function ProductionErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary module="Le module Production">
      {children}
    </ErrorBoundary>
  );
}

export function StockErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary module="Le module Stock">
      {children}
    </ErrorBoundary>
  );
}
