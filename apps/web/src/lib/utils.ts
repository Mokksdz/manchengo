import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format currency (centimes to DA)
export function formatCurrency(centimes: number): string {
  return new Intl.NumberFormat('fr-DZ', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(centimes / 100) + ' DA';
}

// Format date
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('fr-DZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date));
}

// Format relative time
export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'À l\'instant';
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  return formatDate(date);
}

// Status badge color
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    PAID: 'bg-[#34C759]/10 text-[#248A3D]',
    DRAFT: 'bg-[#F5F5F7] text-[#86868B]',
    VALIDATED: 'bg-[#007AFF]/10 text-[#007AFF]',
    PARTIALLY_PAID: 'bg-[#FF9500]/10 text-[#C93400]',
    CANCELLED: 'bg-[#FF3B30]/10 text-[#D70015]',
    PENDING: 'bg-[#FF9500]/10 text-[#C93400]',
    IN_PROGRESS: 'bg-[#007AFF]/10 text-[#007AFF]',
    COMPLETED: 'bg-[#34C759]/10 text-[#248A3D]',
    DELIVERED: 'bg-[#34C759]/10 text-[#248A3D]',
  };
  return colors[status] || 'bg-[#F5F5F7] text-[#86868B]';
}

// Status label (French)
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    DRAFT: 'Brouillon',
    VALIDATED: 'Validée',
    PARTIALLY_PAID: 'Part. payée',
    PAID: 'Payée',
    CANCELLED: 'Annulée',
    PENDING: 'En attente',
    IN_PROGRESS: 'En cours',
    COMPLETED: 'Terminée',
    DELIVERED: 'Livrée',
  };
  return labels[status] || status;
}

