import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// SVG de bandeiras inline para melhor performance e controle de estilos
const BrazilFlag = () => (
  <svg width="24" height="16" viewBox="0 0 512 336" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="512" height="336" fill="#6DA544" />
    <path d="M256 33.5L466.8 168L256 302.5L45.2 168L256 33.5Z" fill="#FFDA44" />
    <circle cx="256" cy="168" r="86.5" fill="#0052B4" />
    <path d="M224.2 168C224.2 168 217 208.7 256 223.3C295 208.7 287.8 168 287.8 168C287.8 168 279.6 196.5 256 196.5C232.4 196.5 224.2 168 224.2 168Z" fill="#F0F0F0" />
  </svg>
);

const USFlag = () => (
  <svg width="24" height="16" viewBox="0 0 512 336" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="512" height="336" fill="#F0F0F0" />
    <g>
      <rect width="512" height="25.85" fill="#D80027" />
      <rect y="51.7" width="512" height="25.85" fill="#D80027" />
      <rect y="103.4" width="512" height="25.85" fill="#D80027" />
      <rect y="155.1" width="512" height="25.85" fill="#D80027" />
      <rect y="206.8" width="512" height="25.85" fill="#D80027" />
      <rect y="258.5" width="512" height="25.85" fill="#D80027" />
      <rect y="310.2" width="512" height="25.85" fill="#D80027" />
    </g>
    <rect width="256" height="180.2" fill="#2E52B2" />
    <g>
      {/* Simplificado para manter o SVG mais leve */}
      <circle cx="40" cy="30" r="5" fill="#F0F0F0" />
      <circle cx="80" cy="30" r="5" fill="#F0F0F0" />
      <circle cx="120" cy="30" r="5" fill="#F0F0F0" />
      <circle cx="160" cy="30" r="5" fill="#F0F0F0" />
      <circle cx="200" cy="30" r="5" fill="#F0F0F0" />
      <circle cx="40" cy="60" r="5" fill="#F0F0F0" />
      <circle cx="80" cy="60" r="5" fill="#F0F0F0" />
      <circle cx="120" cy="60" r="5" fill="#F0F0F0" />
      <circle cx="160" cy="60" r="5" fill="#F0F0F0" />
      <circle cx="200" cy="60" r="5" fill="#F0F0F0" />
      <circle cx="40" cy="90" r="5" fill="#F0F0F0" />
      <circle cx="80" cy="90" r="5" fill="#F0F0F0" />
      <circle cx="120" cy="90" r="5" fill="#F0F0F0" />
      <circle cx="160" cy="90" r="5" fill="#F0F0F0" />
      <circle cx="200" cy="90" r="5" fill="#F0F0F0" />
      <circle cx="40" cy="120" r="5" fill="#F0F0F0" />
      <circle cx="80" cy="120" r="5" fill="#F0F0F0" />
      <circle cx="120" cy="120" r="5" fill="#F0F0F0" />
      <circle cx="160" cy="120" r="5" fill="#F0F0F0" />
      <circle cx="200" cy="120" r="5" fill="#F0F0F0" />
      <circle cx="40" cy="150" r="5" fill="#F0F0F0" />
      <circle cx="80" cy="150" r="5" fill="#F0F0F0" />
      <circle cx="120" cy="150" r="5" fill="#F0F0F0" />
      <circle cx="160" cy="150" r="5" fill="#F0F0F0" />
      <circle cx="200" cy="150" r="5" fill="#F0F0F0" />
    </g>
  </svg>
);

export function LanguageToggle({ className }: { className?: string }) {
  const { language, changeLanguage } = useLanguage();
  const { user, changeLanguageMutation } = useAuth();
  const [isAnimating, setIsAnimating] = useState(false);

  const toggleLanguage = (lang: string) => {
    if (lang === language || isAnimating) return;
    
    setIsAnimating(true);
    
    // Altere o idioma da UI imediatamente
    changeLanguage(lang);
    
    // Se o usuário estiver logado, também atualize o idioma no banco de dados
    if (user && (lang === "pt" || lang === "en")) {
      changeLanguageMutation.mutate(lang);
    }
    
    // Desabilite a animação após a conclusão
    setTimeout(() => setIsAnimating(false), 500);
  };

  return (
    <div 
      className={`${className} bg-white shadow rounded-full flex items-center justify-between overflow-hidden p-1`}
      style={{ width: "88px", height: "40px" }}
    >
      <AnimatePresence initial={false}>
        <motion.div 
          className="absolute rounded-full bg-primary z-0" 
          initial={false}
          animate={{ 
            x: language === "pt" ? 0 : 44,
            opacity: 1
          }}
          transition={{ 
            type: "spring", 
            stiffness: 300, 
            damping: 30,
            duration: 0.3
          }}
          style={{ width: "44px", height: "32px" }}
        />
      </AnimatePresence>

      <Button
        variant="ghost"
        onClick={() => toggleLanguage("pt")}
        className="p-1 z-10 rounded-full relative w-11 h-8 flex items-center justify-center"
      >
        <motion.div
          animate={{ 
            scale: language === "pt" ? 1.1 : 0.9,
            y: language === "pt" ? -2 : 0 
          }}
          transition={{ duration: 0.2 }}
        >
          <BrazilFlag />
        </motion.div>
      </Button>

      <Button
        variant="ghost"
        onClick={() => toggleLanguage("en")}
        className="p-1 z-10 rounded-full relative w-11 h-8 flex items-center justify-center"
      >
        <motion.div
          animate={{ 
            scale: language === "en" ? 1.1 : 0.9,
            y: language === "en" ? -2 : 0 
          }}
          transition={{ duration: 0.2 }}
        >
          <USFlag />
        </motion.div>
      </Button>
    </div>
  );
}
