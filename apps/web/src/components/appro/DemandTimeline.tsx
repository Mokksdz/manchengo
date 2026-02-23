'use client';

import { cn } from '@/lib/utils';
import {
  CheckCircle,
  FileText,
  Send,
  Package,
  Clock,
} from 'lucide-react';

type DemandeStatus = 
  | 'BROUILLON' | 'SOUMISE' | 'VALIDEE' | 'REJETEE' 
  | 'EN_COURS_COMMANDE' | 'COMMANDEE' | 'RECEPTIONNEE'
  | 'ENVOYEE' | 'TRANSFORMEE'; // Legacy

interface PurchaseOrder {
  id: string;
  reference: string;
  status: string;
  sentAt?: string | null;
  receivedAt?: string | null;
}

interface DemandTimelineProps {
  status: DemandeStatus;
  purchaseOrders?: PurchaseOrder[];
  className?: string;
}

interface TimelineStep {
  key: string;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  completed: boolean;
  current: boolean;
  date?: string;
}

export function DemandTimeline({ status, purchaseOrders = [], className }: DemandTimelineProps) {
  const hasBc = purchaseOrders.length > 0;
  const bcSent = purchaseOrders.some(po => po.sentAt);
  const bcReceived = purchaseOrders.some(po => po.status === 'RECEIVED');
  const allBcReceived = purchaseOrders.length > 0 && purchaseOrders.every(po => po.status === 'RECEIVED');

  // Normalize legacy statuses
  const normalizedStatus = status === 'ENVOYEE' ? 'SOUMISE' : 
                           status === 'TRANSFORMEE' ? 'EN_COURS_COMMANDE' : status;
  
  const isValidated = ['VALIDEE', 'EN_COURS_COMMANDE', 'COMMANDEE', 'RECEPTIONNEE'].includes(normalizedStatus) || hasBc;
  const isBcGenerated = ['EN_COURS_COMMANDE', 'COMMANDEE', 'RECEPTIONNEE'].includes(normalizedStatus) || hasBc;
  const isSentToSupplier = ['COMMANDEE', 'RECEPTIONNEE'].includes(normalizedStatus) || bcSent;
  const isReceived = normalizedStatus === 'RECEPTIONNEE' || allBcReceived;

  const steps: TimelineStep[] = [
    {
      key: 'validated',
      label: 'Demande validée',
      icon: CheckCircle,
      completed: isValidated,
      current: normalizedStatus === 'VALIDEE' && !hasBc,
    },
    {
      key: 'bc_generated',
      label: 'BC généré par l\'APPRO',
      icon: FileText,
      completed: isBcGenerated,
      current: isBcGenerated && !isSentToSupplier,
    },
    {
      key: 'bc_sent',
      label: 'Envoyé au fournisseur',
      icon: Send,
      completed: isSentToSupplier,
      current: isSentToSupplier && !isReceived,
    },
    {
      key: 'bc_received',
      label: 'Réception fournisseur',
      icon: Package,
      completed: isReceived,
      current: bcReceived && !allBcReceived,
    },
  ];

  return (
    <div className={cn('glass-card rounded-xl p-4', className)}>
      <h3 className="font-display text-[17px] font-bold text-[#1D1D1F] tracking-tight mb-4 flex items-center gap-2">
        <Clock className="w-4 h-4" />
        Progression du flux
      </h3>
      
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isLast = index === steps.length - 1;
          
          return (
            <div key={step.key} className="flex items-center flex-1">
              {/* Step */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center transition-all',
                    step.completed
                      ? 'bg-green-100 text-green-600'
                      : step.current
                      ? 'bg-primary-100 text-primary-600 ring-2 ring-primary-300 ring-offset-2'
                      : 'bg-[#F5F5F5] text-[#AEAEB2]'
                  )}
                >
                  {step.completed ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <p
                  className={cn(
                    'text-xs mt-2 text-center max-w-[80px]',
                    step.completed
                      ? 'text-green-700 font-medium'
                      : step.current
                      ? 'text-primary-700 font-medium'
                      : 'text-[#86868B]'
                  )}
                >
                  {step.label}
                </p>
              </div>
              
              {/* Connector line */}
              {!isLast && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-2',
                    step.completed ? 'bg-green-300' : 'bg-[#E5E5E5]'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
