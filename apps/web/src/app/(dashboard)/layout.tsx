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
import { LanguageSwitcher } from '@/components/ui/language-switcher';

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

      {/* ═══ Ambient Lighting Blobs ═══ */}
      <div className="ambient-blob-blue animate-pulse-slow hidden lg:block" />
      <div className="ambient-blob-orange animate-pulse-slow hidden lg:block" style={{ animationDelay: '4s' }} />

      {/* Mobile Header — Glassmorphism */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 h-12 flex items-center px-4 silicon-mobile-header">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label={isMobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          className="p-1.5 rounded-[10px] hover:bg-black/[0.04] transition-colors"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5 text-[#1D1D1F]" /> : <Menu className="w-5 h-5 text-[#1D1D1F]" />}
        </button>
        <span className="ml-3 font-display font-bold text-[#1D1D1F] text-[15px] tracking-[-0.02em]">Manchengo</span>
      </header>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/15 backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* ═══ Sidebar — Ultimate Premium Glassmorphism ═══ */}
      <aside
        role="navigation"
        aria-label="Navigation principale"
        className={cn(
          'fixed inset-y-0 left-0 w-[264px] flex flex-col z-50 transition-transform duration-300 ease-out silicon-sidebar',
          'lg:translate-x-0',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* ─── Logo with Glow ─── */}
        <div className="h-24 flex items-center px-6 flex-shrink-0">
          <div className="relative group cursor-pointer">
            <div className="absolute inset-0 bg-orange-500/20 blur-xl rounded-xl group-hover:bg-orange-500/30 transition-all" />
            <div className="w-10 h-10 relative rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg border border-white/20 transform rotate-3" style={{
              background: 'linear-gradient(135deg, #EC7620 0%, #dd5c16 100%)',
            }}>
              <span role="img" aria-label="fromage">🧀</span>
            </div>
          </div>
          <div className="ml-4">
            <h1 className="font-display font-black text-[20px] leading-none tracking-[-0.04em] bg-clip-text text-transparent bg-gradient-to-br from-gray-900 to-gray-600">
              Manchengo
            </h1>
            <p className="text-[11px] text-[#86868B] font-bold tracking-widest uppercase mt-1">Smart ERP Pro</p>
          </div>
        </div>

        {/* ─── Search Bar (Glass) ─── */}
        <div className="px-4 pb-4">
          <button
            onClick={() => setShowCommandPalette(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] text-[#86868B] transition-all duration-200 bg-white/40 backdrop-blur-md border border-white/40 shadow-sm hover:bg-white/60 focus:ring-2 focus:ring-orange-500/20"
          >
            <Search className="w-4 h-4 text-[#86868B]" />
            <span className="flex-1 text-left font-medium">Recherche globale...</span>
            <kbd className="hidden xl:inline-flex text-[9px] font-bold text-[#86868B] bg-white/50 border border-white/60 px-1.5 py-0.5 rounded-md">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* ─── Navigation ─── */}
        <nav className="flex-1 px-4 overflow-y-auto scrollbar-thin">
          <div className="space-y-1">
            {visibleSections.map((section) => {
              const isExpanded = expandedSections.includes(section.id);
              const hasActiveItem = section.items.some(item => isActive(item.href));
              const visibleItems = section.items.filter(item => item.roles.includes(user.role));
              const SectionIcon = section.icon;

              if (visibleItems.length === 0) return null;

              return (
                <div key={section.id} className="mb-1">
                  {/* Section header */}
                  <div className="relative">
                    {hasActiveItem && (
                      <div className="absolute inset-0 bg-orange-500/5 blur-md rounded-xl z-0" />
                    )}
                    <button
                      onClick={() => toggleSection(section.id)}
                      aria-expanded={isExpanded}
                      aria-label={`${isExpanded ? 'Réduire' : 'Développer'} la section ${section.title}`}
                      className={cn(
                        'relative z-10 w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all duration-200',
                        hasActiveItem
                          ? 'bg-white/70 shadow-[0_4px_20px_rgba(236,118,32,0.15)] border border-white/50 text-[#1D1D1F] font-bold'
                          : 'text-[#6E6E73] hover:bg-white/40'
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        {hasActiveItem && (
                          <span className="w-1.5 h-6 bg-[#EC7620] rounded-full absolute left-0 shadow-[0_0_10px_#EC7620]" />
                        )}
                        <SectionIcon className={cn(
                          'w-5 h-5 transition-colors duration-200',
                          hasActiveItem ? 'text-[#EC7620] ml-2' : 'text-[#AEAEB2]'
                        )} />
                        <span className="tracking-tight">{section.title.toUpperCase()}</span>
                      </div>
                      <ChevronRight className={cn(
                        'w-4 h-4 transition-transform duration-200 ease-out',
                        hasActiveItem ? 'text-[#EC7620]' : 'text-[#C7C7CC]',
                        isExpanded && 'rotate-90'
                      )} />
                    </button>
                  </div>

                  {/* Items — dashed border connector */}
                  {isExpanded && (
                    <div className="ml-6 mt-2 space-y-1 border-l-2 border-dashed border-gray-200 pl-4 py-2">
                      {visibleItems.map((item) => {
                        const active = isActive(item.href);
                        return (
                          <Link
                            key={item.name}
                            href={item.href}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={cn(
                              'group relative flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-all duration-200',
                              active
                                ? 'text-[#EC7620] font-bold'
                                : 'text-[#6E6E73] font-medium hover:text-[#1D1D1F]'
                            )}
                          >
                            {active && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[#EC7620] animate-pulse" />
                            )}
                            <span className="tracking-[-0.005em]">{item.name}</span>
                            {item.badge && (
                              <span className="ml-auto px-1.5 py-0.5 text-[10px] font-semibold rounded-full text-[#8E8E93] bg-black/[0.04]">
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

        {/* ─── User Section — Premium ─── */}
        <div className="p-4 border-t border-white/40 mt-auto">
          <div className="flex items-center p-3 bg-white/40 backdrop-blur-md border border-white/40 rounded-2xl shadow-sm cursor-pointer hover:bg-white/60 transition-all group">
            <div className="relative mr-3">
              <div className="w-10 h-10 rounded-full border-[3px] border-white shadow-sm flex items-center justify-center text-white font-bold text-xs" style={{
                background: 'linear-gradient(135deg, #EC7620 0%, #f58b34 100%)',
              }}>
                {user.firstName?.[0] || 'U'}{user.lastName?.[0] || ''}
              </div>
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-[#1D1D1F] group-hover:text-[#EC7620] transition-colors truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-[11px] text-[#86868B] font-medium truncate">{user.role}</p>
            </div>
            <Settings className="w-[18px] h-[18px] text-[#86868B] hover:rotate-90 transition-transform ml-auto flex-shrink-0" />
          </div>

          <LanguageSwitcher />

          <button
            onClick={logout}
            className="flex items-center justify-center gap-2 w-full px-3 py-2 text-[13px] font-medium text-[#AEAEB2] hover:text-[#FF3B30] rounded-xl transition-all duration-200 mt-2 hover:bg-[#FF3B30]/[0.04]"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main id="main-content" role="main" aria-label="Contenu principal" className="silicon-main dashboard-root relative z-10">
        <div className="min-h-screen">
          <div className="silicon-content">
            <div className="dashboard-page-frame max-w-[1800px]">{children}</div>
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
