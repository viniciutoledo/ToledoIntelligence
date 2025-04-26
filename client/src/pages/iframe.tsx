import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Loader2 } from "lucide-react";
import { EmbeddedChat } from '@/components/widget/embedded-chat';

/**
 * Página de iframe para chat ToledoIA
 * URL: /embed/iframe?key=API_KEY
 * 
 * Esta página é específica para incorporação em plataformas como Curseduca
 * Ela renderiza apenas o widget de chat sem elementos adicionais
 * não faz redirecionamentos e retorna cabeçalhos específicos para permitir embed
 */
export default function IframePage() {
  const [, navigate] = useLocation();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // Obter a API key do parâmetro de query
    const keyParam = new URLSearchParams(window.location.search).get('key');
    
    if (!keyParam) {
      setError('API key não fornecida. Use o parâmetro "key".');
      setIsLoading(false);
      return;
    }
    
    setApiKey(keyParam);
    setIsLoading(false);

    // Adicionar atributos específicos do iframe
    document.documentElement.classList.add('iframe-embedded');
    document.body.classList.add('iframe-embedded-body');
    
    return () => {
      document.documentElement.classList.remove('iframe-embedded');
      document.body.classList.remove('iframe-embedded-body');
    };
  }, [navigate]);
  
  // Estado de carregamento
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-transparent">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    );
  }
  
  // Estado de erro
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full p-4 text-center bg-transparent">
        <h2 className="text-lg font-semibold text-red-600 mb-2">Erro</h2>
        <p className="text-sm text-gray-700">{error}</p>
      </div>
    );
  }
  
  // Se temos uma API key, mostrar o chat widget diretamente
  if (apiKey) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-transparent">
        <EmbeddedChat 
          apiKey={apiKey} 
          initialOpen={true} 
          hideHeader={true}
          fullHeight={true}
        />
      </div>
    );
  }
  
  return null;
}