import { createContext, useState, useContext, ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { v4 as uuidv4 } from 'uuid';

// Interfaces de dados
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

// Interface do contexto
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

// Contexto
export const WidgetChatContext = createContext<WidgetChatContextType | null>(null);

// Provider
export function WidgetChatProvider({ 
  children 
}: { 
  children: ReactNode,
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Estado
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [visitorId, setVisitorId] = useState<string>("");
  
  // Buscar informações do widget usando a nova rota dedicada para embed
  const { 
    data: widget,
    isLoading: isLoadingWidget,
    error: widgetError
  } = useQuery({
    queryKey: ["/api/embed/widget", apiKey],
    queryFn: async () => {
      if (!apiKey) return null;
      // Usando a nova rota dedicada para widgets de embed
      console.log("Buscando widget com API key:", apiKey);
      const res = await fetch(`/api/embed/widget?key=${apiKey}`);
      if (!res.ok) {
        console.error("Erro ao buscar widget:", res.status, res.statusText);
        throw new Error("Widget não encontrado ou inativo");
      }
      return res.json();
    },
    enabled: !!apiKey,
    retry: false
  });
  
  // Buscar sessão atual do chat
  const {
    data: currentSession,
    isLoading: isLoadingSessions
  } = useQuery({
    queryKey: ["/api/widgets/sessions", visitorId, widget?.id],
    queryFn: async () => {
      if (!widget || !visitorId) return null;
      const res = await fetch(`/api/widgets/sessions/active?widget_id=${widget.id}&visitor_id=${visitorId}`);
      if (!res.ok) {
        if (res.status === 404) {
          // Não tem sessão ativa, é normal
          return null;
        }
        throw new Error("Erro ao buscar sessão");
      }
      return res.json();
    },
    enabled: !!widget && !!visitorId && isInitialized,
  });
  
  // Buscar mensagens da sessão
  const {
    data: messages = [],
    isLoading: isLoadingMessages
  } = useQuery({
    queryKey: ["/api/widgets-messages", currentSession?.id],
    queryFn: async () => {
      if (!currentSession) return [];
      const res = await fetch(`/api/widgets-messages?session_id=${currentSession.id}`);
      if (!res.ok) {
        throw new Error("Erro ao buscar mensagens");
      }
      return res.json();
    },
    enabled: !!currentSession,
    refetchInterval: 5000 // Atualizar a cada 5 segundos
  });
  
  // Mutations
  
  // Criar nova sessão
  const createSessionMutation = useMutation({
    mutationFn: async ({ widgetId, language, referrerUrl }: { 
      widgetId: string; 
      language: "pt" | "en"; 
      referrerUrl?: string 
    }) => {
      const res = await apiRequest("POST", "/api/widgets/sessions", {
        widget_id: widgetId,
        visitor_id: visitorId,
        language,
        referrer_url: referrerUrl
      });
      return res.json();
    },
    onSuccess: (newSession: WidgetChatSession) => {
      queryClient.setQueryData(["/api/widgets/sessions", visitorId, widget?.id], newSession);
      
      // Também podemos atualizar a lista de mensagens para um array vazio
      queryClient.setQueryData(["/api/widgets/messages", newSession.id], []);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao iniciar sessão",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Finalizar sessão
  const endSessionMutation = useMutation({
    mutationFn: async (sessionId: number) => {
      try {
        const res = await apiRequest("PUT", `/api/widgets/sessions/${sessionId}/end`);
        
        // Se a sessão já estiver encerrada, não é um erro real
        if (!res.ok && res.status === 400) {
          const errorData = await res.json();
          if (errorData.message && errorData.message.includes("Sessão já encerrada")) {
            console.log("Sessão já estava encerrada:", sessionId);
            return { alreadyClosed: true };
          }
          throw new Error(errorData.message || "Erro ao finalizar sessão");
        }
        
        return res.json();
      } catch (error) {
        console.error("Erro ao finalizar sessão:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/widgets/sessions", visitorId, widget?.id]
      });
    },
    onError: (error: Error) => {
      // Não mostrar toast para erros de "sessão já encerrada"
      if (error.message && !error.message.includes("Sessão já encerrada")) {
        toast({
          title: "Erro ao finalizar sessão",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  });
  
  // Enviar mensagem
  const sendMessageMutation = useMutation({
    mutationFn: async ({ 
      sessionId, 
      content, 
      messageType = "text",
      isUser = true
    }: { 
      sessionId: number; 
      content: string; 
      messageType?: "text" | "image" | "file";
      isUser?: boolean;
    }) => {
      try {
        console.log("Enviando mensagem para sessão:", sessionId, "conteúdo:", content);
        // Verificar se a sessão está ativa antes de tentar enviar a mensagem
        const sessionCheckRes = await fetch(`/api/widgets/sessions/active?widget_id=${widget?.id}&visitor_id=${visitorId}`);
        
        if (!sessionCheckRes.ok) {
          if (sessionCheckRes.status === 404) {
            throw new Error("Sessão não encontrada ou expirada. Tente reiniciar o chat.");
          }
          throw new Error("Erro ao verificar sessão");
        }
        
        const activeSession = await sessionCheckRes.json();
        
        // Se a sessão está encerrada, criar uma nova
        if (activeSession.ended_at) {
          throw new Error("Sessão encerrada. Tente reiniciar o chat.");
        }
        
        // Enviar a mensagem
        const res = await apiRequest("POST", "/api/widgets-messages", {
          session_id: sessionId,
          content,
          message_type: messageType,
          is_user: isUser
        });
        
        if (!res.ok) {
          if (res.status === 403) {
            const errorData = await res.json();
            throw new Error(errorData.message || "Erro ao enviar mensagem");
          }
        }
        
        return res.json();
      } catch (error) {
        console.error("Erro ao enviar mensagem:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      // As mensagens (usuário e IA) vêm juntas na resposta
      const { userMessage, aiMessage } = data;
      
      // Adicionar ambas as mensagens à lista
      const currentMessages = queryClient.getQueryData<WidgetChatMessage[]>([
        "/api/widgets-messages", 
        currentSession?.id
      ]) || [];
      
      const newMessages = [...currentMessages];
      
      // Adicionar mensagem do usuário se presente na resposta
      if (userMessage) {
        newMessages.push(userMessage);
      }
      
      // Adicionar mensagem da IA se presente na resposta  
      if (aiMessage) {
        newMessages.push(aiMessage);
      }
      
      // Atualizar o cache com as novas mensagens
      queryClient.setQueryData(
        ["/api/widgets-messages", currentSession?.id],
        newMessages
      );
      
      // Forçar uma revalidação para buscar quaisquer outras mensagens
      setTimeout(() => {
        queryClient.invalidateQueries({
          queryKey: ["/api/widgets-messages", currentSession?.id]
        });
      }, 1000);
    },
    onError: (error: Error) => {
      console.error("Erro na mutação de envio de mensagem:", error);
      
      // Se a sessão está encerrada, tentar criar uma nova automaticamente
      if (error.message && (
          error.message.includes("Sessão encerrada") || 
          error.message.includes("Sessão não encontrada") ||
          error.message.includes("expirada")
        )) {
        // Resetar estado para permitir a criação de uma nova sessão
        sessionCreationAttempted.current = false;
        // Forçar a invalidação da sessão atual para disparar a criação de uma nova
        queryClient.invalidateQueries({
          queryKey: ["/api/widgets/sessions", visitorId, widget?.id]
        });
      }
      
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Upload de arquivo
  const uploadFileMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/widgets/upload", {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      
      if (!res.ok) {
        throw new Error("Erro ao enviar arquivo");
      }
      
      return res.json();
    },
    onSuccess: () => {
      // Invalidar para obter as novas mensagens
      setTimeout(() => {
        queryClient.invalidateQueries({
          queryKey: ["/api/widgets-messages", currentSession?.id]
        });
      }, 1000);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao enviar arquivo",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Método para inicializar o widget
  const initializeWidget = async (newApiKey: string): Promise<void> => {
    if (!newApiKey) return;
    
    try {
      // Gerar ID de visitante único
      let storedVisitorId = localStorage.getItem('toledoia_visitor_id');
      if (!storedVisitorId) {
        storedVisitorId = uuidv4();
        localStorage.setItem('toledoia_visitor_id', storedVisitorId);
      }
      
      setVisitorId(storedVisitorId);
      setApiKey(newApiKey);
      setIsInitialized(true);
    } catch (error) {
      // Em caso de erro com localStorage (ex: iframe com restrições)
      const randomId = Math.random().toString(36).substring(2, 15);
      setVisitorId(randomId);
      setApiKey(newApiKey);
      setIsInitialized(true);
    }
  };
  
  // Se houver erro no widget, não mostrar o contexto
  if (widgetError && apiKey) {
    toast({
      title: "Erro ao carregar widget",
      description: "Não foi possível carregar os dados do widget. Verifique a API key.",
      variant: "destructive",
    });
  }
  
  return (
    <WidgetChatContext.Provider
      value={{
        widget,
        isLoadingWidget,
        currentSession,
        messages,
        isLoadingSessions,
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

// Hook personalizado
export function useWidgetChat() {
  const context = useContext(WidgetChatContext);
  if (!context) {
    throw new Error("useWidgetChat deve ser usado dentro de um WidgetChatProvider");
  }
  return context;
}