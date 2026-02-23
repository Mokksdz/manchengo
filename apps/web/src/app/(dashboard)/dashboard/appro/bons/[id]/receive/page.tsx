'use client';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * RÉCEPTION BC — Formulaire de réception des MP commandées
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * ACTIONS:
 * - Saisie des quantités reçues par ligne
 * - Numéros de lot et dates d'expiration
 * - Création automatique de: ReceptionMp, StockMovements, Lots
 */

import { toast } from 'sonner';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { appro, PurchaseOrder } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Skeleton, SkeletonTable } from '@/components/ui/skeleton-loader';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import {
  Truck,
  ArrowLeft,
  CheckCircle,
  Loader2,
  AlertTriangle,
  FileText,
  Package,
} from 'lucide-react';
import { createLogger } from '@/lib/logger';

const log = createLogger('BonReception');

interface ReceptionLine {
  itemId: string;
  productMpId: number;
  productName: string;
  productCode: string;
  unit: string;
  quantityOrdered: number;
  quantityAlreadyReceived: number;
  quantityToReceive: number;
  lotNumber: string;
  expiryDate: string;
  note: string;
}

export default function ReceiveBcPage() {
  const params = useParams();
  const router = useRouter();
  const [bc, setBc] = useState<PurchaseOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lines, setLines] = useState<ReceptionLine[]>([]);
  const [blNumber, setBlNumber] = useState('');
  const [receptionDate, setReceptionDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  const loadData = useCallback(async () => {
    try {
      const data = await appro.getPurchaseOrder(params.id as string);
      setBc(data);

      // Initialiser les lignes de réception
      setLines(
        data.items.map((item) => ({
          itemId: item.id,
          productMpId: item.productMpId,
          productName: item.productMp.name,
          productCode: item.productMp.code,
          unit: item.productMp.unit,
          quantityOrdered: item.quantity,
          quantityAlreadyReceived: item.quantityReceived,
          quantityToReceive: Math.max(0, item.quantity - item.quantityReceived),
          lotNumber: '',
          expiryDate: '',
          note: '',
        }))
      );
    } catch (err) {
      log.error('Failed to load BC:', err);
      setError('Impossible de charger le bon de commande');
    } finally {
      setIsLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateLine = (itemId: string, field: keyof ReceptionLine, value: string | number) => {
    setLines((prev) =>
      prev.map((line) =>
        line.itemId === itemId ? { ...line, [field]: value } : line
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bc) return;

    // Validation
    const linesToSubmit = lines.filter((l) => l.quantityToReceive > 0);
    if (linesToSubmit.length === 0) {
      setError('Veuillez saisir au moins une quantité à réceptionner');
      return;
    }

    // Validation DLC et N° Lot obligatoires (traçabilité alimentaire)
    const missingFields = linesToSubmit.filter((l) => !l.lotNumber || !l.expiryDate);
    if (missingFields.length > 0) {
      setError('Le N° de lot et la date d\'expiration (DLC) sont obligatoires pour chaque ligne réceptionnée');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await appro.receivePurchaseOrder(bc.id, {
        lines: linesToSubmit.map((l) => ({
          itemId: l.itemId,
          quantityReceived: l.quantityToReceive,
          lotNumber: l.lotNumber || undefined,
          expiryDate: l.expiryDate || undefined,
          note: l.note || undefined,
        })),
        blNumber: blNumber || undefined,
        receptionDate: receptionDate || undefined,
        notes: notes || undefined,
      });

      toast.success(`${result.message} — Réception: ${result.receptionMpReference}, ${result.stockMovementsCreated} mouvement(s) de stock créé(s)`);
      router.push(`/dashboard/appro/bons/${bc.id}`);
    } catch (err: unknown) {
      log.error('Failed to receive BC:', err);
      setError((err as Error).message || 'Erreur lors de la réception');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Loading state with skeleton loaders ──
  if (isLoading) {
    return (
      <div className="space-y-6 animate-slide-up">
        {/* Header skeleton */}
        <div className="glass-card rounded-[28px] p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div>
              <Skeleton className="h-6 w-56 mb-2" />
              <Skeleton className="h-4 w-36" />
            </div>
          </div>
        </div>
        {/* Form skeleton */}
        <div className="glass-card rounded-[28px] p-6">
          <Skeleton className="h-5 w-48 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        {/* Table skeleton */}
        <SkeletonTable rows={4} columns={6} />
      </div>
    );
  }

  // ── Error: BC not found ──
  if (!bc) {
    return (
      <div className="animate-slide-up">
        <div className="glass-card rounded-[28px] p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-[#FF3B30]/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-[#FF3B30]" />
          </div>
          <p className="text-[#1D1D1F] font-semibold text-lg mb-1">{error || 'Bon de commande non trouvé'}</p>
          <p className="text-[#86868B] text-sm mb-6">Vérifiez la référence et réessayez.</p>
          <Link
            href="/dashboard/appro/bons"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FF3B30] text-white text-sm font-semibold rounded-full hover:bg-[#E0352B] shadow-lg shadow-[#FF3B30]/25 transition-all active:scale-[0.97]"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Link>
        </div>
      </div>
    );
  }

  const canReceive = bc.status === 'SENT' || bc.status === 'CONFIRMED' || bc.status === 'PARTIAL';

  // ── Error: cannot receive ──
  if (!canReceive) {
    return (
      <div className="animate-slide-up">
        <div className="glass-card rounded-[28px] p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-[#FF9500]/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-[#FF9500]" />
          </div>
          <p className="text-[#1D1D1F] font-semibold text-lg mb-1">
            Ce BC ne peut pas être réceptionné
          </p>
          <p className="text-[#86868B] text-sm mb-6">
            Statut actuel: <span className="glass-pill bg-[#FF9500]/10 text-[#FF9500] px-2.5 py-0.5 text-xs font-semibold rounded-full">{bc.status}</span>
          </p>
          <Link
            href={`/dashboard/appro/bons/${bc.id}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#FF9500] text-white text-sm font-semibold rounded-full hover:bg-[#E08800] shadow-lg shadow-[#FF9500]/25 transition-all active:scale-[0.97]"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au BC
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <PageHeader
        title={`Réception BC ${bc.reference}`}
        subtitle={`Fournisseur: ${bc.supplier.name}`}
        icon={<Truck className="w-5 h-5" />}
        actions={(
          <Button asChild variant="outline">
            <Link href={`/dashboard/appro/bons/${bc.id}`}>
              <ArrowLeft className="w-4 h-4" />
              Retour au BC
            </Link>
          </Button>
        )}
      />

      {/* ── Error alert ── */}
      {error && (
        <div className="glass-card rounded-[28px] p-4 flex items-center gap-3 border border-[#FF3B30]/20 bg-[#FF3B30]/5">
          <div className="w-8 h-8 rounded-full bg-[#FF3B30]/10 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-[#FF3B30]" />
          </div>
          <p className="text-[#FF3B30] text-sm font-medium">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Infos générales ── */}
        <div className="glass-card rounded-[28px] p-6">
          <h2 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#007AFF]" />
            Informations de réception
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#1D1D1F] mb-1.5">
                N° Bon de livraison fournisseur
              </label>
              <input
                type="text"
                value={blNumber}
                onChange={(e) => setBlNumber(e.target.value)}
                placeholder="BL-2025-001234"
                className="w-full px-4 py-2.5 border border-black/[0.06] rounded-[10px] text-[#1D1D1F] bg-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] transition-all placeholder:text-[#AEAEB2]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1D1D1F] mb-1.5">
                Date de réception
              </label>
              <input
                type="date"
                value={receptionDate}
                onChange={(e) => setReceptionDate(e.target.value)}
                className="w-full px-4 py-2.5 border border-black/[0.06] rounded-[10px] text-[#1D1D1F] bg-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#1D1D1F] mb-1.5">
                Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes générales..."
                className="w-full px-4 py-2.5 border border-black/[0.06] rounded-[10px] text-[#1D1D1F] bg-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] transition-all placeholder:text-[#AEAEB2]"
              />
            </div>
          </div>
        </div>

        {/* ── Lignes ── */}
        <div className="glass-card rounded-[28px] overflow-hidden">
          <div className="p-5 border-b border-black/[0.06]">
            <h2 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight flex items-center gap-2">
              <Package className="w-5 h-5 text-[#007AFF]" />
              Articles à réceptionner
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="glass-bg">
                  <th className="text-left p-4 text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Produit</th>
                  <th className="text-right p-4 text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Commandé</th>
                  <th className="text-right p-4 text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Déjà reçu</th>
                  <th className="text-center p-4 text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Qté à recevoir</th>
                  <th className="text-center p-4 text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">N° Lot <span className="text-[#FF3B30]">*</span></th>
                  <th className="text-center p-4 text-[11px] font-semibold text-[#86868B] uppercase tracking-wider">Date exp. <span className="text-[#FF3B30]">*</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {lines.map((line) => {
                  const remaining = line.quantityOrdered - line.quantityAlreadyReceived;
                  const isComplete = line.quantityAlreadyReceived >= line.quantityOrdered;

                  return (
                    <tr
                      key={line.itemId}
                      className={cn(
                        'transition-colors hover:bg-black/[0.02]',
                        isComplete && 'bg-[#34C759]/5 opacity-60'
                      )}
                    >
                      <td className="p-4">
                        <p className="font-medium text-[#1D1D1F]">{line.productName}</p>
                        <p className="text-xs text-[#86868B]">{line.productCode}</p>
                      </td>
                      <td className="p-4 text-right">
                        <span className="font-medium text-[#1D1D1F]">{line.quantityOrdered}</span>
                        <span className="text-[#86868B] text-sm ml-1">{line.unit}</span>
                      </td>
                      <td className="p-4 text-right">
                        <span className={cn(
                          'font-medium',
                          isComplete ? 'text-[#34C759]' : 'text-[#86868B]'
                        )}>
                          {line.quantityAlreadyReceived}
                        </span>
                      </td>
                      <td className="p-4">
                        <input
                          type="number"
                          min="0"
                          max={remaining}
                          step="0.01"
                          value={line.quantityToReceive}
                          onChange={(e) =>
                            updateLine(line.itemId, 'quantityToReceive', parseFloat(e.target.value) || 0)
                          }
                          disabled={isComplete}
                          className="w-24 px-3 py-2 border border-black/[0.06] rounded-[10px] text-center text-[#1D1D1F] bg-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] disabled:bg-[#F5F5F7] disabled:text-[#AEAEB2] transition-all"
                        />
                      </td>
                      <td className="p-4">
                        <input
                          type="text"
                          value={line.lotNumber}
                          onChange={(e) => updateLine(line.itemId, 'lotNumber', e.target.value)}
                          placeholder="LOT-XXX"
                          required={line.quantityToReceive > 0}
                          disabled={isComplete || line.quantityToReceive === 0}
                          className={cn(
                            "w-28 px-3 py-2 border rounded-[10px] text-center text-[#1D1D1F] bg-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] disabled:bg-[#F5F5F7] disabled:text-[#AEAEB2] transition-all placeholder:text-[#AEAEB2]",
                            line.quantityToReceive > 0 && !line.lotNumber ? 'border-[#FF3B30]/50' : 'border-black/[0.06]'
                          )}
                        />
                      </td>
                      <td className="p-4">
                        <input
                          type="date"
                          value={line.expiryDate}
                          onChange={(e) => updateLine(line.itemId, 'expiryDate', e.target.value)}
                          required={line.quantityToReceive > 0}
                          disabled={isComplete || line.quantityToReceive === 0}
                          className={cn(
                            "w-36 px-3 py-2 border rounded-[10px] text-[#1D1D1F] bg-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] disabled:bg-[#F5F5F7] disabled:text-[#AEAEB2] transition-all",
                            line.quantityToReceive > 0 && !line.expiryDate ? 'border-[#FF3B30]/50' : 'border-black/[0.06]'
                          )}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href={`/dashboard/appro/bons/${bc.id}`}
            className="px-5 py-2.5 text-[#86868B] bg-black/5 rounded-full hover:bg-black/10 transition-all font-medium"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#34C759] text-white text-sm font-semibold rounded-full hover:bg-[#2DB44D] shadow-lg shadow-[#34C759]/25 transition-all active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <CheckCircle className="w-5 h-5" />
            )}
            Valider la réception
          </button>
        </div>
      </form>
    </div>
  );
}
