'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useFocusTrap, useEscapeKey } from '@/lib/hooks/use-focus-trap';
import {
  Search,
  Package,
  Box,
  FileText,
  Users,
  Truck,
  Smartphone,
  RefreshCw,
  Download,
  Shield,
  BookOpen,
  BarChart3,
  LayoutDashboard,
  Calendar,
  Plus,
  ArrowRight,
  CornerDownLeft,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  category: 'navigation' | 'action' | 'recent';
  href?: string;
  action?: () => void;
  keywords?: string[];
  roles: string[];
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND ITEMS DEFINITION
// ═══════════════════════════════════════════════════════════════════════════════

const navigationItems: CommandItem[] = [
  // Stock
  { id: 'nav-stock-mp', label: 'Matières Premières', description: 'Stock > Matières Premières', icon: <Package className="w-4 h-4" />, category: 'navigation', href: '/dashboard/stock/mp', keywords: ['stock', 'matière', 'mp', 'raw', 'material'], roles: ['ADMIN', 'APPRO', 'PRODUCTION'] },
  { id: 'nav-stock-pf', label: 'Produits Finis', description: 'Stock > Produits Finis', icon: <Box className="w-4 h-4" />, category: 'navigation', href: '/dashboard/stock/pf', keywords: ['stock', 'produit', 'fini', 'pf'], roles: ['ADMIN', 'PRODUCTION', 'COMMERCIAL'] },
  { id: 'nav-stock-lots', label: 'Lots & DLC', description: 'Stock > Lots & DLC', icon: <Calendar className="w-4 h-4" />, category: 'navigation', href: '/dashboard/stock/lots', keywords: ['stock', 'lot', 'dlc', 'date', 'expiration', 'péremption'], roles: ['ADMIN', 'APPRO', 'PRODUCTION'] },
  { id: 'nav-stock-inv', label: 'Inventaire', description: 'Stock > Inventaire', icon: <FileText className="w-4 h-4" />, category: 'navigation', href: '/dashboard/stock/inventaire', keywords: ['stock', 'inventaire', 'inventory'], roles: ['ADMIN', 'APPRO'] },

  // Production
  { id: 'nav-prod-dash', label: 'Dashboard Production', description: 'Production > Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, category: 'navigation', href: '/dashboard/production', keywords: ['production', 'dashboard', 'tableau de bord'], roles: ['ADMIN', 'PRODUCTION'] },
  { id: 'nav-prod-recettes', label: 'Recettes', description: 'Production > Recettes', icon: <BookOpen className="w-4 h-4" />, category: 'navigation', href: '/dashboard/production/recettes', keywords: ['production', 'recette', 'recipe', 'formule'], roles: ['ADMIN', 'PRODUCTION'] },
  { id: 'nav-prod-pf', label: 'Produits PF', description: 'Production > Produits PF', icon: <Box className="w-4 h-4" />, category: 'navigation', href: '/dashboard/stock/pf', keywords: ['production', 'produit fini', 'pf'], roles: ['ADMIN', 'PRODUCTION', 'COMMERCIAL'] },

  // Commercial
  { id: 'nav-comm-ventes', label: 'Ventes', description: 'Commercial > Ventes', icon: <FileText className="w-4 h-4" />, category: 'navigation', href: '/dashboard/invoices', keywords: ['commercial', 'vente', 'facture', 'invoice', 'sale'], roles: ['ADMIN', 'COMMERCIAL'] },
  { id: 'nav-comm-clients', label: 'Clients', description: 'Commercial > Clients', icon: <Users className="w-4 h-4" />, category: 'navigation', href: '/dashboard/clients', keywords: ['commercial', 'client', 'customer'], roles: ['ADMIN', 'COMMERCIAL'] },

  // Approvisionnement
  { id: 'nav-appro-cockpit', label: 'Cockpit Appro', description: 'Approvisionnement > Cockpit', icon: <LayoutDashboard className="w-4 h-4" />, category: 'navigation', href: '/dashboard/appro', keywords: ['approvisionnement', 'cockpit', 'appro', 'supply'], roles: ['ADMIN', 'APPRO'] },
  { id: 'nav-appro-bons', label: 'Bons de Commande', description: 'Approvisionnement > Bons de Commande', icon: <FileText className="w-4 h-4" />, category: 'navigation', href: '/dashboard/appro/bons', keywords: ['approvisionnement', 'bon', 'commande', 'purchase order', 'po'], roles: ['ADMIN', 'APPRO'] },
  { id: 'nav-appro-fourn', label: 'Fournisseurs', description: 'Approvisionnement > Fournisseurs', icon: <Truck className="w-4 h-4" />, category: 'navigation', href: '/dashboard/appro/fournisseurs', keywords: ['approvisionnement', 'fournisseur', 'supplier', 'vendor'], roles: ['ADMIN', 'APPRO'] },

  // Administration
  { id: 'nav-admin-sync', label: 'Synchronisation', description: 'Administration > Synchronisation', icon: <RefreshCw className="w-4 h-4" />, category: 'navigation', href: '/dashboard/sync', keywords: ['administration', 'sync', 'synchronisation'], roles: ['ADMIN'] },
  { id: 'nav-admin-exports', label: 'Exports', description: 'Administration > Exports', icon: <Download className="w-4 h-4" />, category: 'navigation', href: '/dashboard/exports', keywords: ['administration', 'export', 'télécharger', 'download'], roles: ['ADMIN'] },
  { id: 'nav-admin-monitoring', label: 'Monitoring', description: 'Administration > Monitoring', icon: <BarChart3 className="w-4 h-4" />, category: 'navigation', href: '/dashboard/monitoring', keywords: ['administration', 'monitoring', 'surveillance', 'stats'], roles: ['ADMIN'] },

  // Sécurité
  { id: 'nav-sec-users', label: 'Utilisateurs', description: 'Sécurité > Utilisateurs', icon: <Users className="w-4 h-4" />, category: 'navigation', href: '/dashboard/security/users', keywords: ['sécurité', 'utilisateur', 'user'], roles: ['ADMIN'] },
  { id: 'nav-sec-devices', label: 'Appareils', description: 'Sécurité > Appareils', icon: <Smartphone className="w-4 h-4" />, category: 'navigation', href: '/dashboard/security/devices', keywords: ['sécurité', 'appareil', 'device'], roles: ['ADMIN'] },
  { id: 'nav-sec-audit', label: 'Audit', description: 'Sécurité > Audit', icon: <Shield className="w-4 h-4" />, category: 'navigation', href: '/dashboard/security/audit', keywords: ['sécurité', 'audit', 'log', 'journal'], roles: ['ADMIN'] },
];

const actionItems: CommandItem[] = [
  { id: 'act-new-bon', label: 'Nouveau Bon de Commande', description: 'Créer un nouveau bon de commande', icon: <Plus className="w-4 h-4" />, category: 'action', href: '/dashboard/appro/bons/new', keywords: ['nouveau', 'créer', 'bon', 'commande', 'new', 'purchase'], roles: ['ADMIN', 'APPRO'] },
  { id: 'act-new-fourn', label: 'Nouveau Fournisseur', description: 'Ajouter un nouveau fournisseur', icon: <Plus className="w-4 h-4" />, category: 'action', href: '/dashboard/appro/fournisseurs/nouveau', keywords: ['nouveau', 'créer', 'fournisseur', 'supplier', 'new'], roles: ['ADMIN', 'APPRO'] },
  { id: 'act-new-facture', label: 'Nouvelle Facture', description: 'Créer une nouvelle facture', icon: <Plus className="w-4 h-4" />, category: 'action', href: '/dashboard/invoices/new', keywords: ['nouveau', 'créer', 'facture', 'invoice', 'new'], roles: ['ADMIN', 'COMMERCIAL'] },
  { id: 'act-new-client', label: 'Nouveau Client', description: 'Ajouter un nouveau client', icon: <Plus className="w-4 h-4" />, category: 'action', href: '/dashboard/clients?action=new', keywords: ['nouveau', 'créer', 'client', 'customer', 'new'], roles: ['ADMIN', 'COMMERCIAL'] },
];

const allItems = [...navigationItems, ...actionItems];

const categoryLabels: Record<string, string> = {
  navigation: 'Navigation',
  action: 'Actions rapides',
  recent: 'Récents',
};

// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH LOGIC
// ═══════════════════════════════════════════════════════════════════════════════

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function matchesQuery(item: CommandItem, query: string): boolean {
  if (!query) return true;
  const q = normalizeString(query);
  const targets = [
    item.label,
    item.description || '',
    ...(item.keywords || []),
  ];
  return targets.some(t => normalizeString(t).includes(q));
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useFocusTrap<HTMLDivElement>(open);

  useEscapeKey(onClose, open);

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      // Small delay to ensure DOM is ready
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  // Filter items by role and query
  const filteredItems = useMemo(() => {
    if (!user) return [];
    const roleFiltered = allItems.filter(item => item.roles.includes(user.role));
    return roleFiltered.filter(item => matchesQuery(item, query));
  }, [query, user]);

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    for (const item of filteredItems) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  }, [filteredItems]);

  // Flat list for keyboard navigation
  const flatList = useMemo(() => {
    const order: Array<'action' | 'navigation' | 'recent'> = ['action', 'navigation', 'recent'];
    const result: CommandItem[] = [];
    for (const cat of order) {
      if (groupedItems[cat]) result.push(...groupedItems[cat]);
    }
    return result;
  }, [groupedItems]);

  // Clamp selected index
  useEffect(() => {
    if (selectedIndex >= flatList.length) {
      setSelectedIndex(Math.max(0, flatList.length - 1));
    }
  }, [flatList.length, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector('[data-selected="true"]');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const activateItem = useCallback((item: CommandItem) => {
    onClose();
    if (item.href) {
      router.push(item.href);
    } else if (item.action) {
      item.action();
    }
  }, [router, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => (i + 1) % Math.max(1, flatList.length));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => (i - 1 + flatList.length) % Math.max(1, flatList.length));
        break;
      case 'Enter':
        e.preventDefault();
        if (flatList[selectedIndex]) {
          activateItem(flatList[selectedIndex]);
        }
        break;
    }
  }, [flatList, selectedIndex, activateItem]);

  if (!open) return null;

  // Render grouped results
  const categoryOrder: Array<'action' | 'navigation' | 'recent'> = ['action', 'navigation', 'recent'];
  let runningIndex = 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Palette container */}
      <div
        ref={containerRef}
        className="relative w-full max-w-lg mx-4 animate-scale-in"
        onKeyDown={handleKeyDown}
        style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          borderRadius: '16px',
          boxShadow: '0 24px 80px rgba(0, 0, 0, 0.12), 0 8px 32px rgba(0, 0, 0, 0.08), 0 0 0 0.5px rgba(0, 0, 0, 0.05)',
          border: '0.5px solid rgba(255, 255, 255, 0.2)',
        }}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-black/[0.06]">
          <Search className="w-[18px] h-[18px] text-[#8E8E93] flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            placeholder="Rechercher une page ou une action..."
            className="flex-1 bg-transparent text-[15px] text-[#1D1D1F] placeholder-[#AEAEB2] outline-none tracking-[-0.01em]"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[11px] font-medium text-[#AEAEB2] rounded-md border border-black/[0.06] bg-black/[0.02]">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-[360px] overflow-y-auto overscroll-contain py-2 px-2"
        >
          {flatList.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-[13px] text-[#AEAEB2]">Aucun résultat pour &ldquo;{query}&rdquo;</p>
            </div>
          ) : (
            categoryOrder.map(category => {
              const items = groupedItems[category];
              if (!items || items.length === 0) return null;

              const startIndex = runningIndex;
              runningIndex += items.length;

              return (
                <div key={category} className="mb-1">
                  <div className="px-2 pt-2 pb-1">
                    <span className="text-[11px] font-semibold text-[#AEAEB2] uppercase tracking-[0.06em]">
                      {categoryLabels[category]}
                    </span>
                  </div>
                  {items.map((item, idx) => {
                    const globalIdx = startIndex + idx;
                    const isSelected = globalIdx === selectedIndex;
                    return (
                      <button
                        key={item.id}
                        data-selected={isSelected}
                        onClick={() => activateItem(item)}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-left transition-colors duration-100 group"
                        style={isSelected ? {
                          background: 'rgba(236, 118, 32, 0.06)',
                        } : undefined}
                      >
                        <div
                          className="w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0 transition-colors duration-100"
                          style={{
                            background: isSelected ? 'rgba(236, 118, 32, 0.1)' : 'rgba(0, 0, 0, 0.03)',
                          }}
                        >
                          <span className={isSelected ? 'text-[#EC7620]' : 'text-[#8E8E93]'}>
                            {item.icon}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] font-medium truncate tracking-[-0.005em] ${isSelected ? 'text-[#1D1D1F]' : 'text-[#3A3A3C]'}`}>
                            {item.label}
                          </p>
                          {item.description && (
                            <p className="text-[11px] text-[#AEAEB2] truncate mt-0.5">
                              {item.description}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <ArrowRight className="w-3.5 h-3.5 text-[#EC7620] flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-black/[0.06]">
          <div className="flex items-center gap-1.5">
            <kbd className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-medium text-[#AEAEB2] rounded border border-black/[0.06] bg-black/[0.02]">
              &uarr;
            </kbd>
            <kbd className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-medium text-[#AEAEB2] rounded border border-black/[0.06] bg-black/[0.02]">
              &darr;
            </kbd>
            <span className="text-[11px] text-[#C7C7CC] ml-0.5">naviguer</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="inline-flex items-center justify-center h-5 px-1 text-[10px] font-medium text-[#AEAEB2] rounded border border-black/[0.06] bg-black/[0.02]">
              <CornerDownLeft className="w-3 h-3" />
            </kbd>
            <span className="text-[11px] text-[#C7C7CC] ml-0.5">ouvrir</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="inline-flex items-center justify-center h-5 px-1.5 text-[10px] font-medium text-[#AEAEB2] rounded border border-black/[0.06] bg-black/[0.02]">
              esc
            </kbd>
            <span className="text-[11px] text-[#C7C7CC] ml-0.5">fermer</span>
          </div>
        </div>
      </div>
    </div>
  );
}
