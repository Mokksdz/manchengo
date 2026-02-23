'use client';

import { useLanguage } from '@/lib/i18n/language-context';
import { Globe } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

const LANGUAGES = [
  { code: 'fr' as const, label: 'Français', flag: '🇫🇷' },
  { code: 'ar' as const, label: 'العربية', flag: '🇩🇿' },
];

/**
 * Language Switcher — dropdown in sidebar footer.
 * Persists choice in localStorage and updates LanguageProvider.
 */
export function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load persisted language on mount
  useEffect(() => {
    const saved = localStorage.getItem('manchengo-lang');
    if (saved === 'fr' || saved === 'ar') {
      setLang(saved);
    }
  }, [setLang]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (code: 'fr' | 'ar') => {
    setLang(code);
    localStorage.setItem('manchengo-lang', code);
    setIsOpen(false);
  };

  const currentLang = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Changer la langue"
        className="flex items-center gap-2 w-full px-3 py-2 text-[13px] font-medium text-[#86868B] hover:text-[#1D1D1F] rounded-xl transition-all duration-200 hover:bg-white/40"
      >
        <Globe className="w-3.5 h-3.5" />
        <span>{currentLang.flag} {currentLang.label}</span>
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Langues disponibles"
          className="absolute bottom-full left-0 right-0 mb-1 bg-white/95 backdrop-blur-xl rounded-xl shadow-lg border border-white/20 overflow-hidden z-50"
        >
          {LANGUAGES.map((language) => (
            <button
              key={language.code}
              role="option"
              aria-selected={lang === language.code}
              onClick={() => handleChange(language.code)}
              className={`flex items-center gap-2 w-full px-3 py-2.5 text-[13px] transition-colors ${
                lang === language.code
                  ? 'bg-[#EC7620]/10 text-[#EC7620] font-semibold'
                  : 'text-[#6E6E73] hover:bg-black/[0.04]'
              }`}
            >
              <span>{language.flag}</span>
              <span>{language.label}</span>
              {lang === language.code && (
                <span className="ml-auto text-[#EC7620]">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
