/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * MANCHENGO SMART ERP — Unified Design System
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Apple-inspired design tokens, reusable Tailwind class compositions,
 * and constants to ensure 100% consistency across all pages.
 *
 * RULE: Every page MUST import from here. No hardcoded gray-*, slate-* allowed.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ─── COLOR TOKENS (for reference — actual usage via Tailwind classes below) ───
export const colors = {
  // Brand
  primary: '#EC7620',
  primaryHover: '#DD5C16',

  // Text hierarchy
  text: {
    primary: '#1D1D1F',    // Headings, strong text
    secondary: '#6E6E73',  // Labels, captions
    tertiary: '#86868B',   // Descriptions, meta
    quaternary: '#AEAEB2', // Placeholders, timestamps
    disabled: '#D1D1D6',   // Disabled text
  },

  // Backgrounds
  bg: {
    page: '#FAFAFA',       // Page background
    card: '#FFFFFF',       // Card background
    muted: '#F5F5F5',     // Muted bg (icon boxes, hover)
    tableHeader: '#FAFAFA', // Table header bg
  },

  // Borders
  border: {
    card: '#E5E5E5',       // Card/table borders
    subtle: '#F0F0F0',     // Section dividers, inner borders
    input: '#E5E5E5',      // Form inputs
  },

  // Status colors (muted Apple style)
  status: {
    success: { bg: '#E8F5E9', text: '#2E7D32' },
    warning: { bg: '#FFF8E1', text: '#F57F17' },
    error: { bg: '#FFEBEE', text: '#C62828' },
    info: { bg: '#E3F2FD', text: '#1565C0' },
    neutral: { bg: '#F5F5F5', text: '#6E6E73' },
  },
} as const;

// ─── REUSABLE CLASS COMPOSITIONS ─────────────────────────────────────────────
// Use these instead of writing raw Tailwind to ensure consistency

/** Card container */
export const cardClass = 'bg-white rounded-2xl border border-[#E5E5E5] shadow-apple-card';

/** Card with hover */
export const cardHoverClass = 'bg-white rounded-2xl border border-[#E5E5E5] shadow-apple-card hover:shadow-apple-hover transition-shadow';

/** Card header section (inside card) */
export const cardHeaderClass = 'px-6 py-4 border-b border-[#F0F0F0]';

/** Card body section (inside card) */
export const cardBodyClass = 'p-6';

/** Table container */
export const tableContainerClass = 'bg-white rounded-2xl border border-[#E5E5E5] shadow-apple-card overflow-hidden';

/** Table header row */
export const tableHeaderClass = 'bg-[#FAFAFA] border-b border-[#F0F0F0]';

/** Table header cell — standardized */
export const thClass = 'px-5 py-3.5 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wider';
export const thRightClass = 'px-5 py-3.5 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider';
export const thCenterClass = 'px-5 py-3.5 text-center text-[11px] font-semibold text-[#86868B] uppercase tracking-wider';

/** Table body row */
export const trClass = 'border-b border-[#F0F0F0] last:border-0 hover:bg-[#FAFAFA] transition-colors';

/** Table body cell — standardized */
export const tdClass = 'px-5 py-4 text-[15px] text-[#1D1D1F]';
export const tdRightClass = 'px-5 py-4 text-[15px] text-[#1D1D1F] text-right';
export const tdCenterClass = 'px-5 py-4 text-[15px] text-[#1D1D1F] text-center';
export const tdMutedClass = 'px-5 py-4 text-[15px] text-[#6E6E73]';

/** Section title (page-level heading) */
export const sectionTitleClass = 'text-[20px] font-semibold text-[#1D1D1F]';

/** Section subtitle */
export const sectionSubtitleClass = 'text-[13px] text-[#86868B]';

/** KPI / Stat value */
export const kpiValueClass = 'text-[28px] font-semibold text-[#1D1D1F]';
export const kpiLabelClass = 'text-[13px] font-medium text-[#86868B]';

