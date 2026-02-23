'use client';

import { useState } from 'react';
import { FileText, FileSpreadsheet, Download, Calendar, Loader2, Package, Factory } from 'lucide-react';
import { authFetch } from '@/lib/api';
import { useRequireRole } from '@/lib/hooks/use-require-role';
import { PageHeader } from '@/components/ui/page-header';

type ExportFormat = 'pdf' | 'excel';

interface ExportType {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  icon: React.ReactNode;
}

// Fiscal exports
const fiscalExportTypes: ExportType[] = [
  {
    id: 'sales',
    name: 'Journal des Ventes',
    description: 'Liste de toutes les factures avec totaux fiscaux',
    endpoint: '/exports/sales',
    icon: <FileText className="h-6 w-6" />,
  },
  {
    id: 'vat',
    name: 'Journal de TVA',
    description: 'Détail HT et TVA par facture pour déclaration G50',
    endpoint: '/exports/vat',
    icon: <FileText className="h-6 w-6" />,
  },
  {
    id: 'stamp',
    name: 'Journal du Timbre Fiscal',
    description: 'Factures en espèces avec timbre fiscal appliqué',
    endpoint: '/exports/stamp',
    icon: <FileText className="h-6 w-6" />,
  },
  {
    id: 'stock',
    name: 'État des Stocks (Global)',
    description: 'Mouvements MP et PF: initial, entrées, sorties, final',
    endpoint: '/exports/stock',
    icon: <FileSpreadsheet className="h-6 w-6" />,
  },
];

// MP exports
const mpExportTypes: ExportType[] = [
  {
    id: 'mp-stocks',
    name: 'État des Stocks MP',
    description: 'Stock initial, entrées (réceptions), sorties (production), stock final, valeur',
    endpoint: '/exports/mp/stocks',
    icon: <FileSpreadsheet className="h-6 w-6" />,
  },
  {
    id: 'mp-receptions',
    name: 'Journal des Réceptions MP',
    description: 'Date, fournisseur, BL, produit, quantité, coût unitaire, montant',
    endpoint: '/exports/mp/receptions',
    icon: <FileText className="h-6 w-6" />,
  },
];

// PF exports
const pfExportTypes: ExportType[] = [
  {
    id: 'pf-stocks',
    name: 'État des Stocks PF',
    description: 'Stock initial, entrées (production), sorties (ventes), stock final, valeur',
    endpoint: '/exports/pf/stocks',
    icon: <FileSpreadsheet className="h-6 w-6" />,
  },
  {
    id: 'pf-production',
    name: 'Journal de Production PF',
    description: 'Date, référence OF, produit, quantité, lots consommés, rendement, responsable',
    endpoint: '/exports/pf/production',
    icon: <FileText className="h-6 w-6" />,
  },
];

