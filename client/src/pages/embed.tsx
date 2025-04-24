import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';

/**
 * Página de embed para iframe
 * 
 * Funciona similar ao GPT Maker, recebendo uma URL encodada como parâmetro
 * Exemplo: /embed?url=https%3A%2F%2Ftoledoia.replit.app%2Fembed%2Fwidget%3Fkey%3D12345
 */
export default function EmbedPage() {
  const [, setLocation] = useLocation();
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  
  useEffect(() => {
    // Extrair a URL do iframe da query string
    const urlParam = new URLSearchParams(window.location.search).get('url');
    
    if (!urlParam) {
      // Se não houver URL, redirecionar para a landing page
      setLocation('/');
      return;
    }
    
    try {
      // Decodificar a URL
      const decodedUrl = decodeURIComponent(urlParam);
      setIframeUrl(decodedUrl);
    } catch (error) {
      console.error('Erro ao decodificar URL:', error);
      setLocation('/');
    }
  }, [setLocation]);
  
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