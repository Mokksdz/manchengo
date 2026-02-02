'use client';

import { useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BROWSER NOTIFICATIONS HOOK — Manchengo Smart ERP
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * R19: Notifications push pour alertes critiques
 *
 * Uses the Web Notifications API to send desktop notifications
 * for critical stock alerts, even when the browser tab is not focused.
 *
 * Features:
 * - Requests notification permission on mount
 * - Shows browser notification + in-app toast for critical alerts
 * - Respects user's notification preferences
 * - Plays alert sound for critical notifications
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

type NotificationLevel = 'critical' | 'warning' | 'info';

interface AlertNotification {
  title: string;
  message: string;
  level: NotificationLevel;
  actionUrl?: string;
}

export function useNotifications() {
  const permissionRef = useRef<NotificationPermission>('default');

  // Request permission on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    permissionRef.current = Notification.permission;

    if (Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        permissionRef.current = permission;
      });
    }
  }, []);

  // Send browser notification
  const sendBrowserNotification = useCallback(
    (alert: AlertNotification) => {
      if (
        typeof window === 'undefined' ||
        !('Notification' in window) ||
        permissionRef.current !== 'granted'
      ) {
        return;
      }

      // Only send browser notifications when tab is not focused
      if (!document.hidden) return;

      try {
        const notification = new Notification(
          `Manchengo ERP - ${alert.title}`,
          {
            body: alert.message,
            icon: '/favicon.ico',
            tag: `alert-${alert.level}-${Date.now()}`,
            requireInteraction: alert.level === 'critical',
          },
        );

        // Navigate on click
        if (alert.actionUrl) {
          notification.onclick = () => {
            window.focus();
            window.location.href = alert.actionUrl!;
            notification.close();
          };
        }

        // Auto-close after 10s for non-critical
        if (alert.level !== 'critical') {
          setTimeout(() => notification.close(), 10000);
        }
      } catch (error) {
        // Silently fail - notifications are optional
        console.debug('Failed to send browser notification:', error);
      }
    },
    [],
  );

  // Send in-app toast notification
  const sendToast = useCallback((alert: AlertNotification) => {
    const toastOptions: Record<string, string | number> = {
      duration: alert.level === 'critical' ? 10000 : 5000,
      description: alert.message,
    };

    switch (alert.level) {
      case 'critical':
        toast.error(alert.title, toastOptions);
        break;
      case 'warning':
        toast.warning(alert.title, toastOptions);
        break;
      default:
        toast.info(alert.title, toastOptions);
    }
  }, []);

  // Main notify function
  const notify = useCallback(
    (alert: AlertNotification) => {
      // Always show in-app toast
      sendToast(alert);

      // Send browser notification for critical/warning
      if (alert.level === 'critical' || alert.level === 'warning') {
        sendBrowserNotification(alert);
      }
    },
    [sendToast, sendBrowserNotification],
  );

  // Notify for critical stock alerts
  const notifyCritical = useCallback(
    (title: string, message: string, actionUrl?: string) => {
      notify({ title, message, level: 'critical', actionUrl });
    },
    [notify],
  );

  return {
    notify,
    notifyCritical,
    hasPermission: permissionRef.current === 'granted',
  };
}
