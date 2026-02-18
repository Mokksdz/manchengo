'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  Package,
  Box,
  FileText,
  Users,
  Truck,
  Smartphone,
  LogOut,
  RefreshCw,
  Download,
  Shield,
  Activity,
  BookOpen,
  ShoppingCart,
  ChevronRight,
  BarChart3,
  LayoutDashboard,
  Calendar,
  Settings,
  Menu,
  X,
  Search,
  Clock,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OfflineBanner } from '@/components/OfflineBanner';

const CommandPalette = dynamic(
  () => import('@/components/ui/command-palette').then(mod => ({ default: mod.CommandPalette })),
  { ssr: false, loading: () => null }
);

// ═══════════════════════════════════════════════════════════════════════════════
// NAVIGATION CONFIG
// ═══════════════════════════════════════════════════════════════════════════════
type NavItem = {
  name: string;
  href: string;
  icon: React.ElementType;
  roles: string[];
  badge?: string;
};

type NavSection = {
  id: string;
  title: string;
  icon: React.ElementType;
  roles: string[];
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    id: 'stock',
    title: 'Stock',
    icon: Package,
    roles: ['ADMIN', 'APPRO', 'PRODUCTION', 'COMMERCIAL'],
    items: [
      { name: 'Matières Premières', href: '/dashboard/stock/mp', icon: Package, roles: ['ADMIN', 'APPRO', 'PRODUCTION'] },
      { name: 'Produits Finis', href: '/dashboard/stock/pf', icon: Box, roles: ['ADMIN', 'PRODUCTION', 'COMMERCIAL'] },
      { name: 'Lots & DLC', href: '/dashboard/stock/lots', icon: Calendar, roles: ['ADMIN', 'APPRO', 'PRODUCTION'] },
      { name: 'Alertes DLC', href: '/dashboard/stock/expiry', icon: Clock, roles: ['ADMIN', 'APPRO', 'PRODUCTION'] },
      { name: 'Inventaire', href: '/dashboard/stock/inventaire', icon: FileText, roles: ['ADMIN', 'APPRO'] },
    ],
  },
  {
    id: 'production',
    title: 'Production',
    icon: Activity,
    roles: ['ADMIN', 'PRODUCTION'],
    items: [
      { name: 'Dashboard', href: '/dashboard/production', icon: LayoutDashboard, roles: ['ADMIN', 'PRODUCTION'] },
      { name: 'Recettes', href: '/dashboard/production/recettes', icon: BookOpen, roles: ['ADMIN', 'PRODUCTION'] },
    ],
  },
  {
    id: 'commercial',
    title: 'Commercial',
    icon: FileText,
    roles: ['ADMIN', 'COMMERCIAL'],
    items: [
      { name: 'Ventes', href: '/dashboard/invoices', icon: FileText, roles: ['ADMIN', 'COMMERCIAL'] },
      { name: 'Clients', href: '/dashboard/clients', icon: Users, roles: ['ADMIN', 'COMMERCIAL'] },
    ],
  },
  {
    id: 'appro',
    title: 'Approvisionnement',
    icon: ShoppingCart,
    roles: ['ADMIN', 'APPRO'],
    items: [
      { name: 'Cockpit', href: '/dashboard/appro', icon: LayoutDashboard, roles: ['ADMIN', 'APPRO'] },
      { name: 'Bons de Commande', href: '/dashboard/appro/bons', icon: FileText, roles: ['ADMIN', 'APPRO'] },
      { name: 'Fournisseurs', href: '/dashboard/appro/fournisseurs', icon: Truck, roles: ['ADMIN', 'APPRO'] },
    ],
  },
  {
    id: 'system',
    title: 'Système',
    icon: Settings,
    roles: ['ADMIN'],
    items: [
      { name: 'Utilisateurs', href: '/dashboard/security/users', icon: Users, roles: ['ADMIN'] },
      { name: 'Appareils', href: '/dashboard/security/devices', icon: Smartphone, roles: ['ADMIN'] },
      { name: 'Audit', href: '/dashboard/security/audit', icon: Shield, roles: ['ADMIN'] },
      { name: 'Synchronisation', href: '/dashboard/sync', icon: RefreshCw, roles: ['ADMIN'] },
      { name: 'Exports', href: '/dashboard/exports', icon: Download, roles: ['ADMIN'] },
      { name: 'Monitoring', href: '/dashboard/monitoring', icon: BarChart3, roles: ['ADMIN'] },
    ],
  },
];

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  // ⌘K / Ctrl+K global shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [expandedSections, setExpandedSections] = useState<string[]>(() => {
    const sections = new Set(['stock', 'appro']);
    for (const section of navSections) {
      if (section.items.some(item => pathname?.startsWith(item.href))) {
        sections.add(section.id);
      }
    }
    return Array.from(sections);
  });

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const isActive = (href: string) => {
    const exactMatchRoutes = ['/dashboard/production', '/dashboard/appro', '/dashboard/stock'];
    if (exactMatchRoutes.includes(href)) {
      return pathname === href;
    }
    return pathname?.startsWith(href) ?? false;
  };

  const visibleSections = useMemo(
    () => user ? navSections.filter(section => section.roles.includes(user.role)) : [],
    [user?.role],
  );

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center silicon-shell">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-[3px] border-[#E5E5EA] border-t-[#1D1D1F] rounded-full animate-spin" />
          <p className="text-[#8E8E93] text-[13px]">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="silicon-shell">
      <OfflineBanner />

      {/* Mobile Header — Glassmorphism */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 h-12 flex items-center px-4 silicon-mobile-header">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label={isMobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          className="p-1.5 rounded-[10px] hover:bg-black/[0.04] transition-colors"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5 text-[#1D1D1F]" /> : <Menu className="w-5 h-5 text-[#1D1D1F]" />}
        </button>
        <span className="ml-3 font-display font-semibold text-[#1D1D1F] text-[15px] tracking-[-0.01em]">Manchengo</span>
      </header>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/15 backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* ═══ Sidebar — Premium Glassmorphism ═══ */}
      <aside
        role="navigation"
        aria-label="Navigation principale"
        className={cn(
          'fixed inset-y-0 left-0 w-[264px] flex flex-col z-50 transition-transform duration-300 ease-out silicon-sidebar',
          'lg:translate-x-0',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* ─── Logo ─── */}
        <div className="h-[60px] flex items-center px-5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[12px] flex items-center justify-center relative overflow-hidden" style={{
              background: 'linear-gradient(135deg, #1D1D1F 0%, #3A3A3C 100%)',
              boxShadow: '0 2px 8px rgba(29, 29, 31, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            }}>
              <span className="text-white font-bold text-[14px] relative z-10">M</span>
            </div>
            <div>
              <p className="font-display font-semibold text-[15px] text-[#1D1D1F] leading-tight tracking-[-0.01em]">Manchengo</p>
              <p className="text-[10px] text-[#AEAEB2] uppercase tracking-[0.1em] leading-tight font-medium">Smart ERP</p>
            </div>
          </div>
        </div>

        {/* ─── Separator ─── */}
        <div className="mx-5 h-[0.5px] bg-black/[0.06]" />

        {/* ─── Search Trigger ─── */}
        <div className="px-3 pt-3 pb-1">
          <button
            onClick={() => setShowCommandPalette(true)}
            className="w-full flex items-center gap-2.5 px-3 py-[8px] rounded-[10px] text-[13px] text-[#AEAEB2] transition-all duration-200 hover:bg-black/[0.03] silicon-panel"
          >
            <Search className="w-[14px] h-[14px] text-[#C7C7CC]" />
            <span className="flex-1 text-left tracking-[-0.005em]">Rechercher...</span>
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-[#C7C7CC] rounded-[4px] border border-black/[0.06] bg-white/60">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* ─── Navigation ─── */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto scrollbar-thin">
          <div className="space-y-0.5">
            {visibleSections.map((section) => {
              const isExpanded = expandedSections.includes(section.id);
              const hasActiveItem = section.items.some(item => isActive(item.href));
              const visibleItems = section.items.filter(item => item.roles.includes(user.role));
              const SectionIcon = section.icon;

              if (visibleItems.length === 0) return null;

              return (
                <div key={section.id} className="mb-0.5">
                  {/* Section header */}
                  <button
                    onClick={() => toggleSection(section.id)}
                    aria-expanded={isExpanded}
                    aria-label={`${isExpanded ? 'Réduire' : 'Développer'} la section ${section.title}`}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-[8px] rounded-[12px] text-[13px] font-medium transition-all duration-200',
                      hasActiveItem
                        ? 'text-[#1D1D1F]'
                        : 'text-[#8E8E93] hover:text-[#6E6E73] hover:bg-black/[0.02]'
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={cn(
                        'w-[26px] h-[26px] rounded-[8px] flex items-center justify-center transition-all duration-200',
                        hasActiveItem
                          ? 'bg-[#1D1D1F]/[0.06]'
                          : 'bg-transparent'
                      )}>
                        <SectionIcon className={cn(
                          'w-[15px] h-[15px] transition-colors duration-200',
                          hasActiveItem ? 'text-[#1D1D1F]' : 'text-[#AEAEB2]'
                        )} />
                      </div>
                      <span>{section.title}</span>
                    </div>
                    <ChevronRight className={cn(
                      'w-3 h-3 text-[#C7C7CC] transition-transform duration-200 ease-out',
                      isExpanded && 'rotate-90'
                    )} />
                  </button>

                  {/* Items */}
                  {isExpanded && (
                    <div className="ml-[22px] pl-3.5 border-l border-black/[0.05] space-y-px mt-0.5 mb-1.5">
                      {visibleItems.map((item) => {
                        const active = isActive(item.href);
                        const ItemIcon = item.icon;
                        return (
                          <Link
                            key={item.name}
                            href={item.href}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={cn(
                              'group flex items-center gap-2.5 px-3 py-[7px] rounded-[10px] text-[13px] transition-all duration-200',
                              active
                                ? 'text-[#1D1D1F] font-medium'
                                : 'text-[#8E8E93] hover:text-[#6E6E73] hover:bg-black/[0.02]'
                            )}
                            style={active ? {
                              background: 'rgba(255, 255, 255, 0.8)',
                              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
                              border: '0.5px solid rgba(255, 255, 255, 0.9)',
                            } : undefined}
                          >
                            <ItemIcon className={cn(
                              'w-[15px] h-[15px] transition-colors duration-200',
                              active ? 'text-[#1D1D1F]' : 'text-[#C7C7CC] group-hover:text-[#AEAEB2]'
                            )} />
                            <span className="tracking-[-0.005em]">{item.name}</span>
                            {item.badge && (
                              <span className="ml-auto px-1.5 py-0.5 text-[10px] font-semibold rounded-full text-[#8E8E93]" style={{
                                background: 'rgba(0, 0, 0, 0.04)',
                              }}>
                                {item.badge}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        {/* ─── Separator ─── */}
        <div className="mx-5 h-[0.5px] bg-black/[0.06]" />

        {/* ─── User Section ─── */}
        <div className="p-3 flex-shrink-0">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-[12px] hover:bg-black/[0.02] transition-colors duration-200">
            <div className="w-[34px] h-[34px] rounded-full flex items-center justify-center relative overflow-hidden" style={{
              background: 'linear-gradient(135deg, #F0F0F5 0%, #E8E8ED 100%)',
              boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.04), 0 0 0 0.5px rgba(0, 0, 0, 0.04)',
            }}>
              <span className="font-semibold text-[12px] text-[#6E6E73]">
                {user.firstName?.[0] || 'U'}{user.lastName?.[0] || ''}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-[#1D1D1F] truncate leading-tight tracking-[-0.005em]">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-[11px] text-[#AEAEB2] truncate leading-tight font-medium">{user.role}</p>
            </div>
          </div>

          <button
            onClick={logout}
            className="flex items-center justify-center gap-2 w-full px-3 py-2 text-[13px] font-medium text-[#AEAEB2] hover:text-[#FF3B30] rounded-[10px] transition-all duration-200 mt-1 hover:bg-[#FF3B30]/[0.04]"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main id="main-content" role="main" aria-label="Contenu principal" className="silicon-main dashboard-root">
        <div className="min-h-screen">
          <div className="silicon-content">
            <div className="dashboard-page-frame">{children}</div>
          </div>
        </div>
      </main>

      {showCommandPalette && (
        <CommandPalette
          open={showCommandPalette}
          onClose={() => setShowCommandPalette(false)}
        />
      )}
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary module="Application Dashboard">
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </ErrorBoundary>
  );
}
