/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PWA UTILITIES — Service Worker & Install Prompt
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { createLogger } from '@/lib/logger';

const log = createLogger('PWA');

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE WORKER REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════════

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    log.debug('[PWA] Service Workers not supported');
    return null;
  }

  // Skip SW registration in development — it causes stale cache / 503 errors with HMR
  if (process.env.NODE_ENV === 'development') {
    // Unregister any existing SW from a previous session
    const existingRegs = await navigator.serviceWorker.getRegistrations();
    for (const reg of existingRegs) {
      await reg.unregister();
      log.debug('[PWA] Unregistered stale dev SW');
    }
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });

    log.debug('[PWA] Service Worker registered', { scope: registration.scope });

    // Check for updates periodically
    setInterval(() => {
      registration.update();
    }, 60 * 60 * 1000); // Every hour

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New version available
          dispatchPWAEvent('update-available', { registration });
        }
      });
    });

    return registration;
  } catch (error) {
    log.error('[PWA] Service Worker registration failed', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UPDATE HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

export function skipWaitingAndReload(): void {
  navigator.serviceWorker.getRegistration().then((registration) => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  });

  // Reload after the new service worker takes over, but check for unsaved work
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const activeElement = document.activeElement;
    const hasUnsavedInput = activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLTextAreaElement;

    if (hasUnsavedInput) {
      dispatchPWAEvent('update-ready', {
        message: 'Une mise à jour est disponible. Rechargez quand vous êtes prêt.',
      });
    } else {
      window.location.reload();
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// INSTALL PROMPT (A2HS)
// ═══════════════════════════════════════════════════════════════════════════════

let deferredPrompt: BeforeInstallPromptEvent | null = null;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function initInstallPrompt(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    dispatchPWAEvent('install-available', {});
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    dispatchPWAEvent('installed', {});
    log.debug('[PWA] App installed successfully');
  });
}

export function canInstall(): boolean {
  return deferredPrompt !== null;
}

export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;

  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;

  if (outcome === 'accepted') {
    log.debug('[PWA] User accepted install prompt');
    deferredPrompt = null;
    return true;
  }

  log.debug('[PWA] User dismissed install prompt');
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ONLINE/OFFLINE DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export function onOnlineStatusChange(callback: (online: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  return Notification.requestPermission();
}

export async function subscribeToPush(
  registration: ServiceWorkerRegistration,
  vapidPublicKey: string
): Promise<PushSubscription | null> {
  try {
    const keyArray = urlBase64ToUint8Array(vapidPublicKey);
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyArray as BufferSource,
    });

    log.debug('[PWA] Push subscription', { endpoint: subscription.endpoint });
    return subscription;
  } catch (error) {
    log.error('[PWA] Push subscription failed', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYNC MESSAGE HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function onSyncMessage(callback: (data: any) => void): () => void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return () => {}; // eslint-disable-line @typescript-eslint/no-empty-function
  }

  const handler = (event: MessageEvent) => {
    if (event.data?.type === 'SYNC_SUCCESS') {
      callback(event.data);
    }
  };

  navigator.serviceWorker.addEventListener('message', handler);

  return () => {
    navigator.serviceWorker.removeEventListener('message', handler);
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dispatchPWAEvent(type: string, detail: any): void {
  window.dispatchEvent(new CustomEvent(`pwa:${type}`, { detail }));
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DISPLAY MODE DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

export function isInstalledPWA(): boolean {
  if (typeof window === 'undefined') return false;

  // Check display-mode media query
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  // iOS Safari check
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isIOS = (window.navigator as any).standalone === true;

  return isStandalone || isIOS;
}
