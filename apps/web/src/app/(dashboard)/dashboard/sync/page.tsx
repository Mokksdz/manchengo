'use client';

import { useEffect, useState } from 'react';
import { dashboard, DeviceSyncStatus, SyncEvent } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';
import { RefreshCw, Smartphone, Activity, Clock, CheckCircle, Wifi, WifiOff } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton-loader';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';

export default function SyncPage() {
  const [devices, setDevices] = useState<DeviceSyncStatus[]>([]);
  const [events, setEvents] = useState<SyncEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [devicesData, eventsData] = await Promise.all([
        dashboard.getSyncStatus(),
        dashboard.getRecentEvents(50),
      ]);
      setDevices(devicesData);
      setEvents(eventsData);
    } catch (error) {
      console.error('Failed to load sync data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const refresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const activeDevices = devices.filter(d => d.isActive && d.lastSyncAt);
  const todayEvents = events.filter(e => {
    const eventDate = new Date(e.occurredAt);
    const today = new Date();
    return eventDate.toDateString() === today.toDateString();
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header skeleton */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="w-12 h-12 rounded-2xl" />
            <div>
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </div>
        {/* Stats skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass-card p-4 flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <div>
                <Skeleton className="h-6 w-12 mb-1" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          ))}
        </div>
        {/* Content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="glass-card p-6">
              <Skeleton className="h-5 w-32 mb-4" />
              {[...Array(4)].map((_, j) => (
                <div key={j} className="flex items-center gap-4 mb-3">
                  <Skeleton className="w-10 h-10 rounded-xl" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-full mb-1" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <PageHeader
        title="Synchronisation"
        subtitle="État des appareils et événements récents"
        icon={<RefreshCw className="w-5 h-5" />}
        actions={
          <Button onClick={refresh} disabled={isRefreshing} variant="outline">
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Rafraîchir
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#34C759]/10 to-[#34C759]/5 flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-[#34C759]" />
          </div>
          <div>
            <p className="text-[22px] font-semibold text-[#1D1D1F] tracking-tight">{activeDevices.length}</p>
            <p className="text-[11px] font-medium text-[#86868B] uppercase tracking-wider">Appareils connectés</p>
            <p className="text-[11px] text-[#AEAEB2]">sur {devices.length} enregistrés</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#007AFF]/10 to-[#007AFF]/5 flex items-center justify-center">
            <Activity className="w-5 h-5 text-[#007AFF]" />
          </div>
          <div>
            <p className="text-[22px] font-semibold text-[#1D1D1F] tracking-tight">{todayEvents.length}</p>
            <p className="text-[11px] font-medium text-[#86868B] uppercase tracking-wider">Événements aujourd'hui</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#AF52DE]/10 to-[#AF52DE]/5 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-[#AF52DE]" />
          </div>
          <div>
            <p className="text-[22px] font-semibold text-[#1D1D1F] tracking-tight">{events.length}</p>
            <p className="text-[11px] font-medium text-[#86868B] uppercase tracking-wider">Total événements</p>
            <p className="text-[11px] text-[#AEAEB2]">dernières 24h</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Devices */}
        <div className="glass-card overflow-hidden">
          <div className="px-6 py-4 border-b border-black/[0.04] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#007AFF]/10 to-[#007AFF]/5 flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-[#007AFF]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#1D1D1F]">Appareils</h3>
              <p className="text-[11px] text-[#86868B]">{devices.length} enregistrés</p>
            </div>
          </div>
          <div className="divide-y divide-black/[0.04]">
            {devices.map((device) => {
              const isOnline = device.isActive && device.lastSyncAt;
              return (
                <div key={device.id} className="px-6 py-4 hover:bg-white/60 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isOnline ? 'bg-gradient-to-br from-[#34C759]/20 to-[#34C759]/10' : 'bg-black/5'}`}>
                        {isOnline ? (
                          <Wifi className="w-5 h-5 text-[#34C759]" />
                        ) : (
                          <WifiOff className="w-5 h-5 text-[#86868B]" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-[#1D1D1F]">{device.name}</p>
                        <p className="text-sm text-[#86868B]">
                          {device.user.firstName} {device.user.lastName} • {device.platform}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${isOnline ? 'bg-[#34C759]/10 text-[#34C759]' : 'bg-black/5 text-[#86868B]'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-[#34C759]' : 'bg-[#86868B]'}`} />
                        {isOnline ? 'En ligne' : 'Hors ligne'}
                      </div>
                      <p className="text-xs text-[#86868B] mt-1 flex items-center justify-end gap-1">
                        <Clock className="w-3 h-3" />
                        {device.lastSyncAt ? formatRelativeTime(device.lastSyncAt) : 'Jamais'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            {devices.length === 0 && (
              <div className="px-6 py-12 text-center text-[#86868B]">
                <Smartphone className="w-12 h-12 mx-auto mb-3 text-[#86868B]/40" />
                <p>Aucun appareil enregistré</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Events */}
        <div className="glass-card overflow-hidden">
          <div className="px-6 py-4 border-b border-black/[0.04] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#34C759]/10 to-[#34C759]/5 flex items-center justify-center">
              <Activity className="w-4 h-4 text-[#34C759]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#1D1D1F]">Événements récents</h3>
              <p className="text-[11px] text-[#86868B]">Activité de synchronisation</p>
            </div>
          </div>
          <div className="divide-y divide-black/[0.04] max-h-[400px] overflow-y-auto">
            {events.map((event) => (
              <div key={event.id} className="px-6 py-4 hover:bg-white/60 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#34C759]/20 to-[#34C759]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-5 h-5 text-[#34C759]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[#1D1D1F]">{event.action}</p>
                    <p className="text-sm text-[#86868B] truncate">
                      {event.entityType} #{event.entityId}
                    </p>
                    <p className="text-xs text-[#AEAEB2] mt-1">
                      {formatRelativeTime(event.occurredAt)}
                      {event.device && <span className="ml-2 px-2 py-0.5 bg-black/5 rounded-full">{event.device.name}</span>}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {events.length === 0 && (
              <div className="px-6 py-12 text-center text-[#86868B]">
                <Activity className="w-12 h-12 mx-auto mb-3 text-[#86868B]/40" />
                <p>Aucun événement récent</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
