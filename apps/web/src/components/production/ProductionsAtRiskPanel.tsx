'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PRODUCTIONS AT RISK PANEL — A1
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Question metier: "Quelles productions prevues vont echouer si je ne fais rien ?"
 * Erreur humaine empechee: Lancer une production sans stock suffisant
 *
 * Affichage:
 * - CRITICAL en premier
 * - WARNING ensuite
 * - max 5 lignes visibles
 * - toujours AU-DESSUS du planning
 */

import Link from 'next/link';
import { useRef } from 'react';
import {
  AlertTriangle, Package, Truck, XCircle, AlertCircle,
  ExternalLink, ChevronRight, Printer,
  User, RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BlockReasonTooltip } from './BlockReasonTooltip';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProductionRiskReason {
  type: 'MP' | 'BC';
  label: string;
  code?: string;
  daysCover?: number;
  daysLate?: number;
  supplierName?: string;
}

export interface ProductionAtRisk {
  orderId: number;
  reference: string;
  productName: string;
  productCode: string;
  plannedDate: string;
  riskLevel: 'CRITICAL' | 'WARNING';
  reasons: ProductionRiskReason[];
  canStart: boolean;
  batchCount: number;
  targetQuantity: number;
}

export interface ProductionsAtRiskData {
  productions: ProductionAtRisk[];
  summary: {
    totalAtRisk: number;
    critical: number;
    warning: number;
  };
  generatedAt: string;
}

