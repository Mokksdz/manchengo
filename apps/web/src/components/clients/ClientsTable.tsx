'use client';

import { cn } from '@/lib/utils';
import {
  Users, Phone, MapPin, FileText, Pencil, Trash2, History,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton-loader';
import { type Client, typeConfig } from './types';

interface ClientsTableProps {
  clients: Client[];
  isLoading: boolean;
  onEdit: (client: Client) => void;
  onDelete?: (client: Client) => void;
  onHistory: (client: Client) => void;
}

export function ClientsTable({
  clients,
  isLoading,
  onEdit,
  onDelete,
  onHistory,
}: ClientsTableProps) {
  if (isLoading) {
    return (
      <div className="glass-bg space-y-6 animate-fade-in">
        <Skeleton className="h-10 w-72 rounded-full" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card rounded-2xl border border-black/[0.04] bg-white/60 p-5 flex items-center gap-5">
              <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <div className="space-y-2 text-right">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-44" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <table className="w-full">
        <thead className="bg-white/40 backdrop-blur-sm border-b border-black/[0.04]">
          <tr>
            <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Code</th>
            <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Client</th>
            <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Type</th>
            <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Contact</th>
            <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Factures</th>
            <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F0F0F0]">
          {clients.map((client) => {
            const type = typeConfig[client.type];
            return (
              <tr key={client.id} className="group hover:bg-white/60 transition-colors">
                <td className="px-5 py-4 text-[14px] text-[#1D1D1F] font-mono font-medium text-[#6E6E73]">
                  {client.code}
                </td>
                <td className="px-5 py-4 text-[14px] text-[#1D1D1F]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-[#007AFF]/10 to-[#007AFF]/5 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-[#007AFF]">
                        {client.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium text-[#1D1D1F]">{client.name}</span>
                      {client.nif && client.nif !== '' && (
                        <p className="text-[11px] text-[#86868B]">NIF: {client.nif}</p>
                      )}
                      {client.rc && client.rc !== '' && (
                        <p className="text-[11px] text-[#AEAEB2]">RC: {client.rc}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-[14px] text-[#1D1D1F]">
                  <span className={cn('inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold', type.color)}>
                    {type.label}
                  </span>
                </td>
                <td className="px-5 py-4 text-[14px] text-[#1D1D1F]">
                  <div className="space-y-1">
                    {client.phone && (
                      <div className="flex items-center gap-1 text-sm text-[#6E6E73]">
                        <Phone className="w-3 h-3" />
                        {client.phone}
                      </div>
                    )}
                    {client.address && (
                      <div className="flex items-center gap-1 text-sm text-[#86868B]">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate max-w-[200px]">{client.address}</span>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-5 py-4 text-[14px] text-[#1D1D1F] text-right">
                  <div className="flex items-center justify-end gap-1 text-sm text-[#86868B]">
                    <FileText className="w-4 h-4" />
                    {client._count?.invoices || 0}
                  </div>
                </td>
                <td className="px-5 py-4 text-[14px] text-[#1D1D1F] text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onHistory(client)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-[#007AFF] bg-[#007AFF]/10 rounded-full hover:bg-[#007AFF]/20 transition-all"
                      title="Historique"
                    >
                      <History className="w-3 h-3" />
                      Historique
                    </button>
                    <button
                      onClick={() => onEdit(client)}
                      className="p-2 rounded-xl text-[#86868B] hover:text-[#007AFF] hover:bg-[#007AFF]/10 transition-all"
                      title="Modifier"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {onDelete && (
                      <button
                        onClick={() => onDelete(client)}
                        className="p-2 rounded-xl text-[#86868B] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 transition-all"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {clients.length === 0 && (
            <tr>
              <td colSpan={6} className="px-6 py-16 text-center">
                <div className="glass-empty">
                  <Users className="w-12 h-12 text-[#86868B]/40 mx-auto mb-3" />
                  <p className="text-[#86868B] font-medium">Aucun client trouv\u00e9</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
