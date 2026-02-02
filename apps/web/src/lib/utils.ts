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
    PAID: 'bg-[#34C759]/10 text-[#34C759]',
    DRAFT: 'bg-[#F5F5F7] text-[#86868B]',
    CANCELLED: 'bg-[#FF3B30]/10 text-[#FF3B30]',
    PENDING: 'bg-[#FF9500]/10 text-[#FF9500]',
    IN_PROGRESS: 'bg-[#007AFF]/10 text-[#007AFF]',
    COMPLETED: 'bg-[#34C759]/10 text-[#34C759]',
  };
  return colors[status] || 'bg-[#F5F5F7] text-[#86868B]';
}

// Role label
export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    ADMIN: 'Administrateur',
    APPRO: 'Approvisionnement',
    PRODUCTION: 'Production',
    COMMERCIAL: 'Commercial',
  };
  return labels[role] || role;
}
