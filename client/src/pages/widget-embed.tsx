import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { EmbeddedChat } from '@/components/widget/embedded-chat';

/**
 * Esta página é destinada a ser incorporada em um iframe em sites externos.
 * Ela renderiza o widget de chat usando o API key fornecido na query string.
 */
export default function WidgetEmbedPage() {
  const [, setLocation] = useLocation();
  
  // Extrair o apiKey da url
  const apiKey = new URLSearchParams(window.location.search).get('key');
  
  // Se não houver API key, redirecionar para a landing page
  useEffect(() => {
    if (!apiKey) {
      setLocation('/');
    }
  }, [apiKey, setLocation]);
  
  if (!apiKey) {
    return null;
  }
  
  return (
    <div className="h-screen w-screen overflow-hidden">
      <EmbeddedChat apiKey={apiKey} initialOpen={true} />
    </div>
  );
}