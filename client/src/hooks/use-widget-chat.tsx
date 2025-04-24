import { createContext, ReactNode, useContext, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";

// Tipos
interface WidgetChatSession {
  id: number;
  widget_id: string;
  visitor_id: string;
  started_at: string;
  ended_at: string | null;
  language: "pt" | "en";
  referrer_url: string | null;
  created_at: string;
}

interface WidgetChatMessage {
  id: number;
  session_id: number;
  message_type: "text" | "image" | "file";
  content: string | null;
  file_url: string | null;
  created_at: string;
  is_user: boolean;
}

interface WidgetInfo {
  id: string;
  name: string;
  greeting: string;
  avatar_url: string;
  theme_color: string;
  is_active: boolean;
  allowed_domains: string[];
  created_at: string;
  updated_at: string;
  user_id: number;
}

interface WidgetChatContextType {
  widget: WidgetInfo | null;
  isLoadingWidget: boolean;
  currentSession: WidgetChatSession | null;
  messages: WidgetChatMessage[];
  isLoadingSessions: boolean;
  isLoadingMessages: boolean;
  isInitialized: boolean;
  createSessionMutation: any;
  endSessionMutation: any;
  sendMessageMutation: any;
  uploadFileMutation: any;
  initializeWidget: (apiKey: string) => Promise<void>;
}

export const WidgetChatContext = createContext<WidgetChatContextType | null>(null);

export function WidgetChatProvider({ 
  children,
  apiKey,
  autoInit = false
}: { 
  children: ReactNode,
  apiKey?: string,
  autoInit?: boolean
}) {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const [currentSession, setCurrentSession] = useState<WidgetChatSession | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // Função para gerar ID de visitante único
  const generateVisitorId = () => {
    // Verifica se já existe um ID armazenado no localStorage
    const existingId = localStorage.getItem('widgetVisitorId');
    if (existingId) return existingId;
    
    // Caso contrário, gera um novo ID aleatório
    const newId = 'visitor_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('widgetVisitorId', newId);
    return newId;
  };
  
  // Consulta para obter informações do widget
  const {
    data: widget = null,
    isLoading: isLoadingWidget,
    refetch: refetchWidget,
  } = useQuery<WidgetInfo | null>({
    queryKey: ['/api/public/widgets'],
    queryFn: async () => {
      if (!apiKey) throw new Error('API key não fornecida');
      
      const response = await fetch('/api/public/widgets', {
        headers: {
          'X-API-Key': apiKey
        }
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Falha ao obter dados do widget');
      }
      
      return response.json();
    },
    enabled: !!apiKey && autoInit,
    retry: false,
  });
  
  // Obter mensagens para a sessão atual
  const {
    data: messages = [],
    isLoading: isLoadingMessages,
    refetch: refetchMessages,
  } = useQuery<WidgetChatMessage[]>({
    queryKey: ['/api/public/widgets/sessions', currentSession?.id, 'messages'],
    queryFn: async () => {
      if (!currentSession || !apiKey) return [];
      
      const response = await fetch(`/api/public/widgets/sessions/${currentSession.id}/messages`, {
        headers: {
          'X-API-Key': apiKey
        }
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Falha ao obter mensagens');
      }
      
      return response.json();
    },
    enabled: !!currentSession && !!apiKey,
    refetchInterval: 3000, // Polling para novas mensagens a cada 3 segundos
  });
  
  // Mutation para criar sessão
  const createSessionMutation = useMutation({
    mutationFn: async () => {
      if (!apiKey) throw new Error('API key não fornecida');
      
      const visitorId = generateVisitorId();
      const referrerUrl = document.referrer || window.location.href;
      
      const response = await fetch('/api/public/widgets/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({
          visitor_id: visitorId,
          language,
          referrer_url: referrerUrl
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Falha ao criar sessão de chat');
      }
      
      return response.json();
    },
    onSuccess: (newSession: WidgetChatSession) => {
      setCurrentSession(newSession);
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Mutation para encerrar sessão
  const endSessionMutation = useMutation({
    mutationFn: async (sessionId: number) => {
      if (!apiKey) throw new Error('API key não fornecida');
      
      const response = await fetch(`/api/public/widgets/sessions/${sessionId}/end`, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey
        }
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Falha ao encerrar sessão');
      }
      
      return response.json();
    },
    onSuccess: () => {
      if (currentSession) {
        setCurrentSession(null);
      }
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Mutation para enviar mensagem de texto
  const sendMessageMutation = useMutation({
    mutationFn: async ({
      sessionId,
      content,
    }: {
      sessionId: number;
      content: string;
    }) => {
      if (!apiKey) throw new Error('API key não fornecida');
      
      const response = await fetch(`/api/public/widgets/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({ content })
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Falha ao enviar mensagem');
      }
      
      return response.json();
    },
    onSuccess: () => {
      refetchMessages();
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Mutation para fazer upload de arquivo
  const uploadFileMutation = useMutation({
    mutationFn: async ({
      sessionId,
      file,
    }: {
      sessionId: number;
      file: File;
    }) => {
      if (!apiKey) throw new Error('API key não fornecida');
      
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`/api/public/widgets/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: {
          'X-API-Key': apiKey
        },
        body: formData
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Falha ao enviar arquivo');
      }
      
      return response.json();
    },
    onSuccess: () => {
      refetchMessages();
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Função para inicializar o widget
  const initializeWidget = async (key: string = apiKey || '') => {
    if (!key) {
      console.error('API key não fornecida para inicialização do widget');
      return;
    }
    
    try {
      // Consulta o widget
      const widgetResponse = await fetch('/api/public/widgets', {
        headers: {
          'X-API-Key': key
        }
      });
      
      if (!widgetResponse.ok) {
        const error = await widgetResponse.text();
        throw new Error(error || 'Falha ao obter dados do widget');
      }
      
      const widgetData = await widgetResponse.json();
      queryClient.setQueryData(['/api/public/widgets'], widgetData);
      
      // Cria uma nova sessão
      const visitorId = generateVisitorId();
      const referrerUrl = document.referrer || window.location.href;
      
      const sessionResponse = await fetch('/api/public/widgets/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': key
        },
        body: JSON.stringify({
          visitor_id: visitorId,
          language,
          referrer_url: referrerUrl
        })
      });
      
      if (!sessionResponse.ok) {
        const error = await sessionResponse.text();
        throw new Error(error || 'Falha ao criar sessão de chat');
      }
      
      const sessionData = await sessionResponse.json();
      setCurrentSession(sessionData);
      setIsInitialized(true);
      
    } catch (error: any) {
      console.error('Erro ao inicializar widget:', error);
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  };
  
  return (
    <WidgetChatContext.Provider
      value={{
        widget,
        isLoadingWidget,
        currentSession,
        messages,
        isLoadingSessions: false,
        isLoadingMessages,
        isInitialized,
        createSessionMutation,
        endSessionMutation,
        sendMessageMutation,
        uploadFileMutation,
        initializeWidget
      }}
    >
      {children}
    </WidgetChatContext.Provider>
  );
}

export function useWidgetChat() {
  const context = useContext(WidgetChatContext);
  if (!context) {
    throw new Error("useWidgetChat must be used within a WidgetChatProvider");
  }
  return context;
}