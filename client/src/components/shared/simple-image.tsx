import React, { useState } from 'react';

interface SimpleImageProps {
  src: string | null | undefined;
  alt?: string;
  className?: string;
}

export function SimpleImage({ src, alt = "Imagem", className = "" }: SimpleImageProps) {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  
  if (!src) {
    return (
      <div className="p-2 bg-gray-100 text-gray-500 text-sm rounded">
        Imagem não disponível
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-2 bg-red-50 text-red-500 text-sm rounded">
        Erro ao carregar imagem
      </div>
    );
  }
  
  return (
    <div className="image-container">
      {!loaded && <div className="text-xs text-gray-500 mb-1">Carregando imagem...</div>}
      <img
        src={src}
        alt={alt}
        className={`max-w-full rounded-md ${className}`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
}