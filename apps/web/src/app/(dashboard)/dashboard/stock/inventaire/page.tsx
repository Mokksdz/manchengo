'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { authFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  ClipboardList,
  Check,
  X,
  Clock,
  Search,
  RefreshCw,
  Loader2,
  Shield,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { createLogger } from '@/lib/logger';

const log = createLogger('Inventaire');

interface InventoryDeclaration {
  id: number;
  productType: 'MP' | 'PF';
  productName: string;
  productCode: string;
  declaredQuantity: number;
  systemQuantity: number;
  difference: number;
  differencePercent: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: string;
  countedBy: { firstName: string; lastName: string };
  countedAt: string;
  validatedBy?: { firstName: string; lastName: string };
  validatedAt?: string;
  notes?: string;
}

const riskDotColors = {
  LOW: 'bg-[#34C759]',
  MEDIUM: 'bg-[#FF9500]',
  HIGH: 'bg-[#FF9500]',
  CRITICAL: 'bg-[#FF3B30]',
};

const riskTextColors = {
  LOW: 'text-[#34C759]',
  MEDIUM: 'text-[#FF9500]',
  HIGH: 'text-[#FF9500]',
  CRITICAL: 'text-[#FF3B30]',
};

const statusLabels: Record<string, string> = {
  PENDING_VALIDATION: 'En attente',
  PENDING_DOUBLE_VALIDATION: 'Double validation',
  FIRST_VALIDATION_DONE: '1ère validation OK',
  VALIDATED: 'Validé',
  REJECTED: 'Rejeté',
  AUTO_APPROVED: 'Auto-approuvé',
};

