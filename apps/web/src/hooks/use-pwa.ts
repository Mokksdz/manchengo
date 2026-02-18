'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  registerServiceWorker,
  initInstallPrompt,
  canInstall,
  promptInstall,
  skipWaitingAndReload,
  isOnline,
  onOnlineStatusChange,
  onSyncMessage,
  isInstalledPWA,
} from '@/lib/pwa';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * usePWA Hook — PWA Status & Controls
 * ═══════════════════════════════════════════════════════════════════════════════
 */

interface PWAState {
  isOnline: boolean;
  isInstalled: boolean;
  canInstall: boolean;
  hasUpdate: boolean;
  swRegistration: ServiceWorkerRegistration | null;
}

interface PWAActions {
  install: () => Promise<boolean>;
  update: () => void;
}

export function usePWA(): PWAState & PWAActions {
  const [state, setState] = useState<PWAState>({
    isOnline: true,
    isInstalled: false,
    canInstall: false,
    hasUpdate: false,
    swRegistration: null,
  });

  // Initialize PWA features
  useEffect(() => {
    // Check initial state
    setState((prev) => ({
      ...prev,
      isOnline: isOnline(),
      isInstalled: isInstalledPWA(),
    }));

    // Initialize install prompt handler
    initInstallPrompt();

    // Register service worker
    registerServiceWorker().then((registration) => {
      if (registration) {
        setState((prev) => ({ ...prev, swRegistration: registration }));
      }
    });

    // Listen for install availability
    const handleInstallAvailable = () => {
      setState((prev) => ({ ...prev, canInstall: true }));
    };

    // Listen for successful installation
    const handleInstalled = () => {
      setState((prev) => ({ ...prev, canInstall: false, isInstalled: true }));
    };

    // Listen for updates
    const handleUpdateAvailable = () => {
      setState((prev) => ({ ...prev, hasUpdate: true }));
    };

    window.addEventListener('pwa:install-available', handleInstallAvailable);
    window.addEventListener('pwa:installed', handleInstalled);
    window.addEventListener('pwa:update-available', handleUpdateAvailable);

    // Listen for online/offline changes
    const unsubscribeOnline = onOnlineStatusChange((online) => {
      setState((prev) => ({ ...prev, isOnline: online }));
    });

    return () => {
      window.removeEventListener('pwa:install-available', handleInstallAvailable);
      window.removeEventListener('pwa:installed', handleInstalled);
      window.removeEventListener('pwa:update-available', handleUpdateAvailable);
      unsubscribeOnline();
    };
  }, []);

  // Install action
  const install = useCallback(async (): Promise<boolean> => {
    const success = await promptInstall();
    if (success) {
      setState((prev) => ({ ...prev, canInstall: false }));
    }
    return success;
  }, []);

  // Update action
  const update = useCallback((): void => {
    skipWaitingAndReload();
  }, []);

  return {
    ...state,
    canInstall: canInstall(),
    install,
    update,
  };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * useOfflineSync Hook — Offline Mutation Sync Notifications
 * ═══════════════════════════════════════════════════════════════════════════════
 */

interface SyncEvent {
  url: string;
  timestamp: number;
}

export function useOfflineSync(onSync?: (event: SyncEvent) => void): SyncEvent[] {
  const [syncedRequests, setSyncedRequests] = useState<SyncEvent[]>([]);

  useEffect(() => {
    const unsubscribe = onSyncMessage((data) => {
      const event: SyncEvent = {
        url: data.url,
        timestamp: Date.now(),
      };

      setSyncedRequests((prev) => [...prev, event]);
      onSync?.(event);
    });

    return unsubscribe;
  }, [onSync]);

  return syncedRequests;
}
