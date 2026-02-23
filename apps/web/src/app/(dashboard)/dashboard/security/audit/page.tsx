'use client';

import { useState, useEffect, useMemo } from 'react';
import { authFetch } from '@/lib/api';
import { useRequireRole } from '@/lib/hooks/use-require-role';
import {
  FileText,
  RefreshCw,
  CheckCircle,
  XCircle,
  LogIn,
  LogOut,
  Smartphone,
  UserX,
  UserCheck,
  Shield,
  AlertCircle,
} from 'lucide-react';
import { SkeletonTable } from '@/components/ui/skeleton-loader';
import { ResponsiveTable, Column } from '@/components/ui/responsive-table';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';

/**
 * Security Audit Logs Page
 *
 * Admin-only page for viewing security event logs:
 * - Login attempts (success/failure)
 * - Device registrations/revocations
 * - User blocks/unblocks
 * - Role changes
 * - Sync operations
 */

interface SecurityLog {
  id: string;
  action: string;
  userId: string | null;
  targetId: string | null;
  deviceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  details: Record<string, unknown> | null;
  success: boolean;
  createdAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const actionLabels: Record<string, { label: string; icon: any; color: string }> = {
  LOGIN_SUCCESS: { label: 'Connexion réussie', icon: LogIn, color: 'text-[#34C759]' },
  LOGIN_FAILURE: { label: 'Échec connexion', icon: LogIn, color: 'text-[#FF3B30]' },
  LOGOUT: { label: 'Déconnexion', icon: LogOut, color: 'text-[#86868B]' },
  DEVICE_REGISTER: { label: 'Appareil enregistré', icon: Smartphone, color: 'text-[#007AFF]' },
  DEVICE_REVOKE: { label: 'Appareil révoqué', icon: Smartphone, color: 'text-[#FF3B30]' },
  USER_BLOCK: { label: 'Utilisateur bloqué', icon: UserX, color: 'text-[#FF3B30]' },
  USER_UNBLOCK: { label: 'Utilisateur débloqué', icon: UserCheck, color: 'text-[#34C759]' },
  ROLE_CHANGE: { label: 'Rôle modifié', icon: Shield, color: 'text-[#AF52DE]' },
  SYNC_PUSH: { label: 'Sync Push', icon: RefreshCw, color: 'text-[#007AFF]' },
  SYNC_PULL: { label: 'Sync Pull', icon: RefreshCw, color: 'text-[#007AFF]' },
  ACCESS_DENIED: { label: 'Accès refusé', icon: XCircle, color: 'text-[#FF3B30]' },
};

export default function SecurityAuditPage() {
  const { hasAccess, isAccessDenied } = useRequireRole(['ADMIN']);
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 25;

  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = async (page = currentPage) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (actionFilter) params.set('action', actionFilter);
      params.set('limit', String(ITEMS_PER_PAGE));
      params.set('page', String(page));

      // Server-side pagination: backend returns only the requested page
      const res = await authFetch(`/admin/security-logs?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch logs');
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    fetchLogs(1);
  }, [actionFilter]);

  useEffect(() => {
    fetchLogs(currentPage);
  }, [currentPage]);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getActionInfo = (action: string) => {
    return actionLabels[action] || { label: action, icon: FileText, color: 'text-[#6E6E73]' };
  };

  // Server-side pagination: logs already contains only the current page
  const paginatedLogs = logs;

  // Column definitions for ResponsiveTable
  const auditColumns: Column<SecurityLog>[] = useMemo(() => [
    {
      key: 'date',
      header: 'Date/Heure',
      className: 'text-left',
      mobileHidden: true, // shown in mobileCardTitle
      render: (log) => (
        <span className="whitespace-nowrap text-sm text-[#86868B]">{formatDate(log.createdAt)}</span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      className: 'text-left',
      mobileHidden: true, // shown in mobileCardTitle
      render: (log) => {
        const actionInfo = getActionInfo(log.action);
        const ActionIcon = actionInfo.icon;
        return (
          <span className={`flex items-center gap-2 text-sm ${actionInfo.color}`}>
            <ActionIcon className="h-4 w-4" />
            {actionInfo.label}
          </span>
        );
      },
    },
    {
      key: 'user',
      header: 'Utilisateur',
      className: 'text-left',
      render: (log) => (
        <span className="whitespace-nowrap text-sm text-[#6E6E73]">
          {log.userId ? (
            <span className="font-mono text-xs">{log.userId.slice(0, 8)}...</span>
          ) : (
            <span className="text-[#AEAEB2]">-</span>
          )}
        </span>
      ),
    },
    {
      key: 'device',
      header: 'Appareil',
      className: 'text-left',
      mobileHidden: true,
      render: (log) => (
        <span className="whitespace-nowrap text-sm text-[#6E6E73]">
          {log.deviceId ? (
            <span className="font-mono text-xs">{log.deviceId.slice(0, 8)}...</span>
          ) : (
            <span className="text-[#AEAEB2]">-</span>
          )}
        </span>
      ),
    },
    {
      key: 'ip',
      header: 'IP',
      className: 'text-left',
      render: (log) => (
        <span className="whitespace-nowrap text-sm text-[#6E6E73]">
          {log.ipAddress || <span className="text-[#AEAEB2]">-</span>}
        </span>
      ),
    },
    {
      key: 'details',
      header: 'Détails',
      className: 'text-left',
      mobileHidden: true,
      render: (log) => (
        <span className="text-sm text-[#6E6E73] max-w-xs truncate block">
          {log.details ? (
            <span className="font-mono text-xs">{JSON.stringify(log.details).slice(0, 50)}...</span>
          ) : (
            <span className="text-[#AEAEB2]">-</span>
          )}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Statut',
      className: 'text-center',
      mobileHidden: true, // shown as mobileCardBadge
      render: (log) => (
        <div className="text-center">
          {log.success ? (
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#34C759]/10 mx-auto">
              <CheckCircle className="h-4 w-4 text-[#34C759]" />
            </span>
          ) : (
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#FF3B30]/10 mx-auto">
              <XCircle className="h-4 w-4 text-[#FF3B30]" />
            </span>
          )}
        </div>
      ),
    },
  ], []);

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-64">
        {isAccessDenied ? (
          <div className="text-center">
            <Shield className="w-12 h-12 text-[#FF3B30]/60 mx-auto mb-3" />
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
      <PageHeader
        title="Journal de Sécurité"
        subtitle={`${total} événement${total !== 1 ? 's' : ''} au total`}
        icon={<FileText className="w-5 h-5" />}
        actions={
          <div className="flex items-center gap-2">
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setCurrentPage(1); }}
              className="px-4 py-2.5 border border-black/[0.04] rounded-full text-sm bg-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#FF9500]/20 focus:border-[#FF9500] transition-all"
            >
              <option value="">Tous les événements</option>
              <option value="LOGIN_SUCCESS">Connexions réussies</option>
              <option value="LOGIN_FAILURE">Échecs de connexion</option>
              <option value="DEVICE_REGISTER">Enregistrements appareils</option>
              <option value="DEVICE_REVOKE">Révocations appareils</option>
              <option value="USER_BLOCK">Blocages utilisateurs</option>
              <option value="USER_UNBLOCK">Déblocages utilisateurs</option>
              <option value="ROLE_CHANGE">Changements de rôle</option>
              <option value="ACCESS_DENIED">Accès refusés</option>
            </select>
            <Button onClick={() => fetchLogs()} disabled={loading} variant="outline">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
          </div>
        }
      />

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-[#FF3B30]/10 border border-[#FF3B30]/20 rounded-[28px] text-sm font-medium text-[#FF3B30]">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Logs Table */}
      {loading ? (
        <div className="glass-card overflow-hidden">
          <SkeletonTable rows={8} columns={7} />
        </div>
      ) : (
        <>
          <ResponsiveTable<SecurityLog>
            columns={auditColumns}
            data={paginatedLogs}
            keyExtractor={(log) => log.id}
            emptyMessage="Aucun événement"
            theadClassName="bg-white/40 backdrop-blur-sm border-b border-black/[0.04]"
            tbodyClassName="divide-y divide-black/[0.04]"
            rowClassName={(log) => !log.success ? 'bg-[#FF3B30]/5' : ''}
            cardClassName={(log) => !log.success ? 'border-l-4 border-l-[#FF3B30] bg-[#FF3B30]/5' : ''}
            mobileCardTitle={(log) => {
              const actionInfo = getActionInfo(log.action);
              const ActionIcon = actionInfo.icon;
              return (
                <div>
                  <span className={`flex items-center gap-2 text-sm font-medium ${actionInfo.color}`}>
                    <ActionIcon className="h-4 w-4" />
                    {actionInfo.label}
                  </span>
                  <p className="text-xs text-[#86868B] mt-1">{formatDate(log.createdAt)}</p>
                </div>
              );
            }}
            mobileCardBadge={(log) => (
              log.success ? (
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#34C759]/10">
                  <CheckCircle className="h-4 w-4 text-[#34C759]" />
                </span>
              ) : (
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#FF3B30]/10">
                  <XCircle className="h-4 w-4 text-[#FF3B30]" />
                </span>
              )
            )}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination
              page={currentPage}
              totalPages={totalPages}
              total={total}
              onPageChange={setCurrentPage}
            />
          )}
        </>
      )}

      {/* Legend */}
      <div className="glass-card p-5">
        <h3 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight mb-3 flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#FF9500]/10 to-[#FF9500]/5 flex items-center justify-center">
            <Shield className="w-3 h-3 text-[#FF9500]" />
          </div>
          Légende
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          {Object.entries(actionLabels).map(([key, { label, color }]) => (
            <div key={key} className={`flex items-center gap-1.5 ${color}`}>
              <div className="w-1.5 h-1.5 rounded-full bg-current" />
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
