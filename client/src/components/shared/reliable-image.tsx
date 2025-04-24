import { useState, useEffect } from 'react';

interface ReliableImageProps {
  src: string | null | undefined;
  base64Data?: string | null;
  alt: string;
  className?: string;
  messageId?: number | string;
}

export function ReliableImage({ 
  src, 
  base64Data, 
  alt, 
  className = "max-w-full rounded-md max-h-60 object-contain",
  messageId
}: ReliableImageProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [error, setError] = useState<boolean>(false);
  
  // Função que tenta obter a URL mais confiável
  const getOptimizedImageUrl = (url: string): string => {
    // Verifica se é uma URL absoluta
    if (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')) {
      return url;
    }
    
    // Se a URL começa com /, adiciona a origem
    if (url.startsWith('/')) {
      return `${window.location.origin}${url}`;
    }
    
    // Se não começa com / nem com http, adiciona / no início
    return `/${url}`;
  };
  
  // Efeito para tentar diferentes fontes de imagem em cascata
  useEffect(() => {
    // Tentativa 1: Se temos base64, usar como primeira opção (mais confiável)
    if (base64Data && base64Data.startsWith('data:')) {
      console.log(`[ReliableImage] Usando base64 para mensagem ${messageId}`);
      setImageSrc(base64Data);
      return;
    }
    
    // Tentativa 2: Se temos URL, usar URLs otimizadas
    if (src) {
      try {
        const optimizedUrl = getOptimizedImageUrl(src);
        console.log(`[ReliableImage] Usando URL otimizada para mensagem ${messageId}: ${optimizedUrl.substring(0, 50)}...`);
        setImageSrc(optimizedUrl);
      } catch (e) {
        console.error(`[ReliableImage] Erro ao processar URL para mensagem ${messageId}:`, e);
        setError(true);
      }
    } else {
      // Sem URL nem base64
      console.error(`[ReliableImage] Sem fonte de imagem para mensagem ${messageId}`);
      setError(true);
    }
  }, [src, base64Data, messageId]);
  
  // Função para tentar fontes alternativas quando há erro
  const handleImageError = () => {
    console.error(`[ReliableImage] Erro ao carregar imagem de ${imageSrc?.substring(0, 30)}... para mensagem ${messageId}`);
    
    // Se estamos usando URL e temos base64 como alternativa
    if (imageSrc && !imageSrc.startsWith('data:') && base64Data && base64Data.startsWith('data:')) {
      console.log(`[ReliableImage] Usando base64 como alternativa para mensagem ${messageId}`);
      setImageSrc(base64Data);
      return;
    }
    
    // Se temos URL relativa, tentar URL absoluta com origem
    if (src && imageSrc !== `${window.location.origin}${src}` && src.startsWith('/')) {
      console.log(`[ReliableImage] Tentando URL com origem para mensagem ${messageId}`);
      setImageSrc(`${window.location.origin}${src}`);
      return;
    }
    
    // Se chegamos aqui, mostrar erro
    setError(true);
  };
  
  // Se houver erro, mostra uma imagem de fallback
  if (error) {
    return (
      <div className="w-full h-[100px] bg-gray-100 flex items-center justify-center rounded-md">
        <p className="text-gray-500 text-sm">Erro ao carregar imagem</p>
      </div>
    );
  }
  
  // Se não houver URL, mostra um placeholder de carregamento
  if (!imageSrc) {
    return (
      <div className="w-full h-[100px] bg-gray-100 flex items-center justify-center rounded-md animate-pulse">
        <p className="text-gray-400">Carregando imagem...</p>
      </div>
    );
  }
  
  // Renderiza a imagem com manipulador de erro
  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      onError={handleImageError}
      loading="eager"
      decoding="async"
      crossOrigin="anonymous"
      data-message-id={messageId}
    />
  );
}