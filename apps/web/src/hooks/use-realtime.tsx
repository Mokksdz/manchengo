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
const MAX_RECONNECTION_ATTEMPTS = 5;

function getSocket(): Socket {
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
        token: document.cookie
          .split('; ')
          .find((c) => c.startsWith('access_token=') || c.startsWith('__Host-access_token='))
          ?.split('=')
          .slice(1)
          .join('=') || '',
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
    const ws = getSocket();

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

    // Attach listeners
    ws.on('connect', handleConnect);
    ws.on('disconnect', handleDisconnect);
    ws.on('stock:alert', handleStockAlert);
    ws.on('production:update', handleProductionUpdate);
    ws.on('delivery:validated', handleDeliveryValidated);
    ws.on('dashboard:update', handleDashboardUpdate);

    // Check initial connection state
    setIsConnected(ws.connected);

    // Cleanup
    return () => {
      ws.off('connect', handleConnect);
      ws.off('disconnect', handleDisconnect);
      ws.off('stock:alert', handleStockAlert);
      ws.off('production:update', handleProductionUpdate);
      ws.off('delivery:validated', handleDeliveryValidated);
      ws.off('dashboard:update', handleDashboardUpdate);

      // Disconnect socket if no more listeners are attached
      if (ws.listeners('stock:alert').length === 0 &&
          ws.listeners('production:update').length === 0 &&
          ws.listeners('delivery:validated').length === 0 &&
          ws.listeners('dashboard:update').length === 0) {
        ws.disconnect();
        socket = null;
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
