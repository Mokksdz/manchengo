'use client';

import type React from 'react';
import { Users, Building2, Search } from 'lucide-react';
import { KeyboardHint } from '@/components/ui/keyboard-hint';
import { type Client } from './types';

type TabKey = 'all' | 'DISTRIBUTEUR' | 'GROSSISTE' | 'SUPERETTE' | 'FAST_FOOD';

interface ClientStats {
  total: number;
  distributeurs: number;
  grossistes: number;
  superettes: number;
  fastFood: number;
}

interface ClientFiltersProps {
  clients: Client[];
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement>;
}

function computeStats(clients: Client[]): ClientStats {
  return {
    total: clients.length,
    distributeurs: clients.filter((c) => c.type === 'DISTRIBUTEUR').length,
    grossistes: clients.filter((c) => c.type === 'GROSSISTE').length,
    superettes: clients.filter((c) => c.type === 'SUPERETTE').length,
    fastFood: clients.filter((c) => c.type === 'FAST_FOOD').length,
  };
}

export function ClientFilters({
  clients,
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  searchInputRef,
}: ClientFiltersProps) {
  const stats = computeStats(clients);

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1D1D1F]/10 to-[#1D1D1F]/5 flex items-center justify-center">
            <Users className="w-5 h-5 text-[#1D1D1F]" />
          </div>
          <div>
            <p className="text-[22px] font-semibold text-[#1D1D1F] tracking-tight">{stats.total}</p>
            <p className="text-[11px] font-medium text-[#86868B] uppercase tracking-wider">Total</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#007AFF]/10 to-[#007AFF]/5 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-[#007AFF]" />
          </div>
          <div>
            <p className="text-[22px] font-semibold text-[#1D1D1F] tracking-tight">{stats.distributeurs}</p>
            <p className="text-[11px] font-medium text-[#86868B] uppercase tracking-wider">Distributeurs</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#AF52DE]/10 to-[#AF52DE]/5 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-[#AF52DE]" />
          </div>
          <div>
            <p className="text-[22px] font-semibold text-[#1D1D1F] tracking-tight">{stats.grossistes}</p>
            <p className="text-[11px] font-medium text-[#86868B] uppercase tracking-wider">Grossistes</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#34C759]/10 to-[#34C759]/5 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-[#34C759]" />
          </div>
          <div>
            <p className="text-[22px] font-semibold text-[#1D1D1F] tracking-tight">{stats.superettes}</p>
            <p className="text-[11px] font-medium text-[#86868B] uppercase tracking-wider">Superettes</p>
          </div>
        </div>
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF9500]/10 to-[#FF9500]/5 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-[#FF9500]" />
          </div>
          <div>
            <p className="text-[22px] font-semibold text-[#1D1D1F] tracking-tight">{stats.fastFood}</p>
            <p className="text-[11px] font-medium text-[#86868B] uppercase tracking-wider">Fast Food</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 p-1 glass-card rounded-full w-fit">
        {[
          { key: 'all' as TabKey, label: 'Tous' },
          { key: 'DISTRIBUTEUR' as TabKey, label: 'Distributeurs' },
          { key: 'GROSSISTE' as TabKey, label: 'Grossistes' },
          { key: 'SUPERETTE' as TabKey, label: 'Superettes' },
          { key: 'FAST_FOOD' as TabKey, label: 'Fast Food' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={activeTab === tab.key
              ? 'px-4 py-2 rounded-full text-sm font-semibold bg-[#007AFF] text-white shadow-sm transition-all'
              : 'px-4 py-2 rounded-full text-sm font-medium text-[#86868B] hover:text-[#1D1D1F] hover:bg-white/60 transition-all'
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Rechercher par nom, code, NIF ou t\u00e9l\u00e9phone..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-10 py-2.5 glass-card rounded-full text-sm placeholder:text-[#86868B] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 border-0"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2">
          <KeyboardHint shortcut="/" />
        </span>
      </div>
    </>
  );
}

export type { TabKey, ClientStats };