interface ProductionsAtRiskPanelProps {
  data: ProductionsAtRiskData | null;
  isLoading?: boolean;
  maxVisible?: number;
  lastRefresh?: Date | null;
  approManagerName?: string;
  approManagerId?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function ProductionsAtRiskPanel({
  data,
  isLoading,
  maxVisible = 5,
  lastRefresh,
  approManagerName,
  approManagerId
}: ProductionsAtRiskPanelProps) {
  const printRef = useRef<HTMLDivElement>(null);

  // Export PDF / Impression — Uses cloneNode to avoid XSS from innerHTML
  const handlePrint = () => {
    if (!printRef.current || !data) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Build print content safely using DOM APIs (no innerHTML injection)
    const doc = printWindow.document;
    doc.open();
    doc.write('<!DOCTYPE html><html><head></head><body></body></html>');
    doc.close();

    // Add print styles
    const style = doc.createElement('style');
    style.textContent = `
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; }
      h1 { color: #dc2626; font-size: 18px; margin-bottom: 4px; }
      .timestamp { color: #6b7280; font-size: 12px; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th { background: #f3f4f6; text-align: left; padding: 8px; border-bottom: 2px solid #e5e7eb; font-weight: 600; }
      td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
      .footer { margin-top: 20px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #6b7280; }
      @media print { body { padding: 0; } }
    `;
    doc.head.appendChild(style);
    doc.title = `Productions à Risque - ${new Date().toLocaleDateString('fr-FR')}`;

    // Clone the table safely (no raw HTML injection)
    const clonedContent = printRef.current.cloneNode(true) as HTMLElement;
    // Remove any script tags from cloned content as defense-in-depth
    clonedContent.querySelectorAll('script').forEach(el => el.remove());

    const h1 = doc.createElement('h1');
    h1.textContent = 'Productions à Risque';
    doc.body.appendChild(h1);

    const timestamp = doc.createElement('p');
    timestamp.className = 'timestamp';
    const refreshTime = lastRefresh ? lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'N/A';
    timestamp.textContent = `Généré le ${new Date().toLocaleString('fr-FR')} • Dernière analyse: ${refreshTime}`;
    doc.body.appendChild(timestamp);

    doc.body.appendChild(clonedContent);

    const footer = doc.createElement('div');
    footer.className = 'footer';
    const footerP = doc.createElement('p');
    footerP.textContent = 'Manchengo Smart ERP • Document de travail interne';
    footer.appendChild(footerP);
    if (approManagerName) {
      const managerP = doc.createElement('p');
      managerP.textContent = `Responsable Appro: ${approManagerName}`;
      footer.appendChild(managerP);
    }
    doc.body.appendChild(footer);

    printWindow.print();
  };
  if (isLoading) {
    return (
      <div className="glass-card rounded-[20px] overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-black/[0.04]">
          <div className="h-6 bg-[#E5E5E5] rounded w-1/3 animate-pulse"></div>
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-black/[0.03] rounded-xl animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.productions.length === 0) {
    return null; // Ne rien afficher si aucune production à risque
  }

  const visibleProductions = data.productions.slice(0, maxVisible);
  const hasMore = data.productions.length > maxVisible;

  return (
    <div className="glass-decision-card glass-tint-red rounded-[20px] overflow-hidden mb-6">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#FF3B30]/10 bg-gradient-to-br from-[#FF3B30]/10 to-[#FF3B30]/5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-[#FF3B30] flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Productions a risque
            <span className="glass-pill inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-sm font-semibold text-[#FF3B30]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF3B30]" />
              {data.summary.totalAtRisk}
            </span>
          </h2>
          <div className="flex items-center gap-3">
            {/* Horodatage derniere analyse */}
            {lastRefresh && (
              <span className="glass-status-pill flex items-center gap-1.5 text-xs text-[#FF3B30] px-3 py-1.5 rounded-full">
                <RefreshCw className="w-3 h-3" />
                Derniere analyse : {lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {/* Export PDF / Impression */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-[#FF3B30] glass-card hover:bg-[#FF3B30]/10 rounded-full transition-colors print:hidden"
              title="Exporter / Imprimer"
            >
              <Printer className="w-3.5 h-3.5" />
              Exporter PDF
            </button>
            {data.summary.critical > 0 && (
              <span className="px-3 py-1.5 bg-[#FF3B30] text-white text-xs rounded-full font-medium shadow-lg shadow-[#FF3B30]/20">
                {data.summary.critical} bloque{data.summary.critical > 1 ? 's' : ''}
              </span>
            )}
            {data.summary.warning > 0 && (
              <span className="px-3 py-1.5 bg-[#FF9500] text-white text-xs rounded-full font-medium shadow-lg shadow-[#FF9500]/20">
                {data.summary.warning} a surveiller
              </span>
            )}
          </div>
        </div>
        <p className="text-sm text-[#FF3B30]/80 mt-1">
          Ces productions ne pourront pas demarrer sans action sur l'approvisionnement
        </p>
      </div>

      {/* Table (avec ref pour impression) */}
      <div className="overflow-x-auto" ref={printRef}>
        <table className="w-full">
          <thead>
            <tr className="bg-black/[0.03] text-left text-xs font-semibold text-[#86868B] uppercase tracking-wider">
              <th className="px-5 py-3">Ordre</th>
              <th className="px-5 py-3">Produit</th>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Risque</th>
              <th className="px-5 py-3">Cause</th>
              <th className="px-5 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04]">
            {visibleProductions.map((prod) => (
              <ProductionAtRiskRow key={prod.orderId} production={prod} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer with actions */}
      <div className="px-5 py-4 border-t border-black/[0.04] bg-black/[0.03] print:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/appro"
              className="flex items-center gap-2 px-5 py-2.5 bg-[#FF3B30] text-white rounded-full text-sm font-semibold hover:bg-[#FF3B30]/90 transition-colors shadow-lg shadow-[#FF3B30]/20"
            >
              <ExternalLink className="w-4 h-4" />
              Voir Approvisionnement (lecture seule)
            </Link>
            <Link
              href="/dashboard/stock/mp"
              className="flex items-center gap-2 px-5 py-2.5 bg-black/[0.06] text-[#1D1D1F] rounded-full text-sm font-medium hover:bg-black/[0.10] transition-colors backdrop-blur-sm"
            >
              <Package className="w-4 h-4" />
              Voir detail stock
            </Link>
            {/* Lien direct vers responsable Appro (lecture seule) */}
            {approManagerName && approManagerId && (
              <Link
                href={`/dashboard/users/${approManagerId}?context=appro`}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-br from-[#AF52DE]/10 to-[#AF52DE]/5 text-[#AF52DE] rounded-full text-sm font-medium hover:from-[#AF52DE]/20 hover:to-[#AF52DE]/10 transition-colors border border-[#AF52DE]/15"
                title="Voir le profil du responsable appro (lecture seule)"
              >
                <User className="w-4 h-4" />
                Responsable : {approManagerName}
              </Link>
            )}
          </div>
          {hasMore && (
            <span className="text-sm text-[#86868B]">
              +{data.productions.length - maxVisible} autre{data.productions.length - maxVisible > 1 ? 's' : ''} production{data.productions.length - maxVisible > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROW COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function ProductionAtRiskRow({ production }: { production: ProductionAtRisk }) {
  const isCritical = production.riskLevel === 'CRITICAL';
  const plannedDate = new Date(production.plannedDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Format date relative
  const daysDiff = Math.ceil((plannedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  let dateLabel = '';
  if (daysDiff <= 0) dateLabel = "Aujourd'hui";
  else if (daysDiff === 1) dateLabel = 'Demain';
  else dateLabel = `J+${daysDiff}`;

  // Format reasons for tooltip
  const reasonLabels = production.reasons.map(r => r.label);

  return (
    <tr className={cn(
      'hover:bg-black/[0.02] transition-colors',
      isCritical ? 'bg-[#FF3B30]/[0.03]' : 'bg-[#FF9500]/[0.03]'
    )}>
      {/* Ordre */}
      <td className="px-5 py-4">
        <Link
          href={`/dashboard/production/order/${production.orderId}`}
          className="font-mono text-sm font-semibold text-[#1D1D1F] hover:text-[#AF52DE]"
        >
          {production.reference}
        </Link>
      </td>

      {/* Produit */}
      <td className="px-5 py-4">
        <div>
          <p className="font-medium text-[#1D1D1F]">{production.productName}</p>
          <p className="text-xs text-[#86868B]">
            {production.batchCount} lot{production.batchCount > 1 ? 's' : ''} · {production.targetQuantity} unites
          </p>
        </div>
      </td>

      {/* Date */}
      <td className="px-5 py-4">
        <span className={cn(
          'glass-status-pill px-2.5 py-1 rounded-full text-sm font-medium',
          daysDiff <= 0 ? 'bg-gradient-to-br from-[#FF3B30]/10 to-[#FF3B30]/5 text-[#FF3B30]' :
          daysDiff === 1 ? 'bg-gradient-to-br from-[#FF9500]/10 to-[#FF9500]/5 text-[#FF9500]' :
          'bg-black/[0.03] text-[#1D1D1F]'
        )}>
          {dateLabel}
        </span>
      </td>

      {/* Risque */}
      <td className="px-5 py-4">
        <div className="flex items-center gap-2">
          {isCritical ? (
            <span className="glass-pill inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-semibold text-[#FF3B30]">
              <XCircle className="w-4 h-4" />
              Bloque
            </span>
          ) : (
            <span className="glass-pill inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-semibold text-[#FF9500]">
              <AlertCircle className="w-4 h-4" />
              A risque
            </span>
          )}
        </div>
      </td>

      {/* Cause */}
      <td className="px-5 py-4">
        <BlockReasonTooltip reasons={reasonLabels}>
          <div className="flex flex-wrap gap-1 max-w-xs">
            {production.reasons.slice(0, 2).map((reason, idx) => (
              <span
                key={idx}
                className={cn(
                  'glass-pill inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium',
                  reason.type === 'MP'
                    ? 'text-[#AF52DE]'
                    : 'text-[#007AFF]'
                )}
              >
                {reason.type === 'MP' ? (
                  <Package className="w-3 h-3" />
                ) : (
                  <Truck className="w-3 h-3" />
                )}
                {reason.code || reason.label.slice(0, 20)}
                {reason.daysCover !== undefined && ` (${reason.daysCover.toFixed(1)}j)`}
                {reason.daysLate !== undefined && ` (+${reason.daysLate}j)`}
              </span>
            ))}
            {production.reasons.length > 2 && (
              <span className="text-xs text-[#86868B]">
                +{production.reasons.length - 2}
              </span>
            )}
          </div>
        </BlockReasonTooltip>
      </td>

      {/* Action */}
      <td className="px-5 py-4 text-right">
        <Link
          href={`/dashboard/production/order/${production.orderId}`}
          className="inline-flex items-center gap-1 text-sm text-[#AF52DE] hover:text-[#AF52DE]/80 font-medium"
        >
          Details
          <ChevronRight className="w-4 h-4" />
        </Link>
      </td>
    </tr>
  );
}
