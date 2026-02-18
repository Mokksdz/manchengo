'use client';

import { ReactNode, useCallback, useId, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEscapeKey, useFocusTrap } from '@/hooks/use-accessibility';
import { announce } from '@/lib/accessibility';

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
  /** Description ID for accessibility (screen readers) */
  'aria-describedby'?: string;
  /** Announce opening to screen readers */
  announceOnOpen?: boolean;
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
 * Accessible Modal with focus trap, Escape key, and ARIA attributes.
 * WCAG 2.1 AA Compliant:
 * - Focus trapped within modal
 * - Focus returns to trigger on close
 * - Escape key closes
 * - Proper ARIA labeling
 * - Screen reader announcements
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
  'aria-describedby': ariaDescribedBy,
  announceOnOpen = true,
}: ModalProps) {
  const modalRef = useFocusTrap<HTMLDivElement>(open);
  const titleId = useId();
  const descriptionId = useId();
  const handleClose = useCallback(() => onClose(), [onClose]);

  // Escape key handling
  useEscapeKey(handleClose, open);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      // Announce to screen readers
      if (announceOnOpen) {
        announce(`Dialogue ouvert: ${title}`);
      }

      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [open, title, announceOnOpen]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in overflow-y-auto py-8"
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={ariaDescribedBy || (subtitle ? descriptionId : undefined)}
        className={cn(
          'relative w-full bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 animate-scale-in mx-4',
          sizeClasses[size]
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.04]">
          <div>
            <h2
              id={titleId}
              className="text-[17px] font-semibold text-[#1D1D1F]"
            >
              {title}
            </h2>
            {subtitle && (
              <p
                id={descriptionId}
                className="text-[13px] text-[#86868B] mt-0.5"
              >
                {subtitle}
              </p>
            )}
          </div>
          {!hideClose && (
            <button
              onClick={onClose}
              aria-label="Fermer le dialogue"
              className="p-1.5 rounded-full hover:bg-black/5 transition-colors text-[#AEAEB2] hover:text-[#1D1D1F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#EC7620]"
            >
              <X className="w-5 h-5" aria-hidden="true" />
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
 * Accessible replacement for `window.confirm()`.
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
  const messageId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus cancel button on open (safer default)
  useEffect(() => {
    if (open && cancelRef.current) {
      setTimeout(() => cancelRef.current?.focus(), 0);
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      hideClose
      aria-describedby={messageId}
    >
      <p
        id={messageId}
        className="text-[14px] text-[#86868B] leading-relaxed"
      >
        {message}
      </p>
      <div
        className="flex items-center justify-end gap-3 mt-6"
        role="group"
        aria-label="Actions du dialogue"
      >
        <button
          ref={cancelRef}
          onClick={onClose}
          disabled={loading}
          className="px-5 py-2.5 text-[#86868B] bg-black/5 rounded-full hover:bg-black/10 transition-all font-medium text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#EC7620]"
        >
          {cancelLabel}
        </button>
        <button
          onClick={() => {
            onConfirm();
          }}
          disabled={loading}
          aria-busy={loading}
          className={cn(
            'px-5 py-2.5 text-sm font-semibold rounded-full transition-all active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/50',
            variantStyles[variant]
          )}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span
                className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                aria-hidden="true"
              />
              <span className="sr-only">Chargement, </span>
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
 * Accessible replacement for `window.prompt()`.
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
  const messageId = useId();
  const inputId = useId();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const value = (formData.get('prompt-value') as string) || '';
    if (required && !value.trim()) return;
    onSubmit(value.trim());
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      hideClose
      aria-describedby={message ? messageId : undefined}
    >
      <form onSubmit={handleSubmit} noValidate>
        {message && (
          <p
            id={messageId}
            className="text-[14px] text-[#86868B] leading-relaxed mb-4"
          >
            {message}
          </p>
        )}

        <label htmlFor={inputId} className="sr-only">
          {title}
        </label>

        {multiline ? (
          <textarea
            id={inputId}
            name="prompt-value"
            placeholder={placeholder}
            rows={3}
            autoFocus
            aria-required={required}
            className="w-full px-4 py-2.5 border border-black/[0.06] rounded-[10px] text-[#1D1D1F] bg-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] text-sm resize-none"
          />
        ) : (
          <input
            id={inputId}
            name="prompt-value"
            type="text"
            placeholder={placeholder}
            autoFocus
            aria-required={required}
            className="w-full px-4 py-2.5 border border-black/[0.06] rounded-[10px] text-[#1D1D1F] bg-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] text-sm"
          />
        )}

        <div
          className="flex items-center justify-end gap-3 mt-6"
          role="group"
          aria-label="Actions du dialogue"
        >
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2.5 text-[#86868B] bg-black/5 rounded-full hover:bg-black/10 transition-all font-medium text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#EC7620]"
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className={cn(
              'px-5 py-2.5 text-sm font-semibold rounded-full transition-all active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/50',
              variantStyles[variant]
            )}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span
                  className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                  aria-hidden="true"
                />
                <span className="sr-only">Chargement, </span>
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
