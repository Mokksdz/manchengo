/**
 * KeyboardHint — Small glass-pill badge showing a keyboard shortcut.
 *
 * Apple Glass style: translucent background, muted text, subtle border.
 * Only visible on desktop (hidden below lg breakpoint).
 *
 * Usage: <KeyboardHint shortcut="N" />
 */

interface KeyboardHintProps {
  shortcut: string;
}

export function KeyboardHint({ shortcut }: KeyboardHintProps) {
  return (
    <kbd className="hidden lg:inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-md bg-black/[0.04] border border-black/[0.06] text-[11px] font-medium text-[#86868B] leading-none select-none pointer-events-none">
      {shortcut}
    </kbd>
  );
}
