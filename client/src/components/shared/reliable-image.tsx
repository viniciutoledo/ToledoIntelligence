import { useState, useEffect, useRef } from 'react';

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
  const [loading, setLoading] = useState<boolean>(true);
  const imgRef = useRef<HTMLImageElement>(null);
  const attemptCountRef = useRef<number>(0);
  
  // Função que tenta obter a URL mais confiável
  const getOptimizedImageUrl = (url: string): string => {
    // Adiciona cache buster para evitar cache entre tentativas
    const cacheBuster = `?t=${Date.now()}`;
    
    // Verifica se é uma URL absoluta
    if (url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')) {
      return url.startsWith('data:') ? url : `${url}${cacheBuster}`;
    }
    
    // Se a URL começa com /, adiciona a origem
    if (url.startsWith('/')) {
      return `${window.location.origin}${url}${cacheBuster}`;
    }
    
    // Se não começa com / nem com http, adiciona / no início
    return `/${url}${cacheBuster}`;
  };
  
  // Efeito para tentar diferentes fontes de imagem em cascata
  useEffect(() => {
    setLoading(true);
    attemptCountRef.current = 0;
    
    // Definir a fonte de imagem mais confiável na inicialização
    const initializeImageSource = () => {
      // Prioridade 1: Se temos base64, usar como primeira opção (mais confiável)
      if (base64Data && base64Data.startsWith('data:')) {
        console.log(`[ReliableImage] Usando base64 para mensagem ${messageId}`);
        setImageSrc(base64Data);
        return;
      }
      
      // Prioridade 2: Se temos URL, usar URL otimizada
      if (src) {
        try {
          const optimizedUrl = getOptimizedImageUrl(src);
          console.log(`[ReliableImage] Usando URL otimizada para mensagem ${messageId}: ${optimizedUrl.substring(0, 50)}...`);
          setImageSrc(optimizedUrl);
        } catch (e) {
          console.error(`[ReliableImage] Erro ao processar URL para mensagem ${messageId}:`, e);
          setError(true);
          setLoading(false);
        }
      } else {
        // Sem URL nem base64
        console.error(`[ReliableImage] Sem fonte de imagem para mensagem ${messageId}`);
        setError(true);
        setLoading(false);
      }
    };
    
    initializeImageSource();
  }, [src, base64Data, messageId]);
  
  // Função para tentar fontes alternativas quando há erro
  const handleImageError = () => {
    // Incrementa o contador de tentativas
    attemptCountRef.current += 1;
    
    console.error(`[ReliableImage] Erro ao carregar imagem (tentativa ${attemptCountRef.current}) de ${imageSrc?.substring(0, 30)}... para mensagem ${messageId}`);
    
    // Limite de 3 tentativas antes de desistir
    if (attemptCountRef.current >= 3) {
      // Última opção: se temos base64 e ainda não o usamos
      if (!imageSrc?.startsWith('data:') && base64Data && base64Data.startsWith('data:')) {
        console.log(`[ReliableImage] Usando base64 como última tentativa para mensagem ${messageId}`);
        setImageSrc(base64Data);
        attemptCountRef.current = 0; // Reset para dar mais chances ao base64
        return;
      }
      
      // Se já usamos base64 ou não temos
      console.error(`[ReliableImage] Todas as tentativas falharam para mensagem ${messageId}`);
      setError(true);
      setLoading(false);
      return;
    }
    
    // Estratégia 1: Se temos base64 como alternativa e não estamos usando
    if (imageSrc && !imageSrc.startsWith('data:') && base64Data && base64Data.startsWith('data:')) {
      console.log(`[ReliableImage] Usando base64 como alternativa para mensagem ${messageId}`);
      setImageSrc(base64Data);
      return;
    }
    
    // Estratégia 2: Tentar URL absoluta para URLs relativas
    if (src && !src.startsWith('http') && !src.startsWith('data:') && !src.startsWith('blob:')) {
      const fullUrl = `${window.location.origin}${src.startsWith('/') ? '' : '/'}${src}?t=${Date.now()}`;
      console.log(`[ReliableImage] Tentando URL absoluta: ${fullUrl.substring(0, 50)}...`);
      setImageSrc(fullUrl);
      return;
    }
    
    // Estratégia 3: Para URLs de upload, tentar caminho explícito
    if (src && !src.includes('/uploads/') && !src.startsWith('http') && !src.startsWith('data:')) {
      const uploadsUrl = `/uploads/${src.replace(/^\/+/, '')}?t=${Date.now()}`;
      console.log(`[ReliableImage] Tentando caminho uploads: ${uploadsUrl}`);
      setImageSrc(uploadsUrl);
      return;
    }
    
    // Se chegamos aqui, mostrar erro no próximo ciclo
    setTimeout(() => {
      setError(true);
      setLoading(false);
    }, 0);
  };
  
  const handleImageLoad = () => {
    console.log(`[ReliableImage] Imagem carregada com sucesso: ${messageId}`);
    setLoading(false);
  };
  
  // Se houver erro, mostra uma imagem de fallback
  if (error) {
    return (
      <div className="w-full h-[100px] bg-gray-100 flex items-center justify-center rounded-md">
        <p className="text-gray-500 text-sm">Erro ao carregar imagem</p>
      </div>
    );
  }
  
  // Se não houver URL ou está carregando, mostra um placeholder
  if (!imageSrc || loading) {
    return (
      <div className="w-full h-[100px] bg-gray-100 flex items-center justify-center rounded-md animate-pulse">
        <p className="text-gray-400">Carregando imagem...</p>
      </div>
    );
  }
  
  // Renderiza a imagem com manipuladores de erro e carga
  return (
    <img
      ref={imgRef}
      src={imageSrc}
      alt={alt}
      className={className}
      onError={handleImageError}
      onLoad={handleImageLoad}
      loading="eager"
      decoding="async"
      crossOrigin="anonymous"
      data-message-id={messageId}
    />
  );
}