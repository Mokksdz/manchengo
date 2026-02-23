'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, languages, getTranslations, Translations } from './index';

interface LanguageContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  t: Translations;
  dir: 'ltr' | 'rtl';
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>('fr');

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = languages[lang].dir;
  }, [lang]);

  const value: LanguageContextValue = {
    lang,
    setLang,
    t: getTranslations(lang),
    dir: languages[lang].dir,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