/** Primary button (dark) */
export const btnPrimaryClass = 'inline-flex items-center gap-2 bg-[#1D1D1F] hover:bg-[#333336] text-white font-medium py-2.5 px-5 rounded-[10px] transition-all text-[15px]';

/** Secondary button (outlined) */
export const btnSecondaryClass = 'inline-flex items-center gap-2 bg-white hover:bg-[#F5F5F5] text-[#1D1D1F] font-medium py-2.5 px-5 rounded-[10px] border border-[#E5E5E5] transition-all text-[15px]';

/** Brand button (orange) */
export const btnBrandClass = 'inline-flex items-center gap-2 bg-[#EC7620] hover:bg-[#DD5C16] text-white font-medium py-2.5 px-5 rounded-[10px] transition-all text-[15px]';

/** Ghost button */
export const btnGhostClass = 'inline-flex items-center gap-2 text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F5] font-medium py-2 px-3 rounded-[10px] transition-all text-[15px]';

/** Small pill button (filter chips) */
export const filterChipActiveClass = 'px-3 py-1.5 text-xs font-medium rounded-[8px] bg-[#1D1D1F] text-white transition-colors';
export const filterChipClass = 'px-3 py-1.5 text-xs font-medium rounded-[8px] bg-white text-[#6E6E73] border border-[#E5E5E5] hover:bg-[#F5F5F5] transition-colors';

/** Action icon button (table row actions) */
export const iconBtnClass = 'p-1.5 text-[#AEAEB2] hover:text-[#1D1D1F] hover:bg-[#F5F5F5] rounded-[8px] transition-colors';
export const iconBtnDangerClass = 'p-1.5 text-[#AEAEB2] hover:text-[#C62828] hover:bg-[#FFEBEE] rounded-[8px] transition-colors';
export const iconBtnSuccessClass = 'p-1.5 text-[#AEAEB2] hover:text-[#2E7D32] hover:bg-[#E8F5E9] rounded-[8px] transition-colors';
export const iconBtnInfoClass = 'p-1.5 text-[#AEAEB2] hover:text-[#1565C0] hover:bg-[#E3F2FD] rounded-[8px] transition-colors';

/** Refresh / icon button */
export const refreshBtnClass = 'p-2.5 bg-[#F5F5F5] rounded-[10px] hover:bg-[#E5E5E5] transition-all text-[#6E6E73]';

/** Icon container (header icons, stat card icons) */
export const iconBoxClass = 'w-12 h-12 rounded-[12px] bg-[#F5F5F5] flex items-center justify-center text-[#6E6E73]';
export const iconBoxSmClass = 'w-9 h-9 rounded-[10px] bg-[#F5F5F5] flex items-center justify-center text-[#6E6E73]';
export const iconBoxBrandClass = 'w-12 h-12 rounded-[12px] bg-[#EC7620] flex items-center justify-center text-white';

/** Search input */
export const searchInputClass = 'w-full pl-9 pr-3 py-2 text-sm border border-[#E5E5E5] rounded-[10px] bg-white focus:outline-none focus:ring-2 focus:ring-[#EC7620]/20 focus:border-[#EC7620] placeholder:text-[#AEAEB2] text-[#1D1D1F]';

/** Form input */
export const inputClass = 'w-full px-4 py-2.5 bg-white border border-[#E5E5E5] rounded-[10px] text-[#1D1D1F] placeholder-[#AEAEB2] focus:outline-none focus:ring-2 focus:ring-[#EC7620]/20 focus:border-[#EC7620] transition-all text-[15px]';

/** Form select */
export const selectClass = 'w-full px-4 py-2.5 bg-white border border-[#E5E5E5] rounded-[10px] text-[#1D1D1F] focus:outline-none focus:ring-2 focus:ring-[#EC7620]/20 focus:border-[#EC7620] transition-all text-[15px]';

/** Form label */
export const labelClass = 'block text-[13px] font-medium text-[#6E6E73] mb-1.5';

