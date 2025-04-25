import React, { useState, useEffect, useRef, memo } from 'react';

interface UltimateImageProps {
  src: string | null | undefined;
  alt?: string;
  className?: string;
}

// Função para converter imagem para base64 PNG usando canvas
const convertImageToPng = (imgSrc: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    // Evitar problemas de CORS configurando crossOrigin
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      try {
        // Criar canvas para conversão
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Desenhar imagem no canvas
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Não foi possível obter contexto 2D do canvas'));
        }
        
        // Fundo branco para imagens com transparência
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Desenhar imagem
        ctx.drawImage(img, 0, 0);
        
        // Converter para PNG base64
        const pngBase64 = canvas.toDataURL('image/png');
        resolve(pngBase64);
      } catch (err) {
        reject(err);
      }
    };
    
    img.onerror = () => {
      reject(new Error(`Erro ao carregar imagem para conversão`));
    };
    
    img.src = imgSrc;
  });
};

// Verifica se a string é um base64 válido e o formato
const isValidBase64 = (str: string): boolean => {
  try {
    if (!str || typeof str !== 'string') return false;
    if (!str.startsWith('data:')) return false;
    if (str.length <= 22) return false; // Mínimo para data:image/xxx;base64,
    if (str.includes('undefined')) return false;
    return true;
  } catch (e) {
    console.error("Erro ao validar base64:", e);
    return false;
  }
};

// Verifica se a URL parece válida
const isValidUrl = (str: string): boolean => {
  try {
    if (!str || typeof str !== 'string') return false;
    if (!str.startsWith('http') && !str.startsWith('/')) return false;
    return true;
  } catch (e) {
    console.error("Erro ao validar URL:", e);
    return false;
  }
};

// Componente otimizado com memo para evitar re-renderizações desnecessárias
export const UltimateImage = memo(({ src, alt = "Imagem", className = "" }: UltimateImageProps) => {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const imageProcessedRef = useRef(false);

  // Efeito para processar a URL ou base64 uma única vez
  useEffect(() => {
    // Resetar estado quando a fonte muda
    setError(false);
    setLoading(true);
    imageProcessedRef.current = false;
    
    if (!src) {
      setError(true);
      setLoading(false);
      return;
    }

    const processImage = async () => {
      try {
        // Log para depuração - vamos ver o que está sendo recebido
        console.log(`UltimateImage recebeu src (${src.length} caracteres):`, src.substring(0, 50) + "...");
        
        // Se já é base64, tente converter para PNG garantido
        if (isValidBase64(src)) {
          console.log("Convertendo base64 para PNG garantido...");
          try {
            // Converter imagem atual para PNG usando canvas
            const pngBase64 = await convertImageToPng(src);
            console.log("Imagem convertida com sucesso para PNG base64");
            setImageSrc(pngBase64);
            imageProcessedRef.current = true;
            setLoading(false);
            return;
          } catch (convErr) {
            console.error("Erro ao converter para PNG, usando original:", convErr);
            setImageSrc(src);
            imageProcessedRef.current = true;
            setLoading(false);
            return;
          }
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
          
          console.log("Carregando imagem da URL:", finalUrl);
          
          try {
            // Tentar carregar e converter a imagem da URL para PNG base64
            const pngBase64 = await convertImageToPng(finalUrl);
            console.log("URL convertida com sucesso para PNG base64");
            setImageSrc(pngBase64);
            imageProcessedRef.current = true;
            setLoading(false);
          } catch (urlErr) {
            console.error("Erro ao converter URL para PNG, usando URL direta:", urlErr);
            setImageSrc(finalUrl);
            imageProcessedRef.current = true;
            setLoading(false);
          }
          return;
        }
        
        // Se chegou aqui, não é base64 válido nem URL válida
        console.warn("Fonte de imagem inválida:", src.substring(0, 50) + "...");
        setError(true);
        setLoading(false);
      } catch (err) {
        console.error("Erro ao processar fonte da imagem:", err);
        setError(true);
        setLoading(false);
      }
    };

    // Processar imagem (assíncrono)
    processImage();
    
    // Cleanup ao desmontar componente
    return () => {
      imageProcessedRef.current = false;
    };
  }, [src]); // Só recalcula quando src mudar
  
  // Mensagem de erro quando não há imagem ou imagem é inválida
  if (error) {
    return (
      <div className="p-2 bg-red-50 text-red-500 text-sm rounded">
        {!src ? "Imagem não disponível" : "Formato de imagem inválido"}
      </div>
    );
  }
  
  // Exibir loader enquanto processa
  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 bg-gray-100 rounded border border-gray-200">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-2 text-sm text-gray-600">Processando imagem...</span>
      </div>
    );
  }
  
  // Renderiza a imagem como PNG base64 com manipulador de erro
  return (
    <div className="image-container relative max-w-full">
      {imageSrc && (
        <img
          src={imageSrc}
          alt={alt}
          className={`max-w-full max-h-60 object-contain ${className}`}
          onError={(e) => {
            console.error("Erro ao renderizar imagem:", e);
            setError(true);
          }}
        />
      )}
    </div>
  );
});