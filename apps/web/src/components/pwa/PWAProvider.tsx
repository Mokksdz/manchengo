'use client';

import { createContext, useContext, ReactNode } from 'react';
import { usePWA, useOfflineSync } from '@/hooks/use-pwa';
import { toast } from 'sonner';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PWA PROVIDER — Context for PWA features across the app
 * ═══════════════════════════════════════════════════════════════════════════════
 */

interface PWAContextValue {
  isOnline: boolean;
  isInstalled: boolean;
  canInstall: boolean;
  hasUpdate: boolean;
  install: () => Promise<boolean>;
  update: () => void;
}

const PWAContext = createContext<PWAContextValue | null>(null);

export function PWAProvider({ children }: { children: ReactNode }) {
  const pwa = usePWA();

  // Show toast when offline sync completes
  useOfflineSync((_event) => {
    toast.success('Synchronisation terminee', {
      description: 'Vos modifications hors ligne ont ete enregistrees.',
    });
  });

  return (
    <PWAContext.Provider value={pwa}>
      {children}
      <OfflineIndicator isOnline={pwa.isOnline} />
      <UpdatePrompt hasUpdate={pwa.hasUpdate} onUpdate={pwa.update} />
      <InstallPrompt canInstall={pwa.canInstall} onInstall={pwa.install} />
    </PWAContext.Provider>
  );
}

export function usePWAContext(): PWAContextValue {
  const context = useContext(PWAContext);
  if (!context) {
    throw new Error('usePWAContext must be used within PWAProvider');
  }
  return context;
}

// ═══════════════════════════════════════════════════════════════════════════════
// OFFLINE INDICATOR — Shows when user is offline
// ═══════════════════════════════════════════════════════════════════════════════

function OfflineIndicator({ isOnline }: { isOnline: boolean }) {
  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg shadow-lg animate-in slide-in-from-left">
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
      </svg>
      <span className="text-sm font-medium">Mode hors ligne</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// UPDATE PROMPT — Shows when a new version is available
// ═══════════════════════════════════════════════════════════════════════════════

function UpdatePrompt({
  hasUpdate,
  onUpdate,
}: {
  hasUpdate: boolean;
  onUpdate: () => void;
}) {
  if (!hasUpdate) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-lg shadow-lg animate-in slide-in-from-right">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900">
          Nouvelle version disponible
        </p>
        <p className="text-xs text-gray-500">
          Cliquez pour mettre a jour l&apos;application
        </p>
      </div>
      <button
        onClick={onUpdate}
        className="px-3 py-1.5 bg-[#F5A623] text-white text-sm font-medium rounded-md hover:bg-[#E09500] transition-colors"
      >
        Mettre a jour
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INSTALL PROMPT — Shows install banner for PWA
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react'; // eslint-disable-line no-duplicate-imports

function InstallPrompt({
  canInstall,
  onInstall,
}: {
  canInstall: boolean;
  onInstall: () => Promise<boolean>;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  // Delay showing the prompt to not interrupt user immediately
  useEffect(() => {
    if (canInstall && !dismissed) {
      const timer = setTimeout(() => setShowPrompt(true), 30000); // 30 seconds
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [canInstall, dismissed]);

  if (!showPrompt || dismissed) return null;

  const handleInstall = async () => {
    const success = await onInstall();
    if (success) {
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShowPrompt(false);
    // Remember dismissal for this session
    sessionStorage.setItem('pwa-install-dismissed', 'true');
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md bg-white border border-gray-200 rounded-xl shadow-xl animate-in slide-in-from-bottom">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-[#FFF8E7] rounded-lg flex items-center justify-center flex-shrink-0">
            <svg
              className="w-6 h-6 text-[#F5A623]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900">
              Installer Manchengo ERP
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Installez l&apos;application pour un acces rapide et une utilisation hors ligne.
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={handleDismiss}
            className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Plus tard
          </button>
          <button
            onClick={handleInstall}
            className="flex-1 px-3 py-2 text-sm font-medium text-white bg-[#F5A623] rounded-lg hover:bg-[#E09500] transition-colors"
          >
            Installer
          </button>
        </div>
      </div>
    </div>
  );
}
