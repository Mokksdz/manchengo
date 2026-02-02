'use client';

import React, { useState } from 'react';
import { AlertTriangle, Shield, Trash2, RefreshCw, XCircle, CheckCircle2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CRITICAL ACTION CONFIRMATION - Prevent accidental destructive actions
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * PURPOSE: Force operators to consciously confirm high-risk actions
 * 
 * ACTIONS REQUIRING CONFIRMATION:
 *   - Stock adjustments (INVENTAIRE)
 *   - Production cancellation
 *   - Manual overrides
 *   - User deactivation
 *   - Bulk operations
 * 
 * DESIGN PRINCIPLES:
 *   1. Explain consequences in plain language
 *   2. Show what will happen (before → after)
 *   3. Require explicit acknowledgment
 *   4. Make cancel the easy option
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

export type CriticalActionType = 
  | 'stock_adjustment'
  | 'production_cancel'
  | 'manual_override'
  | 'user_deactivate'
  | 'bulk_delete'
  | 'data_export';

interface CriticalActionConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionType: CriticalActionType;
  title: string;
  description: string;
  consequences: string[];
  onConfirm: () => void | Promise<void>;
  confirmLabel?: string;
  requireTypedConfirmation?: string; // User must type this to confirm
  requireCheckbox?: boolean;
  isLoading?: boolean;
}

