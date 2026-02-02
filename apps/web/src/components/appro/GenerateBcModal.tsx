'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { appro, GenerateBcResponse } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  X,
  FileText,
  Loader2,
  Package,
  Truck,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';

interface ProductMp {
  id: number;
  code: string;
  name: string;
  unit: string;
  fournisseurPrincipal?: {
    id: number;
    code: string;
    name: string;
  };
  dernierPrixAchat?: number;
}

interface DemandeLigne {
  id?: number;
  productMpId: number;
  productMp?: ProductMp;
  quantiteDemandee: number;
  quantiteValidee?: number;
}

interface Demande {
  id: number;
  reference: string;
  status: string;
  lignes: DemandeLigne[];
}

interface GenerateBcModalProps {
  demande: Demande;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result: GenerateBcResponse) => void;
}

interface SupplierGroup {
  supplierId: number | null;
  supplierName: string;
  supplierCode: string;
  lignes: DemandeLigne[];
  totalHT: number;
}

export function GenerateBcModal({ demande, isOpen, onClose, onSuccess }: GenerateBcModalProps) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [supplierGroups, setSupplierGroups] = useState<SupplierGroup[]>([]);

  useEffect(() => {
    if (isOpen && demande) {
      const groups = new Map<number | null, SupplierGroup>();
      
      for (const ligne of demande.lignes) {
        const supplierId = ligne.productMp?.fournisseurPrincipal?.id ?? null;
        const supplierName = ligne.productMp?.fournisseurPrincipal?.name ?? 'Fournisseur non défini';
        const supplierCode = ligne.productMp?.fournisseurPrincipal?.code ?? '-';
        
        if (!groups.has(supplierId)) {
          groups.set(supplierId, {
            supplierId,
            supplierName,
            supplierCode,
            lignes: [],
            totalHT: 0,
          });
        }
        
        const group = groups.get(supplierId)!;
        group.lignes.push(ligne);
        
        const qty = ligne.quantiteValidee ?? ligne.quantiteDemandee;
        const price = ligne.productMp?.dernierPrixAchat ?? 0;
        group.totalHT += qty * price;
      }
      
      setSupplierGroups(Array.from(groups.values()));
    }
  }, [isOpen, demande]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    
    try {
      const result = await appro.generateBc(demande.id, {});
      
      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-semibold">Bon de commande généré avec succès</span>
          <span className="text-sm opacity-90">
            {result.count === 1 
              ? `${result.purchaseOrders[0].reference} créé`
              : `${result.count} BC créés`
            }
          </span>
        </div>,
        {
          duration: 5000,
          icon: <CheckCircle className="w-5 h-5 text-green-500" />,
        }
      );
      
      onClose();
      
      if (onSuccess) {
        onSuccess(result);
      }
      
      if (result.count === 1) {
        router.push(`/dashboard/appro/bons/${result.purchaseOrders[0].id}`);
      } else {
        router.push('/dashboard/appro/bons');
      }
      
    } catch (error: unknown) {
      toast.error(
        <div className="flex flex-col gap-1">
          <span className="font-semibold">Échec de la génération</span>
          <span className="text-sm opacity-90">{(error as Error).message || 'Une erreur est survenue'}</span>
        </div>,
        {
          duration: 6000,
          icon: <AlertTriangle className="w-5 h-5 text-red-500" />,
        }
      );
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  const totalGlobalHT = supplierGroups.reduce((sum, g) => sum + g.totalHT, 0);
  const hasMultipleSuppliers = supplierGroups.length > 1;
  const hasUndefinedSupplier = supplierGroups.some(g => g.supplierId === null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-[16px] shadow-apple-elevated max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#E5E5E5] bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <FileText className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#1D1D1F]">
                🧾 Générer un bon de commande fournisseur
              </h2>
              <p className="text-sm text-[#86868B]">
                Demande {demande.reference}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="p-2 hover:bg-[#F5F5F5] rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-[#86868B]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Avertissement multi-fournisseurs */}
          {hasMultipleSuppliers && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">
                  Cette demande concerne {supplierGroups.length} fournisseurs
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  {supplierGroups.length} bons de commande seront automatiquement générés, un par fournisseur.
                </p>
              </div>
            </div>
          )}

          {/* Avertissement fournisseur non défini */}
          {hasUndefinedSupplier && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">
                  Certains produits n'ont pas de fournisseur défini
                </p>
                <p className="text-sm text-red-700 mt-1">
                  Veuillez d'abord assigner un fournisseur principal à ces produits.
                </p>
              </div>
            </div>
          )}

          {/* Groupes par fournisseur */}
          {supplierGroups.map((group, idx) => (
            <div 
              key={group.supplierId ?? 'undefined'}
              className={cn(
                'border rounded-xl overflow-hidden',
                group.supplierId === null ? 'border-red-200 bg-red-50/50' : 'border-[#F0F0F0]'
              )}
            >
              {/* Fournisseur header */}
              <div className={cn(
                'flex items-center gap-3 p-4',
                group.supplierId === null ? 'bg-red-100' : 'bg-[#FAFAFA]'
              )}>
                <Truck className={cn(
                  'w-5 h-5',
                  group.supplierId === null ? 'text-red-600' : 'text-[#6E6E73]'
                )} />
                <div className="flex-1">
                  <p className="font-semibold text-[#1D1D1F]">
                    {group.supplierName}
                  </p>
                  <p className="text-xs text-[#86868B]">
                    Code: {group.supplierCode}
                  </p>
                </div>
                {hasMultipleSuppliers && (
                  <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded-full font-medium">
                    BC #{idx + 1}
                  </span>
                )}
              </div>

              {/* Lignes produits */}
              <div className="divide-y">
                {group.lignes.map((ligne, lidx) => {
                  const qty = ligne.quantiteValidee ?? ligne.quantiteDemandee;
                  const price = ligne.productMp?.dernierPrixAchat ?? 0;
                  const totalLine = qty * price;
                  
                  return (
                    <div key={lidx} className="flex items-center justify-between p-4 hover:bg-[#FAFAFA]">
                      <div className="flex items-center gap-3">
                        <Package className="w-4 h-4 text-[#AEAEB2]" />
                        <div>
                          <p className="font-medium text-[#1D1D1F]">
                            {ligne.productMp?.name || `Produit #${ligne.productMpId}`}
                          </p>
                          <p className="text-xs text-[#86868B]">
                            {ligne.productMp?.code}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-[#1D1D1F]">
                          {qty} {ligne.productMp?.unit || 'unités'}
                        </p>
                        <p className="text-sm text-[#86868B]">
                          {price > 0 
                            ? `${price.toFixed(2)} DA/u → ${totalLine.toFixed(2)} DA`
                            : 'Prix non défini'
                          }
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total fournisseur */}
              <div className="flex items-center justify-between p-4 bg-[#FAFAFA] border-t font-semibold">
                <span className="text-[#6E6E73]">Total HT</span>
                <span className="text-lg text-[#1D1D1F]">
                  {group.totalHT.toFixed(2)} DA
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t p-6 bg-[#FAFAFA]">
          {/* Récapitulatif */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b">
            <div>
              <p className="text-sm text-[#86868B]">
                {hasMultipleSuppliers 
                  ? `${supplierGroups.length} BC seront générés`
                  : '1 BC sera généré'
                }
              </p>
              <p className="text-sm text-[#86868B]">
                {demande.lignes.length} ligne(s) de produit
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-[#86868B]">Total global HT</p>
              <p className="text-2xl font-bold text-[#1D1D1F]">
                {totalGlobalHT.toFixed(2)} DA
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isGenerating}
              className="px-4 py-2.5 text-[#1D1D1F] hover:bg-[#E5E5E5] rounded-lg transition-colors font-medium"
            >
              Annuler
            </button>
            <button
              onClick={handleGenerate}
              disabled={isGenerating || hasUndefinedSupplier}
              className={cn(
                'flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold transition-all',
                hasUndefinedSupplier
                  ? 'bg-[#D1D1D6] text-[#86868B] cursor-not-allowed'
                  : 'bg-[#1D1D1F] text-white hover:bg-[#333336]'
              )}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Génération en cours...
                </>
              ) : (
                <>
                  <FileText className="w-5 h-5" />
                  Générer le Bon de Commande
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
