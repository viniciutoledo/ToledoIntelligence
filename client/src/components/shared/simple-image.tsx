import { useState } from 'react';

interface SimpleImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
}

export function SimpleImage({ 
  src, 
  alt, 
  className = "max-w-full rounded-md max-h-60 object-contain"
}: SimpleImageProps) {
  const [error, setError] = useState(false);
  
  if (!src) {
    return (
      <div className="p-2 bg-gray-100 rounded text-center text-gray-500 text-sm">
        Imagem não disponível
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-2 bg-gray-100 rounded text-center text-gray-500 text-sm">
        Erro ao carregar imagem
      </div>
    );
  }
  
  // Normaliza a URL para garantir que comece com /
  const normalizedSrc = src.startsWith('http') || src.startsWith('/') 
    ? src 
    : `/${src}`;
  
  return (
    <img
      src={normalizedSrc}
      alt={alt}
      className={className}
      onError={() => setError(true)}
    />
  );
}