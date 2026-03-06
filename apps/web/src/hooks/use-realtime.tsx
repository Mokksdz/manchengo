'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { productionKeys } from './use-production';
import { createLogger } from '@/lib/logger';

const log = createLogger('Realtime');

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface RealtimeNotification {
  id: string;
  type: 'stock' | 'production' | 'delivery' | 'alert' | 'info';
  severity: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: string;
  data?: unknown;
  read: boolean;
}

interface StockAlertEvent {
  type: string;
  severity: string;
  title: string;
  message: string;
  timestamp: string;
}

interface ProductionUpdateEvent {
  orderId: string;
  status: string;
  productName: string;
  timestamp: string;
}

interface DeliveryValidatedEvent {
  deliveryId: string;
  reference: string;
  clientName: string;
  timestamp: string;
}

interface DashboardUpdateEvent {
  reason: string;
  timestamp: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOCKET CONNECTION SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let socket: Socket | null = null;
let connectionAttempts = 0;
const activeSubscriptions = new Set<string>();
let disconnectTimeout: ReturnType<typeof setTimeout> | null = null;
const MAX_RECONNECTION_ATTEMPTS = 5;
const DISCONNECT_DELAY_MS = 5000;

function getSocket(): Socket | null {
  // Don't connect when offline
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return null;
  }

  if (!socket) {
    // WebSocket connects directly to backend (not proxied by Next.js rewrites)
    // In browser without NEXT_PUBLIC_API_URL: use current origin for same-port, or fallback
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

    socket = io(`${backendUrl}/dashboard`, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: MAX_RECONNECTION_ATTEMPTS,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      auth: {
        token: (() => {
          try {
            return document.cookie
              .split('; ')
              .find((c) => c.startsWith('access_token=') || c.startsWith('__Host-access_token='))
              ?.split('=')
              .slice(1)
              .join('=') || '';
          } catch (e) {
            log.warn('[WebSocket] Failed to extract token from cookies', { error: e });
            return '';
          }
        })(),
      },
    });

    socket.on('connect', () => {
      log.debug('[WebSocket] Connected to dashboard gateway');
      connectionAttempts = 0;
    });

    socket.on('disconnect', (reason: string) => {
      log.debug('[WebSocket] Disconnected', { reason });
    });

    socket.on('connect_error', (error: Error) => {
      connectionAttempts++;
      log.warn('[WebSocket] Connection error', { error: error.message });

      if (connectionAttempts >= MAX_RECONNECTION_ATTEMPTS) {
        log.error('[WebSocket] Max reconnection attempts reached');
      }
    });
  }

  // Cancel any pending disconnect since a subscriber needs the socket
  if (disconnectTimeout) {
    clearTimeout(disconnectTimeout);
    disconnectTimeout = null;
  }

  return socket;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK: useRealtime
// ═══════════════════════════════════════════════════════════════════════════════

interface UseRealtimeOptions {
  onStockAlert?: (alert: StockAlertEvent) => void;
  onProductionUpdate?: (update: ProductionUpdateEvent) => void;
  onDeliveryValidated?: (delivery: DeliveryValidatedEvent) => void;
  onDashboardRefresh?: (event: DashboardUpdateEvent) => void;
  autoInvalidateQueries?: boolean;
}