/** Badge / pill styles */
export const badgeSuccessClass = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#E8F5E9] text-[#2E7D32]';
export const badgeWarningClass = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#FFF8E1] text-[#F57F17]';
export const badgeErrorClass = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#FFEBEE] text-[#C62828]';
export const badgeInfoClass = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#E3F2FD] text-[#1565C0]';
export const badgeNeutralClass = 'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#F5F5F5] text-[#6E6E73]';

/** Modal overlay */
export const modalOverlayClass = 'fixed inset-0 bg-black/40 flex items-center justify-center z-50';
export const modalCardClass = 'bg-white rounded-2xl shadow-apple-elevated w-full mx-4';
export const modalHeaderClass = 'flex items-center justify-between px-6 py-4 border-b border-[#F0F0F0]';
export const modalTitleClass = 'text-[17px] font-semibold text-[#1D1D1F]';

/** Loading spinner — the ONE spinner to rule them all */
export const spinnerClass = 'animate-spin rounded-full border-2 border-[#E5E5E5] border-t-[#EC7620]';
export const spinnerLgClass = 'w-12 h-12 animate-spin rounded-full border-[3px] border-[#E5E5E5] border-t-[#EC7620]';
export const spinnerSmClass = 'w-5 h-5 animate-spin rounded-full border-2 border-[#E5E5E5] border-t-[#EC7620]';

/** Empty state */
export const emptyStateClass = 'text-center py-12';
export const emptyIconClass = 'w-16 h-16 mx-auto mb-4 text-[#D1D1D6]';
export const emptyTitleClass = 'font-medium text-[#6E6E73]';
export const emptySubtitleClass = 'text-[13px] text-[#AEAEB2] mt-1';

/** Pagination container */
export const paginationClass = 'flex items-center justify-between bg-white rounded-2xl border border-[#E5E5E5] shadow-apple-card px-6 py-4';
export const paginationTextClass = 'text-sm text-[#6E6E73]';
export const paginationBtnClass = 'p-2 border border-[#E5E5E5] rounded-[10px] hover:bg-[#FAFAFA] disabled:opacity-40 transition-all';

/** Tabs (segmented control) — Apple style */
export const tabsContainerClass = 'flex gap-1 p-1 bg-[#F5F5F5] rounded-[10px] w-fit';
export const tabActiveClass = 'px-4 py-2 text-sm font-medium rounded-[8px] bg-white text-[#1D1D1F] shadow-sm transition-all';
export const tabClass = 'px-4 py-2 text-sm font-medium rounded-[8px] text-[#86868B] hover:text-[#1D1D1F] transition-all';

/** Inline tabs (inside card, like production page) */
export const inlineTabActiveClass = 'flex-shrink-0 px-6 py-4 text-sm font-semibold flex items-center justify-center gap-2 whitespace-nowrap text-[#EC7620] border-b-2 border-[#EC7620] bg-[#EC7620]/5';
export const inlineTabClass = 'flex-shrink-0 px-6 py-4 text-sm font-semibold flex items-center justify-center gap-2 whitespace-nowrap text-[#86868B] hover:bg-[#FAFAFA] transition-colors';

/** Error / Alert banner */
export const errorBannerClass = 'p-3 bg-[#FFEBEE] border border-[#FFCDD2] text-[#C62828] rounded-[10px] text-sm';
export const warningBannerClass = 'p-3 bg-[#FFF8E1] border border-[#FFE082] text-[#F57F17] rounded-[10px] text-sm';
export const successBannerClass = 'p-3 bg-[#E8F5E9] border border-[#A5D6A7] text-[#2E7D32] rounded-[10px] text-sm';

/** Page spacing */
export const pageContainerClass = 'space-y-6';

/** Stats grid */
export const statsGridClass = 'grid grid-cols-2 md:grid-cols-4 gap-5';

/** Divider */
export const dividerClass = 'border-t border-[#F0F0F0]';
