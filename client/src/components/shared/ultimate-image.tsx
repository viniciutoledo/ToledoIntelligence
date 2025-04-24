import React, { useState, useEffect, memo } from 'react';

interface UltimateImageProps {
  src: string | null | undefined;
  alt?: string;
  className?: string;
}

// Verifica se a string é um base64 válido
const isValidBase64 = (str: string): boolean => {
  try {
    return str && 
           typeof str === 'string' && 
           str.startsWith('data:') && 
           str.length > 22 && // data:image/png;base64, tem 22 caracteres
           !str.includes('undefined');
  } catch (e) {
    console.error("Erro ao validar base64:", e);
    return false;
  }
};

// Verifica se a URL parece válida
const isValidUrl = (str: string): boolean => {
  try {
    return str && 
           typeof str === 'string' && 
           (str.startsWith('http') || str.startsWith('/'));
  } catch (e) {
    console.error("Erro ao validar URL:", e);
    return false;
  }
};

// Componente otimizado com memo para evitar re-renderizações desnecessárias
export const UltimateImage = memo(({ src, alt = "Imagem", className = "" }: UltimateImageProps) => {
  const [error, setError] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  // Efeito para processar a URL ou base64 uma única vez
  useEffect(() => {
    if (!src) {
      setError(true);
      return;
    }

    // Log para depuração - vamos ver o que está sendo recebido
    console.log("UltimateImage recebeu src:", src.substring(0, 50) + "...");

    try {
      // Detectar e validar base64
      if (isValidBase64(src)) {
        console.log("Usando imagem como base64");
        setImageSrc(src);
        setError(false);
        return;
      }
      
      // Validar e normalizar URL
      if (isValidUrl(src)) {
        let fullUrl = src;
        
        // Transformar caminho relativo em absoluto
        if (!src.startsWith('http')) {
          fullUrl = `${window.location.origin}${src.startsWith('/') ? '' : '/'}${src}`;
        }
        
        // Adicionar timestamp para evitar cache
        const timestamp = Date.now();
        const finalUrl = `${fullUrl}${fullUrl.includes('?') ? '&' : '?'}_t=${timestamp}`;
        
        console.log("Usando imagem como URL:", finalUrl.substring(0, 50) + "...");
        setImageSrc(finalUrl);
        setError(false);
        return;
      }
      
      // Se chegou aqui, não é base64 válido nem URL válida
      console.warn("Fonte de imagem inválida:", src.substring(0, 50) + "...");
      setError(true);
    } catch (err) {
      console.error("Erro ao processar fonte da imagem:", err);
      setError(true);
    }
  }, [src]); // Só recalcula quando src mudar
  
  // Mensagem de erro quando não há imagem ou imagem é inválida
  if (error || !imageSrc) {
    return (
      <div className="p-2 bg-red-50 text-red-500 text-sm rounded">
        {!src ? "Imagem não disponível" : "Formato de imagem inválido"}
      </div>
    );
  }
  
  // Renderiza a imagem com manipulador de erro simples
  return (
    <img
      src={imageSrc}
      alt={alt}
      className={`max-w-full max-h-60 object-contain ${className}`}
      onError={() => {
        console.error("Erro ao carregar imagem:", imageSrc?.substring(0, 50) + "...");
        setError(true);
      }}
    />
  );
});