export function useRealtime(options: UseRealtimeOptions = {}) {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Ajouter une notification
  const addNotification = useCallback((notification: Omit<RealtimeNotification, 'id' | 'read'>) => {
    const newNotification: RealtimeNotification = {
      ...notification,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      read: false,
    };

    setNotifications((prev) => [newNotification, ...prev].slice(0, 50)); // Garder max 50 notifications
    return newNotification;
  }, []);

  // Marquer une notification comme lue
  const markAsRead = useCallback((notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
  }, []);

  // Marquer toutes comme lues
  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  // Supprimer une notification
  const dismissNotification = useCallback((notificationId: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  }, []);

  // Effacer toutes les notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Setup WebSocket listeners
  useEffect(() => {
    const subscriptionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    activeSubscriptions.add(subscriptionId);

    let ws: Socket | null = null;
    let onlineHandler: (() => void) | null = null;

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    const handleStockAlert = (data: StockAlertEvent) => {
      addNotification({
        type: 'stock',
        severity: data.severity as RealtimeNotification['severity'],
        title: data.title,
        message: data.message,
        timestamp: data.timestamp,
        data,
      });

      optionsRef.current.onStockAlert?.(data);

      if (optionsRef.current.autoInvalidateQueries) {
        queryClient.invalidateQueries({ queryKey: ['stock'] });
        queryClient.invalidateQueries({ queryKey: ['appro', 'alerts'] });
      }
    };

    const handleProductionUpdate = (data: ProductionUpdateEvent) => {
      const severityMap: Record<string, RealtimeNotification['severity']> = {
        COMPLETED: 'success',
        IN_PROGRESS: 'info',
        CANCELLED: 'warning',
        PENDING: 'info',
      };

      addNotification({
        type: 'production',
        severity: severityMap[data.status] || 'info',
        title: `Production ${data.status === 'COMPLETED' ? 'terminée' : data.status === 'IN_PROGRESS' ? 'démarrée' : 'mise à jour'}`,
        message: `${data.productName} (${data.orderId})`,
        timestamp: data.timestamp,
        data,
      });

      optionsRef.current.onProductionUpdate?.(data);

      if (optionsRef.current.autoInvalidateQueries) {
        queryClient.invalidateQueries({ queryKey: productionKeys.orders() });
        queryClient.invalidateQueries({ queryKey: productionKeys.kpis() });
      }
    };

    const handleDeliveryValidated = (data: DeliveryValidatedEvent) => {
      addNotification({
        type: 'delivery',
        severity: 'success',
        title: 'Livraison validée',
        message: `${data.reference} - ${data.clientName}`,
        timestamp: data.timestamp,
        data,
      });

      optionsRef.current.onDeliveryValidated?.(data);

      if (optionsRef.current.autoInvalidateQueries) {
        queryClient.invalidateQueries({ queryKey: ['delivery'] });
      }
    };

    const handleDashboardUpdate = (data: DashboardUpdateEvent) => {
      optionsRef.current.onDashboardRefresh?.(data);

      if (optionsRef.current.autoInvalidateQueries) {
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['stock'] });
        queryClient.invalidateQueries({ queryKey: ['appro'] });
        queryClient.invalidateQueries({ queryKey: ['admin', 'stock'] });
      }
    };

    const attachListeners = (s: Socket) => {
      // Remove old listeners before attaching new ones to prevent duplicates
      s.off('connect', handleConnect);
      s.off('disconnect', handleDisconnect);
      s.off('stock:alert', handleStockAlert);
      s.off('production:update', handleProductionUpdate);
      s.off('delivery:validated', handleDeliveryValidated);
      s.off('dashboard:update', handleDashboardUpdate);

      s.on('connect', handleConnect);
      s.on('disconnect', handleDisconnect);
      s.on('stock:alert', handleStockAlert);
      s.on('production:update', handleProductionUpdate);
      s.on('delivery:validated', handleDeliveryValidated);
      s.on('dashboard:update', handleDashboardUpdate);

      setIsConnected(s.connected);
    };

    ws = getSocket();

    if (ws) {
      attachListeners(ws);
    } else if (typeof window !== 'undefined') {
      // Offline: wait for online event then connect
      onlineHandler = () => {
        ws = getSocket();
        if (ws) attachListeners(ws);
      };
      window.addEventListener('online', onlineHandler, { once: true });
    }

    // Cleanup
    return () => {
      if (onlineHandler) {
        window.removeEventListener('online', onlineHandler);
      }

      if (ws) {
        ws.off('connect', handleConnect);
        ws.off('disconnect', handleDisconnect);
        ws.off('stock:alert', handleStockAlert);
        ws.off('production:update', handleProductionUpdate);
        ws.off('delivery:validated', handleDeliveryValidated);
        ws.off('dashboard:update', handleDashboardUpdate);
      }

      // Remove from set and schedule disconnect with safety delay
      activeSubscriptions.delete(subscriptionId);
      if (activeSubscriptions.size === 0) {
        disconnectTimeout = setTimeout(() => {
          if (activeSubscriptions.size === 0 && socket) {
            socket.disconnect();
            socket = null;
          }
        }, DISCONNECT_DELAY_MS);
      }
    };
  }, [queryClient, addNotification]);

  return {
    isConnected,
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
    addNotification,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    clearAll,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK: useRealtimeNotifications (Composant UI)
// ═══════════════════════════════════════════════════════════════════════════════

export function useRealtimeNotifications() {
  return useRealtime({
    autoInvalidateQueries: true,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT: NotificationBadge
// ═══════════════════════════════════════════════════════════════════════════════

export function NotificationBadge({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#FF3B30] text-white text-[11px] font-bold rounded-full flex items-center justify-center animate-pulse">
      {count > 9 ? '9+' : count}
    </span>
  );
}
