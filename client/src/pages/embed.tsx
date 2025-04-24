import { useEffect, useState, useRef } from 'react';
import { useLocation, useParams } from 'wouter';
import { Loader2 } from "lucide-react";
import { EmbeddedChat } from '@/components/widget/embedded-chat';

/**
 * Página de embed para chat ToledoIA
 * 
 * Suporta dois tipos de URLs:
 * 1. /embed/:apiKey - Recebe a API key diretamente na URL
 * 2. /embed?url=URL_ENCODED - Recebe uma URL codificada para iframe
 */
export default function EmbedPage() {
  const [, navigate] = useLocation();
  const params = useParams();
  
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const redirectAttempted = useRef(false);
  
  useEffect(() => {
    // Evitar múltiplos redirecionamentos
    if (redirectAttempted.current) return;
    
    const processRequest = () => {
      // Verificar primeiro se temos um parâmetro apiKey na URL (novo formato)
      if (params.apiKey) {
        console.log("API key encontrada na URL:", params.apiKey);
        setApiKey(params.apiKey);
        setIsLoading(false);
        return;
      }
      
      // Se não tem apiKey no caminho, tenta obter URL do iframe dos parâmetros de query
      const urlParam = new URLSearchParams(window.location.search).get('url');
      
      if (!urlParam) {
        // Se não houver API key nem URL, redirecionar para a landing page
        console.log("Nem API key nem URL encontrada, redirecionando para home");
        redirectAttempted.current = true;
        navigate('/');
        return;
      }
      
      try {
        // Decodificar a URL
        const decodedUrl = decodeURIComponent(urlParam);
        setIframeUrl(decodedUrl);
        setIsLoading(false);
      } catch (error) {
        console.error('Erro ao decodificar URL:', error);
        redirectAttempted.current = true;
        navigate('/');
      }
    };
    
    // Usar um pequeno timeout para evitar problemas de ciclo de renderização
    const timer = setTimeout(processRequest, 100);
    return () => clearTimeout(timer);
  }, [navigate, params]);
  
  // Estado de carregamento
  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    );
  }
  
  // Se temos uma API key, mostrar o chat widget diretamente
  if (apiKey) {
    // Verificar se o parâmetro hideHeader está na URL
    const urlParams = new URLSearchParams(window.location.search);
    const hideHeader = urlParams.get('hideHeader') === 'true';
    
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <EmbeddedChat 
          apiKey={apiKey} 
          initialOpen={true} 
          hideHeader={hideHeader} 
        />
      </div>
    );
  }
  
  // Se não conseguimos obter a URL para iframe, não renderizar nada
  if (!iframeUrl) {
    return null;
  }
  
  // Renderizar iframe para compatibilidade com formato antigo
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background">
      <iframe
        src={iframeUrl}
        className="w-full h-full border-none"
        frameBorder="0"
        allow="microphone"
        title="ToledoIA Widget"
      />
    </div>
  );
}