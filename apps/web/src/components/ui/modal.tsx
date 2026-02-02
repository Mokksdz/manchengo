'use client';

import { ReactNode, useCallback } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap, useEscapeKey } from '@/lib/hooks/use-focus-trap';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Max width class — defaults to max-w-lg */
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  /** Hide the default close (X) button */
  hideClose?: boolean;
}

const sizeClasses: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
};

/**
 * Shared glass-design Modal with focus trap, Escape key, and ARIA attributes.
 *
 * Usage:
 * ```tsx
 * <Modal open={show} onClose={() => setShow(false)} title="My Modal">
 *   <p>Content here</p>
 * </Modal>
 * ```
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'lg',
  hideClose = false,
}: ModalProps) {
  const modalRef = useFocusTrap<HTMLDivElement>(open);
  const handleClose = useCallback(() => onClose(), [onClose]);
  useEscapeKey(handleClose, open);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in overflow-y-auto py-8">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn(
          'relative w-full bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 animate-scale-in',
          sizeClasses[size]
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.04]">
          <div>
            <h2 id="modal-title" className="text-[17px] font-semibold text-[#1D1D1F]">
              {title}
            </h2>
            {subtitle && (
              <p className="text-[13px] text-[#86868B] mt-0.5">{subtitle}</p>
            )}
          </div>
          {!hideClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-black/5 transition-colors text-[#AEAEB2] hover:text-[#1D1D1F]"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-black/[0.04]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────── */
/*  ConfirmDialog — replacement for window.confirm()       */
/* ─────────────────────────────────────────────────────── */

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  /** Label on the confirm button (default: "Confirmer") */
  confirmLabel?: string;
  /** Label on the cancel button (default: "Annuler") */
  cancelLabel?: string;
  /** Visual variant for the confirm button */
  variant?: 'danger' | 'warning' | 'primary';
  /** Show a loading spinner on confirm button */
  loading?: boolean;
}

const variantStyles: Record<string, string> = {
  danger:
    'bg-[#FF3B30] text-white hover:bg-[#D63029] shadow-lg shadow-[#FF3B30]/25',
  warning:
    'bg-[#FF9500] text-white hover:bg-[#E68600] shadow-lg shadow-[#FF9500]/25',
  primary:
    'bg-[#007AFF] text-white hover:bg-[#0056D6] shadow-lg shadow-[#007AFF]/25',
};

/**
 * Drop-in replacement for `window.confirm()`.
 *
 * Usage:
 * ```tsx
 * <ConfirmDialog
 *   open={showConfirm}
 *   onClose={() => setShowConfirm(false)}
 *   onConfirm={handleDelete}
 *   title="Supprimer ce fournisseur ?"
 *   message="Cette action est irréversible."
 *   variant="danger"
 * />
 * ```
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'primary',
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm" hideClose>
      <p className="text-[14px] text-[#86868B] leading-relaxed">{message}</p>
      <div className="flex items-center justify-end gap-3 mt-6">
        <button
          onClick={onClose}
          disabled={loading}
          className="px-5 py-2.5 text-[#86868B] bg-black/5 rounded-full hover:bg-black/10 transition-all font-medium text-sm"
        >
          {cancelLabel}
        </button>
        <button
          onClick={() => {
            onConfirm();
          }}
          disabled={loading}
          className={cn(
            'px-5 py-2.5 text-sm font-semibold rounded-full transition-all active:scale-[0.97] disabled:opacity-50',
            variantStyles[variant]
          )}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {confirmLabel}
            </span>
          ) : (
            confirmLabel
          )}
        </button>
      </div>
    </Modal>
  );
}

/* ─────────────────────────────────────────────────────── */
/*  PromptDialog — replacement for window.prompt()         */
/* ─────────────────────────────────────────────────────── */

interface PromptDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  message?: string;
  placeholder?: string;
  /** Use textarea (multi-line) instead of input */
  multiline?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  loading?: boolean;
  /** Require a non-empty value to submit */
  required?: boolean;
}

/**
 * Drop-in replacement for `window.prompt()`.
 */
export function PromptDialog({
  open,
  onClose,
  onSubmit,
  title,
  message,
  placeholder = '',
  multiline = false,
  submitLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'primary',
  loading = false,
  required = true,
}: PromptDialogProps) {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const value = (formData.get('prompt-value') as string) || '';
    if (required && !value.trim()) return;
    onSubmit(value.trim());
  };

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm" hideClose>
      <form onSubmit={handleSubmit}>
        {message && (
          <p className="text-[14px] text-[#86868B] leading-relaxed mb-4">{message}</p>
        )}
        {multiline ? (
          <textarea
            name="prompt-value"
            placeholder={placeholder}
            rows={3}
            autoFocus
            className="w-full px-4 py-2.5 border border-black/[0.06] rounded-[10px] text-[#1D1D1F] bg-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] text-sm resize-none"
          />
        ) : (
          <input
            name="prompt-value"
            type="text"
            placeholder={placeholder}
            autoFocus
            className="w-full px-4 py-2.5 border border-black/[0.06] rounded-[10px] text-[#1D1D1F] bg-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] text-sm"
          />
        )}
        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2.5 text-[#86868B] bg-black/5 rounded-full hover:bg-black/10 transition-all font-medium text-sm"
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            disabled={loading}
            className={cn(
              'px-5 py-2.5 text-sm font-semibold rounded-full transition-all active:scale-[0.97] disabled:opacity-50',
              variantStyles[variant]
            )}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {submitLabel}
              </span>
            ) : (
              submitLabel
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
