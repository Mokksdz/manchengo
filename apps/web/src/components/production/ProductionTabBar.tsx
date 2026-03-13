'use client';

import { cn } from '@/lib/utils';
import { Activity, Clock, Package, Calendar, Search, BarChart3, type LucideIcon } from 'lucide-react';
import type { MainTab } from './production-page-types';

interface TabConfig {
  key: MainTab;
  label: string;
  icon: LucideIcon;
  badge?: number | null;
}

export interface ProductionTabBarProps {
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
  /** Number of in-progress orders, shown as badge on the Orders tab */
  inProgressCount: number;
}

const TABS: Omit<TabConfig, 'badge'>[] = [
  { key: 'dashboard', label: 'Dashboard', icon: Activity },
  { key: 'orders', label: 'Ordres', icon: Clock },
  { key: 'products', label: 'Produits', icon: Package },
  { key: 'calendar', label: 'Planning', icon: Calendar },
  { key: 'traceability', label: 'Traçabilité', icon: Search },
  { key: 'analytics', label: 'Analytiques', icon: BarChart3 },
];

/**
 * Horizontal tab bar for the production page sections.
 * Renders accessible tabs with icons and an optional badge on the Orders tab.
 */
export function ProductionTabBar({ activeTab, onTabChange, inProgressCount }: ProductionTabBarProps) {
  const tabs: TabConfig[] = TABS.map((t) => ({
    ...t,
    badge: t.key === 'orders' && inProgressCount > 0 ? inProgressCount : null,
  }));

  return (
    <div className="flex border-b border-black/[0.04] overflow-x-auto" role="tablist" aria-label="Sections production">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          role="tab"
          aria-selected={activeTab === tab.key}
          aria-controls={`panel-${tab.key}`}
          id={`tab-${tab.key}`}
          className={cn(
            'flex-shrink-0 px-6 py-4 text-sm font-semibold flex items-center justify-center gap-2 whitespace-nowrap transition-all',
            activeTab === tab.key
              ? 'text-[#AF52DE] border-b-2 border-[#AF52DE] bg-[#AF52DE]/5'
              : 'text-[#86868B] hover:bg-white/40'
          )}
        >
          <tab.icon className="w-4 h-4" /> {tab.label}
          {tab.badge && (
            <span className="px-2 py-0.5 bg-[#AF52DE]/10 text-[#AF52DE] text-[11px] font-semibold rounded-full">
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