export default function ExportsPage() {
  const { hasAccess, isAccessDenied } = useRequireRole(['ADMIN']);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async (exportType: ExportType, format: ExportFormat) => {
    const loadingKey = `${exportType.id}-${format}`;
    setLoading(loadingKey);
    setError(null);

    try {
      const url = `${exportType.endpoint}?startDate=${startDate}&endDate=${endDate}&format=${format}`;

      const response = await authFetch(url, { credentials: 'include' });

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `${exportType.id}_${startDate}_${endDate}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      if (contentDisposition) {
        // Handle both quoted and unquoted filenames, remove trailing quotes/chars
        const match = contentDisposition.match(/filename[^;=\n]*=["']?([^"';\n]+)/);
        if (match) {
          filename = match[1].replace(/["']+$/, '').trim();
        }
      }

      // Download the file
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du téléchargement');
    } finally {
      setLoading(null);
    }
  };

  const isLoading = (exportId: string, format: ExportFormat) => loading === `${exportId}-${format}`;

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-64">
        {isAccessDenied ? (
          <div className="glass-card p-8 text-center">
            <div className="w-12 h-12 rounded-[28px] bg-gradient-to-br from-[#FF3B30]/20 to-[#FF3B30]/10 flex items-center justify-center mx-auto mb-3">
              <Download className="w-6 h-6 text-[#FF3B30]" />
            </div>
            <p className="text-lg font-semibold text-[#1D1D1F]">Accès interdit</p>
            <p className="text-sm text-[#86868B] mt-1">Redirection vers le dashboard...</p>
          </div>
        ) : (
          <div className="w-8 h-8 loading-spinner" />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <PageHeader
        title="Exports"
        subtitle="Documents fiscaux, stocks et production — PDF & Excel"
        icon={<Download className="w-5 h-5" />}
      />

      {/* Date Range Picker */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FF9500]/10 to-[#FF9500]/5 flex items-center justify-center">
            <Calendar className="w-4 h-4 text-[#FF9500]" />
          </div>
          <h3 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight">Période</h3>
        </div>
        <div className="flex flex-wrap gap-6 items-end">
          <div>
            <label className="block text-[13px] font-medium text-[#86868B] mb-1.5">Date de début</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="px-4 py-2.5 border border-black/[0.04] rounded-xl bg-white/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF9500]/20 focus:border-[#FF9500] transition-all" />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#86868B] mb-1.5">Date de fin</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="px-4 py-2.5 border border-black/[0.04] rounded-xl bg-white/60 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF9500]/20 focus:border-[#FF9500] transition-all" />
          </div>
          <div className="px-4 py-2.5 bg-black/5 rounded-full text-sm text-[#86868B]">
            Du <span className="font-medium text-[#1D1D1F]">{new Date(startDate).toLocaleDateString('fr-DZ')}</span> au{' '}
            <span className="font-medium text-[#1D1D1F]">{new Date(endDate).toLocaleDateString('fr-DZ')}</span>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-[#FF3B30]/10 border border-[#FF3B30]/20 rounded-[28px] text-sm font-medium text-[#FF3B30]">
          <FileText className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* EXPORTS FISCAUX */}
      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-black/[0.04] flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#007AFF]/10 to-[#007AFF]/5 flex items-center justify-center">
            <FileText className="w-4 h-4 text-[#007AFF]" />
          </div>
          <div>
            <h3 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight">Exports Fiscaux</h3>
            <p className="text-[11px] text-[#86868B]">Documents conformes à la réglementation algérienne</p>
          </div>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {fiscalExportTypes.map((exportType) => (
            <div
              key={exportType.id}
              className="p-5 rounded-xl border border-black/[0.04] hover:bg-white/60 transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#007AFF]/10 to-[#007AFF]/5 flex items-center justify-center text-[#007AFF]">
                  {exportType.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight">{exportType.name}</h3>
                  <p className="text-sm text-[#86868B] mt-1">{exportType.description}</p>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => handleExport(exportType, 'pdf')}
                      disabled={loading !== null}
                      className="flex items-center gap-2 px-4 py-2 bg-[#FF3B30] text-white rounded-full hover:bg-[#D62D22] disabled:opacity-50 transition-all text-sm font-semibold shadow-sm"
                    >
                      {isLoading(exportType.id, 'pdf') ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      PDF
                    </button>
                    <button
                      onClick={() => handleExport(exportType, 'excel')}
                      disabled={loading !== null}
                      className="flex items-center gap-2 px-4 py-2 bg-[#34C759] text-white rounded-full hover:bg-[#2DA94E] disabled:opacity-50 transition-all text-sm font-semibold shadow-sm"
                    >
                      {isLoading(exportType.id, 'excel') ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      Excel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* EXPORTS STOCKS & PRODUCTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* MP Section */}
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-4 border-b border-black/[0.04] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FF9500]/10 to-[#FF9500]/5 flex items-center justify-center">
              <Package className="w-4 h-4 text-[#FF9500]" />
            </div>
            <div>
              <h3 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight">Matières Premières (MP)</h3>
              <p className="text-[11px] text-[#86868B]">Stocks et réceptions</p>
            </div>
          </div>
          <div className="p-5 space-y-4">
            {mpExportTypes.map((exportType) => (
              <div
                key={exportType.id}
                className="p-4 rounded-xl border border-black/[0.04] hover:bg-white/60 transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF9500]/10 to-[#FF9500]/5 flex items-center justify-center text-[#FF9500]">
                    {exportType.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-[#1D1D1F]">{exportType.name}</h3>
                    <p className="text-sm text-[#86868B] mt-0.5">{exportType.description}</p>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleExport(exportType, 'pdf')}
                        disabled={loading !== null}
                        className="flex items-center gap-2 px-4 py-2 bg-[#FF3B30] text-white rounded-full hover:bg-[#D62D22] disabled:opacity-50 transition-all text-xs font-semibold shadow-sm"
                      >
                        {isLoading(exportType.id, 'pdf') ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        PDF
                      </button>
                      <button
                        onClick={() => handleExport(exportType, 'excel')}
                        disabled={loading !== null}
                        className="flex items-center gap-2 px-4 py-2 bg-[#34C759] text-white rounded-full hover:bg-[#2DA94E] disabled:opacity-50 transition-all text-xs font-semibold shadow-sm"
                      >
                        {isLoading(exportType.id, 'excel') ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        Excel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PF Section */}
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-4 border-b border-black/[0.04] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#AF52DE]/10 to-[#AF52DE]/5 flex items-center justify-center">
              <Factory className="w-4 h-4 text-[#AF52DE]" />
            </div>
            <div>
              <h3 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight">Produits Finis (PF)</h3>
              <p className="text-[11px] text-[#86868B]">Stocks et production</p>
            </div>
          </div>
          <div className="p-5 space-y-4">
            {pfExportTypes.map((exportType) => (
              <div
                key={exportType.id}
                className="p-4 rounded-xl border border-black/[0.04] hover:bg-white/60 transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#AF52DE]/10 to-[#AF52DE]/5 flex items-center justify-center text-[#AF52DE]">
                    {exportType.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-[#1D1D1F]">{exportType.name}</h3>
                    <p className="text-sm text-[#86868B] mt-0.5">{exportType.description}</p>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleExport(exportType, 'pdf')}
                        disabled={loading !== null}
                        className="flex items-center gap-2 px-4 py-2 bg-[#FF3B30] text-white rounded-full hover:bg-[#D62D22] disabled:opacity-50 transition-all text-xs font-semibold shadow-sm"
                      >
                        {isLoading(exportType.id, 'pdf') ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        PDF
                      </button>
                      <button
                        onClick={() => handleExport(exportType, 'excel')}
                        disabled={loading !== null}
                        className="flex items-center gap-2 px-4 py-2 bg-[#34C759] text-white rounded-full hover:bg-[#2DA94E] disabled:opacity-50 transition-all text-xs font-semibold shadow-sm"
                      >
                        {isLoading(exportType.id, 'excel') ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        Excel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legal Notice */}
      <div className="glass-card p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF9500]/10 to-[#FF9500]/5 flex items-center justify-center flex-shrink-0">
          <FileText className="w-5 h-5 text-[#FF9500]" />
        </div>
        <div>
          <h3 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight">Avis légal</h3>
          <p className="text-sm text-[#86868B] mt-1">
            Ces exports sont des instantanés en lecture seule des données fiscales.
            Les documents générés sont conformes aux exigences de la réglementation fiscale algérienne
            (TVA 19%, Timbre fiscal selon barème).
          </p>
        </div>
      </div>
    </div>
  );
}
