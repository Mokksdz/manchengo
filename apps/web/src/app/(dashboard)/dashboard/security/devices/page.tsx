'use client';

import { useState, useEffect } from 'react';
import { authFetch } from '@/lib/api';
import { useRequireRole } from '@/lib/hooks/use-require-role';
import {
  Smartphone,
  Shield,
  ShieldOff,
  RefreshCw,
  Clock,
  User,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton-loader';

/**
 * Device Management Page
 *
 * Admin-only page for managing mobile devices:
 * - View all registered devices
 * - See last sync time
 * - Revoke/reactivate devices
 */

interface Device {
  id: string;
  name: string;
  platform: string;
  appVersion: string | null;
  lastSyncAt: string | null;
  isActive: boolean;
  registeredAt: string;
  user: {
    id: string;
    code: string;
    firstName: string;
    lastName: string;
    role: string;
    isActive: boolean;
  };
}

export default function DevicesManagementPage() {
  const { hasAccess, isAccessDenied } = useRequireRole(['ADMIN']);
  const [devices, setDevices] = useState<Device[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'revoked'>('all');

  const fetchDevices = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/admin/devices', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch devices');
      const data = await res.json();
      // A5: Backend returns array directly, apply client-side filter (A11)
      const allDevices: Device[] = Array.isArray(data) ? data : data.devices || [];
      const filtered = filter === 'all'
        ? allDevices
        : filter === 'active'
          ? allDevices.filter(d => d.isActive)
          : allDevices.filter(d => !d.isActive);
      setDevices(filtered);
      setTotal(allDevices.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading devices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, [filter]);

  const handleRevokeDevice = async (deviceId: string, revoke: boolean) => {
    setActionLoading(deviceId);
    try {
      const endpoint = revoke ? 'revoke' : 'reactivate';
      await authFetch(`/admin/devices/${deviceId}/${endpoint}`, {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ reason: revoke ? 'Admin action' : undefined }),
      });
      await fetchDevices();
    } catch {
      setError('Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const getTimeSince = (date: string | null) => {
    if (!date) return null;
    const diff = Date.now() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Il y a moins d\'une heure';
    if (hours < 24) return `Il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Il y a ${days}j`;
  };

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-64">
        {isAccessDenied ? (
          <div className="text-center glass-card p-8">
            <ShieldOff className="w-12 h-12 text-[#FF3B30]/40 mx-auto mb-3" />
            <p className="text-lg font-semibold text-[#1D1D1F]">Accès interdit</p>
            <p className="text-sm text-[#86868B] mt-1">Redirection vers le dashboard...</p>
          </div>
        ) : (
          <div className="w-8 h-8 border-[3px] border-[#FF3B30]/20 border-t-[#FF3B30] rounded-full animate-spin" />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#007AFF]/20 to-[#007AFF]/10 flex items-center justify-center shadow-lg shadow-[#007AFF]/10">
              <Smartphone className="w-6 h-6 text-[#007AFF]" />
            </div>
            <div>
              <h1 className="text-[22px] font-bold text-[#1D1D1F] tracking-tight">Gestion des Appareils</h1>
              <p className="text-[13px] text-[#86868B]">{total} appareil{total !== 1 ? 's' : ''} enregistré{total !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 p-1 glass-card rounded-full">
              {(['all', 'active', 'revoked'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={filter === f
                    ? 'px-4 py-2 rounded-full text-sm font-semibold bg-[#007AFF] text-white shadow-sm transition-all'
                    : 'px-4 py-2 rounded-full text-sm font-medium text-[#86868B] hover:text-[#1D1D1F] hover:bg-white/60 transition-all'
                  }
                >
                  {f === 'all' ? 'Tous' : f === 'active' ? 'Actifs' : 'Révoqués'}
                </button>
              ))}
            </div>
            <button
              onClick={fetchDevices}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-black/5 text-[#1D1D1F] rounded-full hover:bg-black/10 transition-all font-medium"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-[#FF3B30]/10 border border-[#FF3B30]/20 rounded-2xl text-sm font-medium text-[#FF3B30]">
          <ShieldOff className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Devices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="glass-card p-5 animate-fade-in">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-xl" />
                    <div>
                      <Skeleton className="h-4 w-28 mb-1" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-12 rounded-full" />
                </div>
                <Skeleton className="h-6 w-full rounded-lg mb-3" />
                <Skeleton className="h-4 w-40 mb-2" />
                <Skeleton className="h-4 w-32 mb-4" />
                <div className="border-t border-black/[0.04] pt-3 flex justify-end">
                  <Skeleton className="h-7 w-20 rounded-full" />
                </div>
              </div>
            ))}
          </>
        ) : devices.length === 0 ? (
          <div className="col-span-full glass-card p-16 text-center">
            <Smartphone className="w-12 h-12 text-[#86868B]/40 mx-auto mb-3" />
            <p className="text-[#86868B] font-medium">Aucun appareil</p>
          </div>
        ) : (
          devices.map((device) => (
            <div
              key={device.id}
              className={`glass-card p-5 transition-all hover:shadow-lg ${
                !device.isActive ? 'ring-1 ring-[#FF3B30]/20' : ''
              }`}
            >
              {/* Device Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    device.isActive
                      ? 'bg-gradient-to-br from-[#34C759]/20 to-[#34C759]/10'
                      : 'bg-gradient-to-br from-[#FF3B30]/20 to-[#FF3B30]/10'
                  }`}>
                    <Smartphone className={`h-5 w-5 ${device.isActive ? 'text-[#34C759]' : 'text-[#FF3B30]'}`} />
                  </div>
                  <div>
                    <div className="font-semibold text-[#1D1D1F]">{device.name}</div>
                    <div className="text-[11px] text-[#86868B]">{device.platform}</div>
                  </div>
                </div>
                {device.isActive ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#34C759]/10 text-[#34C759]">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#34C759] animate-pulse" />
                    Actif
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FF3B30]/10 text-[#FF3B30]">
                    Révoqué
                  </span>
                )}
              </div>

              {/* Device ID */}
              <div className="text-[10px] text-[#AEAEB2] font-mono mb-3 truncate px-2 py-1 bg-black/[0.02] rounded-lg">
                {device.id}
              </div>

              {/* User Info */}
              <div className="flex items-center gap-2 mb-2 text-sm">
                <User className="h-4 w-4 text-[#86868B]" />
                <span className={`font-medium ${!device.user.isActive ? 'text-[#FF3B30]' : 'text-[#1D1D1F]'}`}>
                  {device.user.firstName} {device.user.lastName}
                </span>
                <span className="text-[11px] text-[#86868B]">({device.user.code})</span>
              </div>

              {/* Last Sync */}
              <div className="flex items-center gap-2 mb-4 text-[13px] text-[#86868B]">
                <Clock className="h-3.5 w-3.5" />
                <span>Dernière sync: {getTimeSince(device.lastSyncAt) || 'Jamais'}</span>
              </div>

              {/* Actions */}
              <div className="flex justify-end pt-3 border-t border-black/[0.04]">
                {device.isActive ? (
                  <button
                    onClick={() => handleRevokeDevice(device.id, true)}
                    disabled={actionLoading === device.id}
                    className="px-4 py-1.5 text-[11px] font-semibold text-[#FF3B30] bg-[#FF3B30]/10 rounded-full hover:bg-[#FF3B30]/20 transition-all disabled:opacity-50"
                  >
                    Révoquer
                  </button>
                ) : (
                  <button
                    onClick={() => handleRevokeDevice(device.id, false)}
                    disabled={actionLoading === device.id}
                    className="px-4 py-1.5 text-[11px] font-semibold text-[#34C759] bg-[#34C759]/10 rounded-full hover:bg-[#34C759]/20 transition-all disabled:opacity-50"
                  >
                    Réactiver
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
