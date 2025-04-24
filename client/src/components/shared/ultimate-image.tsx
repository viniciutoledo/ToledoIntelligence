import { useState, useEffect } from 'react';

interface UltimateImageProps {
  src: string | null | undefined;
  alt?: string;
  className?: string;
}

// Este componente é a solução final e definitiva para o problema de exibição de imagens
// Ele usa React puro com state e não depende de manipulação direta do DOM
export function UltimateImage({ src, alt = "Imagem", className = "" }: UltimateImageProps) {
  const [error, setError] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  
  useEffect(() => {
    if (!src) {
      setError(true);
      return;
    }
    
    // Resetar estado quando src muda
    setError(false);
    
    // Detectar imagens base64
    const isBase64 = src.startsWith('data:');
    
    if (isBase64) {
      // Usar imagem base64 diretamente
      setImageSrc(src);
    } else {
      // Para URLs, transformar em URL absoluta e adicionar timestamp para evitar cache
      let fullUrl = src;
      if (!src.startsWith('http')) {
        fullUrl = `${window.location.origin}${src.startsWith('/') ? '' : '/'}${src}`;
      }
      
      // Adicionar query param de timestamp para evitar cache
      const timestamp = Date.now();
      setImageSrc(`${fullUrl}${fullUrl.includes('?') ? '&' : '?'}_t=${timestamp}`);
    }
  }, [src]);
  
  if (!src || error) {
    return (
      <div className="p-2 bg-red-50 text-red-500 text-sm rounded">
        {!src ? "Imagem não disponível" : "Erro ao carregar imagem"}
      </div>
    );
  }
  
  return (
    <div className="image-container">
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={alt}
          className={`max-w-full max-h-60 object-contain ${className}`}
          onError={() => setError(true)}
          loading="lazy"
        />
      ) : (
        <div className="animate-pulse bg-gray-200 h-32 w-full rounded"></div>
      )}
    </div>
  );
}