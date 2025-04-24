import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { Loader2 } from "lucide-react";

/**
 * Página de embed para iframe
 * 
 * Recebe uma URL encodada como parâmetro para incorporação via iframe
 * Exemplo: /embed?url=https%3A%2F%2Ftoledoia.replit.app%2Fembed%2Fwidget%3Fkey%3D12345
 */
export default function EmbedPage() {
  const [, navigate] = useLocation();
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const redirectAttempted = useRef(false);
  
  useEffect(() => {
    // Evitar múltiplos redirecionamentos
    if (redirectAttempted.current) return;
    
    const processUrl = () => {
      // Extrair a URL do iframe da query string
      const urlParam = new URLSearchParams(window.location.search).get('url');
      
      if (!urlParam) {
        // Se não houver URL, redirecionar para a landing page
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
    const timer = setTimeout(processUrl, 100);
    return () => clearTimeout(timer);
  }, [navigate]);
  
  // Estado de carregamento
  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    );
  }
  
  // Se não conseguimos obter a URL, não renderizar nada
  if (!iframeUrl) {
    return null;
  }
  
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