export function CriticalActionConfirm({
  open,
  onOpenChange,
  actionType,
  title,
  description,
  consequences,
  onConfirm,
  confirmLabel = 'Confirmer',
  requireTypedConfirmation,
  requireCheckbox = false,
  isLoading = false,
}: CriticalActionConfirmProps) {
  const [typedValue, setTypedValue] = useState('');
  const [checkboxChecked, setCheckboxChecked] = useState(false);

  const canConfirm = 
    (!requireTypedConfirmation || typedValue === requireTypedConfirmation) &&
    (!requireCheckbox || checkboxChecked);

  const handleConfirm = async () => {
    await onConfirm();
    setTypedValue('');
    setCheckboxChecked(false);
  };

  const handleCancel = () => {
    setTypedValue('');
    setCheckboxChecked(false);
    onOpenChange(false);
  };

  const getIcon = () => {
    switch (actionType) {
      case 'stock_adjustment':
        return <RefreshCw className="h-6 w-6 text-yellow-600" />;
      case 'production_cancel':
        return <XCircle className="h-6 w-6 text-destructive" />;
      case 'manual_override':
        return <Shield className="h-6 w-6 text-orange-600" />;
      case 'user_deactivate':
        return <Trash2 className="h-6 w-6 text-destructive" />;
      case 'bulk_delete':
        return <Trash2 className="h-6 w-6 text-destructive" />;
      default:
        return <AlertTriangle className="h-6 w-6 text-yellow-600" />;
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-full bg-muted p-2">
              {getIcon()}
            </div>
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>{description}</p>
              
              {/* Consequences list */}
              <div className="bg-muted p-3 rounded-md space-y-2">
                <p className="font-medium text-sm text-foreground">Conséquences:</p>
                <ul className="text-sm space-y-1">
                  {consequences.map((consequence, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-destructive">•</span>
                      <span>{consequence}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Typed confirmation */}
              {requireTypedConfirmation && (
                <div className="space-y-2">
                  <Label htmlFor="confirm-input" className="text-sm">
                    Tapez <code className="bg-muted px-1 rounded font-mono">{requireTypedConfirmation}</code> pour confirmer:
                  </Label>
                  <Input
                    id="confirm-input"
                    value={typedValue}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTypedValue(e.target.value)}
                    placeholder={requireTypedConfirmation}
                    className="font-mono"
                    autoComplete="off"
                  />
                </div>
              )}

              {/* Checkbox confirmation */}
              {requireCheckbox && (
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="confirm-checkbox"
                    checked={checkboxChecked}
                    onCheckedChange={(checked: boolean | 'indeterminate') => setCheckboxChecked(checked === true)}
                  />
                  <Label htmlFor="confirm-checkbox" className="text-sm leading-tight">
                    Je comprends les conséquences et je souhaite continuer
                  </Label>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} disabled={isLoading}>
            Annuler
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!canConfirm || isLoading}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                En cours...
              </>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPECIALIZED CONFIRMATION DIALOGS
// ═══════════════════════════════════════════════════════════════════════════════

interface StockAdjustmentConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  currentStock: number;
  newStock: number;
  reason: string;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
}

export function StockAdjustmentConfirm({
  open,
  onOpenChange,
  productName,
  currentStock,
  newStock,
  reason,
  onConfirm,
  isLoading,
}: StockAdjustmentConfirmProps) {
  const difference = newStock - currentStock;
  const isDecrease = difference < 0;

  return (
    <CriticalActionConfirm
      open={open}
      onOpenChange={onOpenChange}
      actionType="stock_adjustment"
      title="Ajustement de stock"
      description={`Vous allez modifier le stock de "${productName}".`}
      consequences={[
        `Stock actuel: ${currentStock} → Nouveau stock: ${newStock}`,
        `Différence: ${difference > 0 ? '+' : ''}${difference}`,
        isDecrease 
          ? 'Cette réduction sera enregistrée dans l\'historique' 
          : 'Cette augmentation sera enregistrée dans l\'historique',
        `Raison: ${reason}`,
        'Cette action sera visible dans le journal d\'audit',
      ]}
      onConfirm={onConfirm}
      confirmLabel="Appliquer l'ajustement"
      requireCheckbox={true}
      isLoading={isLoading}
    />
  );
}

interface ProductionCancelConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string;
  productName: string;
  consumedMp: Array<{ name: string; quantity: number }>;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
}

export function ProductionCancelConfirm({
  open,
  onOpenChange,
  orderNumber,
  productName,
  consumedMp,
  onConfirm,
  isLoading,
}: ProductionCancelConfirmProps) {
  const consequences = [
    `L'ordre ${orderNumber} sera annulé définitivement`,
    `Produit: ${productName}`,
  ];

  if (consumedMp.length > 0) {
    consequences.push('Les matières premières consommées seront restituées au stock:');
    consumedMp.forEach(mp => {
      consequences.push(`  • ${mp.name}: +${mp.quantity}`);
    });
  }

  consequences.push('Cette action sera enregistrée dans le journal d\'audit');

  return (
    <CriticalActionConfirm
      open={open}
      onOpenChange={onOpenChange}
      actionType="production_cancel"
      title="Annuler l'ordre de production"
      description="Cette action est irréversible. L'ordre ne pourra pas être repris."
      consequences={consequences}
      onConfirm={onConfirm}
      confirmLabel="Annuler l'ordre"
      requireTypedConfirmation="ANNULER"
      isLoading={isLoading}
    />
  );
}

interface ManualOverrideConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: string;
  target: string;
  justification: string;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
}

export function ManualOverrideConfirm({
  open,
  onOpenChange,
  action,
  target,
  justification,
  onConfirm,
  isLoading,
}: ManualOverrideConfirmProps) {
  return (
    <CriticalActionConfirm
      open={open}
      onOpenChange={onOpenChange}
      actionType="manual_override"
      title="Override manuel"
      description={`Vous allez effectuer une action manuelle sur "${target}".`}
      consequences={[
        `Action: ${action}`,
        'Les règles métier normales seront contournées',
        `Justification fournie: ${justification}`,
        'Cette action sera marquée comme OVERRIDE dans l\'audit',
        'Un administrateur sera notifié',
      ]}
      onConfirm={onConfirm}
      confirmLabel="Confirmer l'override"
      requireTypedConfirmation="OVERRIDE"
      requireCheckbox={true}
      isLoading={isLoading}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUCCESS CONFIRMATION - Show action completed
// ═══════════════════════════════════════════════════════════════════════════════

interface ActionSuccessProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  details?: string[];
}

export function ActionSuccess({
  open,
  onOpenChange,
  title,
  description,
  details,
}: ActionSuccessProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <div className="flex flex-col items-center text-center">
            <div className="rounded-full bg-green-100 p-3 mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 mt-2">
                <p>{description}</p>
                {details && details.length > 0 && (
                  <ul className="text-sm space-y-1 mt-3">
                    {details.map((detail, i) => (
                      <li key={i} className="text-muted-foreground">{detail}</li>
                    ))}
                  </ul>
                )}
              </div>
            </AlertDialogDescription>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter className="justify-center">
          <AlertDialogAction onClick={() => onOpenChange(false)}>
            Fermer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