export default function InventairePage() {
  const { user } = useAuth();
  const [declarations, setDeclarations] = useState<InventoryDeclaration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [processingId, setProcessingId] = useState<number | null>(null);

  const canValidate = user?.role === 'ADMIN';

  const loadDeclarations = useCallback(async () => {
    try {
      setIsLoading(true);
      const endpoint = filter === 'pending' ? '/inventory/pending' : '/inventory/all';
      const res = await authFetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        setDeclarations(data.data || data || []);
      }
    } catch (err) {
      log.error('Failed to load declarations', { error: err instanceof Error ? err.message : String(err) });
      toast.error('Erreur de chargement des déclarations');
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadDeclarations();
  }, [loadDeclarations]);

  const handleValidate = async (id: number, approvalReason: string) => {
    if (!canValidate) {
      toast.error('Seuls les ADMIN peuvent valider');
      return;
    }

    try {
      setProcessingId(id);
      const res = await authFetch(`/inventory/${id}/validate`, {
        method: 'POST',
        body: JSON.stringify({ approvalReason }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || 'Validation effectuée');
        loadDeclarations();
      } else {
        const error = await res.json();
        toast.error(error.message || 'Erreur de validation');
      }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch {
      toast.error('Erreur de validation');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: number, reason: string) => {
    if (!canValidate) {
      toast.error('Seuls les ADMIN peuvent rejeter');
      return;
    }

    if (!reason.trim()) {
      toast.error('Un motif de rejet est requis');
      return;
    }

    try {
      setProcessingId(id);
      const res = await authFetch(`/inventory/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ rejectionReason: reason }),
      });

      if (res.ok) {
        toast.success('Déclaration rejetée');
        loadDeclarations();
      } else {
        const error = await res.json();
        toast.error(error.message || 'Erreur de rejet');
      }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch {
      toast.error('Erreur de rejet');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredDeclarations = declarations.filter((d) =>
    searchQuery
      ? d.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.productCode.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  return (
    <div className="glass-bg space-y-6">
      <PageHeader
        title="Gestion Inventaire"
        subtitle="Déclarations et validations"
        icon={<ClipboardList className="w-5 h-5" />}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <button
                onClick={() => setFilter('pending')}
                className={cn(
                  'px-3 py-1.5 text-[12px] font-medium rounded-full transition-all',
                  filter === 'pending'
                    ? 'bg-[#1D1D1F] text-white'
                    : 'glass-pill text-[#86868B] hover:text-[#1D1D1F]'
                )}
              >
                En attente
              </button>
              <button
                onClick={() => setFilter('all')}
                className={cn(
                  'px-3 py-1.5 text-[12px] font-medium rounded-full transition-all',
                  filter === 'all'
                    ? 'bg-[#1D1D1F] text-white'
                    : 'glass-pill text-[#86868B] hover:text-[#1D1D1F]'
                )}
              >
                Historique
              </button>
            </div>
            <Button onClick={loadDeclarations} variant="outline" size="icon" className="rounded-full">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        }
      />

      {/* ─── Search ─── */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#C7C7CC]" />
        <input
          type="text"
          placeholder="Rechercher un produit..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 text-[13px] rounded-[14px] bg-white/72 backdrop-blur-xl border border-white/20 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/15 focus:border-[#007AFF] placeholder:text-[#C7C7CC]"
        />
      </div>

      {/* ─── Declarations List ─── */}
      {isLoading ? (
        <div className="glass-card rounded-[28px] flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-[3px] border-[#E5E5EA] border-t-[#1D1D1F] rounded-full animate-spin" />
            <p className="text-[12px] text-[#86868B]">Chargement...</p>
          </div>
        </div>
      ) : filteredDeclarations.length === 0 ? (
        <div className="glass-card rounded-[28px] p-12 text-center">
          <div className="w-12 h-12 bg-black/[0.03] rounded-full flex items-center justify-center mx-auto mb-3">
            <ClipboardList className="h-6 w-6 text-[#C7C7CC]" />
          </div>
          <p className="text-[14px] font-medium text-[#86868B]">Aucune déclaration</p>
          <p className="text-[12px] text-[#C7C7CC] mt-1">
            {filter === 'pending' ? 'Aucune déclaration en attente de validation' : 'Aucun historique disponible'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDeclarations.map((decl) => (
            <DeclarationCard
              key={decl.id}
              declaration={decl}
              canValidate={canValidate}
              isProcessing={processingId === decl.id}
              currentUserId={user?.id}
              onValidate={(reason) => handleValidate(decl.id, reason)}
              onReject={(reason) => handleReject(decl.id, reason)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface DeclarationCardProps {
  declaration: InventoryDeclaration;
  canValidate: boolean;
  isProcessing: boolean;
  currentUserId?: string;
  onValidate: (reason: string) => void;
  onReject: (reason: string) => void;
}

function DeclarationCard({
  declaration: d,
  canValidate,
  isProcessing,
  currentUserId,
  onValidate,
  onReject,
}: DeclarationCardProps) {
  const [showActions, setShowActions] = useState(false);
  const [reason, setReason] = useState('');

  const isPending = d.status.includes('PENDING') || d.status === 'FIRST_VALIDATION_DONE';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isOwnDeclaration = currentUserId === (d.countedBy as any)?.id;

  return (
    <div className="glass-card-hover rounded-[28px] overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="glass-pill px-2 py-0.5 text-[11px] font-medium text-[#86868B]">
                {d.productType}
              </span>
              <span className="font-semibold text-[14px] text-[#1D1D1F]">{d.productCode}</span>
              <span className="text-[14px] text-[#86868B]">{d.productName}</span>
            </div>
            <div className="flex items-center gap-4 text-[12px] text-[#86868B]">
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {d.countedBy.firstName} {d.countedBy.lastName}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {new Date(d.countedAt).toLocaleString('fr-FR')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Risk dot indicator */}
            <span className="inline-flex items-center gap-1.5">
              <span className={cn('w-2 h-2 rounded-full', riskDotColors[d.riskLevel])} />
              <span className={cn('text-[11px] font-medium', riskTextColors[d.riskLevel])}>
                {d.riskLevel}
              </span>
            </span>
            <span className="glass-pill px-2.5 py-1 text-[11px] font-medium text-[#86868B]">
              {statusLabels[d.status] || d.status}
            </span>
          </div>
        </div>

        {/* Quantities */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-3 bg-black/[0.03] rounded-xl">
            <div className="text-[11px] text-[#86868B] mb-1">Déclaré</div>
            <div className="text-[20px] font-bold text-[#1D1D1F]">{d.declaredQuantity}</div>
          </div>
          <div className="text-center p-3 bg-black/[0.03] rounded-xl">
            <div className="text-[11px] text-[#86868B] mb-1">Système</div>
            <div className="text-[20px] font-bold text-[#1D1D1F]">{d.systemQuantity}</div>
          </div>
          <div className="text-center p-3 bg-black/[0.03] rounded-xl">
            <div className="text-[11px] text-[#86868B] mb-1">Écart</div>
            <div className={cn(
              'text-[20px] font-bold',
              d.difference === 0 ? 'text-[#34C759]' : d.difference < 0 ? 'text-[#FF3B30]' : 'text-[#FF9500]'
            )}>
              {d.difference > 0 ? '+' : ''}{d.difference}
              <span className="text-[12px] ml-1 font-medium">({d.differencePercent.toFixed(1)}%)</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {d.notes && (
          <div className="text-[13px] text-[#86868B] bg-black/[0.03] p-3 rounded-xl mb-4">
            <strong className="text-[#1D1D1F]">Notes:</strong> {d.notes}
          </div>
        )}

        {/* Actions for pending */}
        {isPending && canValidate && !isOwnDeclaration && (
          <div className="border-t border-black/[0.04] pt-4">
            {!showActions ? (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowActions(true)}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-medium bg-[#1D1D1F] text-white rounded-[14px] hover:bg-[#333336] transition-all disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  Valider
                </button>
                <button
                  onClick={() => setShowActions(true)}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-medium bg-white/72 backdrop-blur-xl text-[#FF3B30] border border-white/20 rounded-[14px] hover:bg-white/90 transition-all disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                  Rejeter
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Motif de validation/rejet..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2.5 text-[13px] rounded-[14px] bg-white/72 backdrop-blur-xl border border-white/20 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/15 focus:border-[#007AFF] placeholder:text-[#C7C7CC]"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => onValidate(reason)}
                    disabled={isProcessing}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-medium bg-[#1D1D1F] text-white rounded-[14px] hover:bg-[#333336] transition-all disabled:opacity-50"
                  >
                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Confirmer
                  </button>
                  <button
                    onClick={() => onReject(reason)}
                    disabled={isProcessing || !reason.trim()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-medium bg-white/72 backdrop-blur-xl text-[#FF3B30] border border-white/20 rounded-[14px] hover:bg-white/90 transition-all disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    Rejeter
                  </button>
                  <button
                    onClick={() => {
                      setShowActions(false);
                      setReason('');
                    }}
                    className="px-3.5 py-2 text-[13px] font-medium text-[#86868B] bg-white/72 backdrop-blur-xl border border-white/20 rounded-[14px] hover:bg-white/90 transition-all"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Self-validation warning */}
        {isPending && canValidate && isOwnDeclaration && (
          <div className="border-t border-black/[0.04] pt-4">
            <div className="flex items-center gap-2 bg-black/[0.03] p-3 rounded-xl">
              <Shield className="h-4 w-4 text-[#FF9500] flex-shrink-0" />
              <span className="text-[12px] text-[#86868B]">
                Vous ne pouvez pas valider votre propre déclaration (règle anti-fraude)
              </span>
            </div>
          </div>
        )}

        {/* Validation info */}
        {d.validatedBy && (
          <div className="border-t border-black/[0.04] pt-4 text-[12px] text-[#86868B]">
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-5 bg-black/[0.03] rounded-full flex items-center justify-center">
                <Check className="h-3 w-3 text-[#34C759]" />
              </span>
              Validé par {d.validatedBy.firstName} {d.validatedBy.lastName}
              {d.validatedAt && ` le ${new Date(d.validatedAt).toLocaleString('fr-FR')}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
