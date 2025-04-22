import { useContext, createContext, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/lib/i18n';

interface LanguageContextType {
  language: string;
  changeLanguage: (lang: string) => void;
  t: (key: string) => string;
  i18n: typeof i18n;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { t: originalT, i18n } = useTranslation();

  // Modificamos a função t para retornar a própria chave de tradução
  // em vez de tentar traduzir o texto
  const t = (key: string) => {
    // Vamos retornar a chave original (sem tradução)
    // conforme solicitado pelo usuário
    return key;
  };

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
