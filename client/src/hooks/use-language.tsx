import { useContext, createContext, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/lib/i18n';

interface LanguageContextType {
  language: string;
  changeLanguage: (lang: string) => void;
  setLanguage: (lang: string) => void; // Alias para changeLanguage para compatibilidade
  t: (key: string, options?: Record<string, any>) => string;
  i18n: typeof i18n;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();

  const changeLanguage = (lang: string) => {
    if (lang !== i18n.language) {
      i18n.changeLanguage(lang);
      localStorage.setItem('language', lang);
    }
  };

  return (
    <LanguageContext.Provider
      value={{
        language: i18n.language,
        changeLanguage,
        setLanguage: changeLanguage, // Alias para changeLanguage
        t,
        i18n
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
