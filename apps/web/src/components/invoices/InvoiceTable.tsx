'use client';

import { FileText, Eye, FileDown, CheckCircle, Search, Pencil, X } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton, SkeletonTable } from '@/components/ui/skeleton-loader';
import { KeyboardHint } from '@/components/ui/keyboard-hint';
import { type Invoice, type StatusFilter, getStatusStyle, getStatusLabel } from './types';

interface InvoiceTableProps {
  invoices: Invoice[];
  meta: { total: number; page: number; totalPages: number };
  isLoading: boolean;
  searchQuery: string;
  statusFilter: StatusFilter;
  searchInputRef: React.RefObject<HTMLInputElement>;
  onSearchChange: (query: string) => void;
  onStatusFilterChange: (status: StatusFilter) => void;
  onPageChange: (page: number) => void;
  onViewDetail: (id: number) => void;
  onEdit: (invoice: Invoice) => void;
  onChangeStatus: (id: number, status: string) => void;
  onDownloadPdf: (id: number, reference?: string) => void;
}

export function InvoiceTable({
  invoices,
  meta,
  isLoading,
  searchQuery,
  statusFilter,
  searchInputRef,
  onSearchChange,
  onStatusFilterChange,
  onPageChange,
  onViewDetail,
  onEdit,
  onChangeStatus,
  onDownloadPdf,
}: InvoiceTableProps) {
  if (isLoading) {
    return (
      <div className="glass-bg space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-9 w-36 rounded-full" />
        </div>
        <SkeletonTable rows={5} columns={6} />
      </div>
    );
  }

  return (
    <>
      <div className="glass-card overflow-hidden">
        {/* Search & Filter */}
        <div className="px-5 py-3 border-b border-black/[0.04] bg-white/40 backdrop-blur-sm flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AEAEB2]" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Rechercher par reference ou client..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-10 py-2 text-sm rounded-full bg-white/60 border border-black/[0.04] focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF] placeholder:text-[#86868B]"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              <KeyboardHint shortcut="/" />
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(['ALL', 'DRAFT', 'VALIDATED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'] as const).map((s) => {
              const labels: Record<string, string> = { ALL: 'Tous', DRAFT: 'Brouillon', VALIDATED: 'Validee', PARTIALLY_PAID: 'Part. payee', PAID: 'Payee', CANCELLED: 'Annulee' };
              return (
                <button
                  key={s}
                  onClick={() => onStatusFilterChange(s)}
                  className={statusFilter === s
                    ? 'px-3 py-1.5 text-xs font-semibold rounded-full bg-[#007AFF] text-white shadow-sm transition-all'
                    : 'px-3 py-1.5 text-xs font-medium rounded-full text-[#86868B] bg-white/60 border border-black/[0.04] hover:bg-white/80 transition-all'
                  }
                >
                  {labels[s]}
                </button>
              );
            })}
          </div>
        </div>
        <table className="w-full">
          <thead className="bg-white/40 backdrop-blur-sm border-b border-black/[0.04]">
            <tr>
              <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Reference</th>
              <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Date</th>
              <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Client</th>
              <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Net a payer</th>
              <th className="px-5 py-3.5 text-center text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Statut</th>
              <th className="px-5 py-3.5 text-right text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0F0F0]">
            {invoices.map((invoice) => (
              <InvoiceRow
                key={invoice.id}
                invoice={invoice}
                onViewDetail={onViewDetail}
                onEdit={onEdit}
                onChangeStatus={onChangeStatus}
                onDownloadPdf={onDownloadPdf}
              />
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center">
                  <FileText className="w-12 h-12 text-[#86868B]/40 mx-auto mb-3" />
                  <p className="text-[#86868B] font-medium">Aucune facture trouvee</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <Pagination
        page={meta.page}
        totalPages={meta.totalPages}
        total={meta.total}
        onPageChange={onPageChange}
      />
    </>
  );
}

// ── Invoice Row ──────────────────────────────────────────────────────────────

interface InvoiceRowProps {
  invoice: Invoice;
  onViewDetail: (id: number) => void;
  onEdit: (invoice: Invoice) => void;
  onChangeStatus: (id: number, status: string) => void;
  onDownloadPdf: (id: number, reference?: string) => void;
}

function InvoiceRow({ invoice, onViewDetail, onEdit, onChangeStatus, onDownloadPdf }: InvoiceRowProps) {
  return (
    <tr className="group hover:bg-white/60 transition-colors">
      <td className="px-5 py-4 text-[14px] text-[#1D1D1F]">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#EC7620]" />
          <span className="font-mono text-sm font-medium">{invoice.reference}</span>
        </div>
      </td>
      <td className="px-5 py-4 text-[14px] text-[#86868B]">{formatDate(invoice.date)}</td>
      <td className="px-5 py-4 text-[14px] text-[#1D1D1F] font-medium">{invoice.client?.name || '-'}</td>
      <td className="px-5 py-4 text-[14px] text-[#1D1D1F] text-right font-semibold">{formatCurrency(invoice.netToPay)}</td>
      <td className="px-5 py-4 text-[14px] text-[#1D1D1F] text-center">
        <span className={`glass-status-pill inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold ${getStatusStyle(invoice.status)}`}>
          {getStatusLabel(invoice.status)}
        </span>
      </td>
      <td className="px-5 py-4 text-[14px] text-[#1D1D1F] text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => onViewDetail(invoice.id)}
            className="p-2 rounded-xl text-[#86868B] hover:text-[#007AFF] hover:bg-[#007AFF]/10 transition-all"
            title="Voir details"
          >
            <Eye className="w-4 h-4" />
          </button>
          {invoice.status === 'DRAFT' && (
            <>
              <button
                onClick={() => onEdit(invoice)}
                className="p-2 rounded-xl text-[#86868B] hover:text-[#FF9500] hover:bg-[#FF9500]/10 transition-all"
                title="Modifier la facture"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => onChangeStatus(invoice.id, 'VALIDATED')}
                className="p-2 rounded-xl text-[#86868B] hover:text-[#007AFF] hover:bg-[#007AFF]/10 transition-all"
                title="Valider la facture"
              >
                <CheckCircle className="w-4 h-4" />
              </button>
              <button
                onClick={() => onChangeStatus(invoice.id, 'CANCELLED')}
                className="p-2 rounded-xl text-[#86868B] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 transition-all"
                title="Annuler la facture"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
          {invoice.status === 'VALIDATED' && (
            <>
              <button
                onClick={() => onChangeStatus(invoice.id, 'PAID')}
                className="p-2 rounded-xl text-[#86868B] hover:text-[#34C759] hover:bg-[#34C759]/10 transition-all"
                title="Marquer payee"
              >
                <CheckCircle className="w-4 h-4" />
              </button>
              <button
                onClick={() => onChangeStatus(invoice.id, 'CANCELLED')}
                className="p-2 rounded-xl text-[#86868B] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 transition-all"
                title="Annuler la facture"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
          {invoice.status === 'PARTIALLY_PAID' && (
            <>
              <button
                onClick={() => onChangeStatus(invoice.id, 'PAID')}
                className="p-2 rounded-xl text-[#86868B] hover:text-[#34C759] hover:bg-[#34C759]/10 transition-all"
                title="Marquer payee"
              >
                <CheckCircle className="w-4 h-4" />
              </button>
              <button
                onClick={() => onChangeStatus(invoice.id, 'CANCELLED')}
                className="p-2 rounded-xl text-[#86868B] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 transition-all"
                title="Annuler la facture"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            onClick={() => onDownloadPdf(invoice.id, invoice.reference)}
            className="p-2 rounded-xl text-[#86868B] hover:text-[#007AFF] hover:bg-[#007AFF]/10 transition-all"
            title="Telecharger PDF"
          >
            <FileDown className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
