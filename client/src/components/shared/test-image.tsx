import React, { useState, useEffect } from 'react';

interface TestImageProps {
  src: string | null | undefined;
  alt?: string;
  className?: string;
}

export function TestImage({ src, alt = "Imagem", className = "" }: TestImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [pngVersion, setPngVersion] = useState<string | null>(null);
  
  useEffect(() => {
    if (!src) return;
    
    // Resetar estados quando a fonte muda
    setIsLoaded(false);
    setError(false);
    setPngVersion(null);
    
    // Se src já está em formato de dados, tentar converter para PNG
    if (src.startsWith('data:')) {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Não foi possível obter contexto 2D do canvas');
          
          // Fundo branco para imagens com transparência
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Desenhar imagem
          ctx.drawImage(img, 0, 0);
          
          // Converter para PNG
          const pngData = canvas.toDataURL('image/png');
          setPngVersion(pngData);
        } catch (err) {
          console.error('Erro na conversão para PNG:', err);
          // Usar original em caso de erro
        }
      };
      
      img.onerror = () => {
        console.error('Erro ao carregar imagem base64 para conversão');
        setError(true);
      };
      
      img.src = src;
    }
  }, [src]);
  
  if (!src) {
    return <div className="p-2 text-red-500">Sem fonte de imagem</div>;
  }
  
  if (error) {
    return <div className="p-2 text-red-500">Erro ao carregar imagem</div>;
  }
  
  const imageUrl = pngVersion || src;
  
  return (
    <div className="flex flex-col items-center">
      {!isLoaded && <div className="p-2">Carregando...</div>}
      
      <img
        src={imageUrl}
        alt={alt}
        className={`max-w-full ${className} ${!isLoaded ? 'opacity-0 h-0' : 'opacity-100'}`}
        onLoad={() => setIsLoaded(true)}
        onError={(e) => {
          console.error('Erro ao carregar imagem:', e);
          setError(true);
        }}
      />
      
      <div className="text-xs mt-2">
        {isLoaded && !error && (
          <>
            <span className="text-green-500">✓ Imagem carregada com sucesso</span>
            <br />
            <span>Formato: {imageUrl.startsWith('data:image/png') ? 'PNG' : 
                          imageUrl.startsWith('data:image/jpeg') ? 'JPEG' : 
                          imageUrl.startsWith('data:') ? 'Base64' : 'URL'}</span>
          </>
        )}
      </div>
    </div>
  );
}