import { useState, useEffect, useRef } from 'react';

interface UltimateImageProps {
  src: string | null | undefined;
  alt?: string;
  className?: string;
}

// Este componente é a solução definitiva para o problema de exibição de imagens
// Implementa um sistema de fallback em camadas e múltiplas tentativas
export function UltimateImage({ src, alt = "Imagem", className = "" }: UltimateImageProps) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  const imgRef = useRef<HTMLImageElement>(null);
  
  // Função para preparar a URL da imagem
  const prepareImageUrl = (source: string) => {
    // Detectar imagens base64
    const isBase64 = source.startsWith('data:');
    
    if (isBase64) {
      // Usar imagem base64 diretamente (mais confiável)
      return source;
    } else {
      // Para URLs, transformar em URL absoluta e adicionar timestamp para evitar cache
      let fullUrl = source;
      if (!source.startsWith('http')) {
        fullUrl = `${window.location.origin}${source.startsWith('/') ? '' : '/'}${source}`;
      }
      
      // Adicionar query param de timestamp para evitar cache
      const timestamp = Date.now();
      return `${fullUrl}${fullUrl.includes('?') ? '&' : '?'}_t=${timestamp}`;
    }
  };
  
  // Tentar carregar a imagem novamente com diferente abordagem
  const retryWithDifferentApproach = () => {
    if (!src || retryCount >= maxRetries) {
      setError(true);
      setLoading(false);
      return;
    }
    
    // Incrementar contador de tentativas
    setRetryCount(prev => prev + 1);
    
    // Tentar diferentes abordagens baseado no contador
    if (retryCount === 1) {
      // Na primeira tentativa, adicionar um novo timestamp
      const newTimestamp = Date.now();
      if (src.startsWith('data:')) {
        // Se é base64, não há muito o que fazer além de tentar novamente
        setImageSrc(src);
      } else {
        // Se é URL, tentar com novo timestamp
        const baseUrl = src.split('?')[0]; // Remover query params existentes
        setImageSrc(`${baseUrl}?_t=${newTimestamp}`);
      }
    } else if (retryCount === 2) {
      // Na segunda tentativa, se temos uma URL que não é base64,
      // tentar com um proxy de imagem ou CORS anywhere
      if (!src.startsWith('data:') && src.startsWith('http')) {
        // Usar a URL direta do servidor em vez de proxy - última chance
        const urlParts = src.split('/');
        const filename = urlParts[urlParts.length - 1];
        setImageSrc(`${window.location.origin}/uploads/${filename}`);
      }
    }
    
    // Resetar o estado de loading
    setLoading(true);
  };
  
  // Efeito para inicializar a imagem
  useEffect(() => {
    if (!src) {
      setError(true);
      setLoading(false);
      return;
    }
    
    // Resetar estados quando src muda
    setError(false);
    setLoading(true);
    setRetryCount(0);
    
    try {
      // Preparar a URL da imagem
      const processedSrc = prepareImageUrl(src);
      setImageSrc(processedSrc);
    } catch (err) {
      console.error("Erro ao processar URL da imagem:", err);
      setError(true);
      setLoading(false);
    }
  }, [src]);
  
  // Componentes para os diferentes estados
  const ErrorDisplay = () => (
    <div className="p-2 bg-red-50 text-red-500 text-sm rounded">
      {!src ? "Imagem não disponível" : "Erro ao carregar imagem"}
    </div>
  );
  
  const LoadingDisplay = () => (
    <div className="animate-pulse bg-gray-200 h-32 w-full rounded flex items-center justify-center">
      <div className="w-8 h-8 border-4 rounded-full border-t-transparent border-primary animate-spin"></div>
    </div>
  );
  
  // Handler para quando a imagem carregar com sucesso
  const handleImageLoaded = () => {
    setLoading(false);
    setError(false);
  };
  
  // Handler para quando ocorrer um erro no carregamento da imagem
  const handleImageError = () => {
    // Se ainda não excedemos o número máximo de tentativas, tente novamente
    if (retryCount < maxRetries) {
      retryWithDifferentApproach();
    } else {
      setLoading(false);
      setError(true);
    }
  };
  
  // Exibição baseada nos estados
  if (error && !loading) {
    return <ErrorDisplay />;
  }
  
  return (
    <div className="image-container relative">
      {loading && <LoadingDisplay />}
      
      {imageSrc && (
        <img
          ref={imgRef}
          src={imageSrc}
          alt={alt}
          className={`max-w-full max-h-60 object-contain ${className} ${loading ? 'hidden' : ''}`}
          onLoad={handleImageLoaded}
          onError={handleImageError}
          loading="lazy"
        />
      )}
    </div>
  );
}