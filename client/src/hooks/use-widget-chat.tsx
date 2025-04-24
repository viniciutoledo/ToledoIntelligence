import { createContext, useState, useContext, ReactNode, useRef } from "react";
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
  fileBase64?: string; // Adicionado para suporte a fallback base64
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
  isProcessingLlm: boolean; // Estado para animação de carregamento da LLM
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
  const [isProcessingLlm, setIsProcessingLlm] = useState(false);
  const sessionCreationAttempted = useRef<boolean>(false);
  
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
        // Ativar a animação de carregamento da LLM se for mensagem do usuário
        if (isUser) {
          setIsProcessingLlm(true);
        }
        
        console.log("Enviando mensagem para sessão:", sessionId, "conteúdo:", content);
        
        // Adicionar previamente a mensagem do usuário ao cache para feedback imediato
        if (isUser) {
          const previewUserMessage: WidgetChatMessage = {
            id: Date.now(), // ID temporário
            session_id: sessionId,
            message_type: messageType,
            content: content,
            file_url: null,
            created_at: new Date().toISOString(),
            is_user: true
          };
          
          // Obter mensagens atuais
          const currentMessages = queryClient.getQueryData<WidgetChatMessage[]>([
            "/api/widgets-messages", 
            sessionId
          ]) || [];
          
          // Atualizar cache com a mensagem do usuário imediatamente
          queryClient.setQueryData(
            ["/api/widgets-messages", sessionId],
            [...currentMessages, previewUserMessage]
          );
        }
        
        // Enviar a mensagem
        const res = await apiRequest("POST", "/api/widgets-messages", {
          session_id: sessionId,
          content,
          message_type: messageType,
          is_user: isUser
        });
        
        if (!res.ok) {
          const errorData = await res.json();
          
          // Se for erro de sessão encerrada, tentar recriar a sessão
          if (res.status === 403 && errorData.message === "Sessão encerrada") {
            console.log("Sessão encerrada, recriando");
            // Resetar tentativa de criação
            sessionCreationAttempted.current = false;
            // Invalidar consulta da sessão para forçar recriação
            queryClient.invalidateQueries({
              queryKey: ["/api/widgets/sessions", visitorId, widget?.id]
            });
            
            throw new Error("Sessão expirada. O chat será reiniciado automaticamente.");
          }
          
          throw new Error(errorData.message || "Erro ao enviar mensagem");
        }
        
        return res.json();
      } catch (error) {
        console.error("Erro ao enviar mensagem:", error);
        setIsProcessingLlm(false); // Desativar animação em caso de erro
        throw error;
      }
    },
    onSuccess: (data) => {
      // Desativar a animação de carregamento da LLM quando receber a resposta
      setIsProcessingLlm(false);
      
      // As mensagens (usuário e IA) vêm juntas na resposta
      const { userMessage, aiMessage } = data;
      
      // Obter mensagens atuais
      const currentMessages = queryClient.getQueryData<WidgetChatMessage[]>([
        "/api/widgets-messages", 
        currentSession?.id
      ]) || [];
      
      // Filtrar mensagens temporárias (criadas pelo preview)
      const filteredMessages = currentMessages.filter(msg => 
        // Manter mensagens que não sejam do usuário ou que tenham ID mais antigo
        !msg.is_user || msg.id < Date.now() - 10000
      );
      
      const newMessages = [...filteredMessages];
      
      // Adicionar mensagem oficial do usuário se presente na resposta
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
      try {
        // Ativar a animação de carregamento da LLM
        setIsProcessingLlm(true);
        
        // Verificar se a sessão está ativa
        if (!currentSession || currentSession.ended_at) {
          throw new Error("Sessão encerrada. Por favor, atualize a página para iniciar uma nova sessão.");
        }
        
        const sessionId = formData.get("session_id");
        const file = formData.get("file") as File;
        
        if (!sessionId || !file) {
          throw new Error("Sessão ou arquivo inválidos");
        }
        
        console.log("Enviando arquivo para sessão:", sessionId, "nome:", file.name);
        
        // Se for imagem, podemos mostrar preview imediatamente
        const isImage = file.type.startsWith("image/");
        const messageType = isImage ? "image" : "file";
        
        // Armazenar o arquivo original para futuras referências
        const originalFile = file;
        
        // Criar e armazenar URL temporária para preview da imagem
        let previewUrl = null;
        if (isImage) {
          try {
            // Criar uma URL temporária para exibir a imagem antes do upload ser finalizado
            previewUrl = URL.createObjectURL(file);
            
            // Armazenar em um atributo para a URL persistir durante o upload
            // @ts-ignore - adicionando campo temporário que não está na interface
            file._previewUrl = previewUrl;
            
            console.log("URL temporária criada:", previewUrl);
          } catch (e) {
            console.error("Erro ao criar preview da imagem:", e);
          }
        }
        
        // Gerar um ID único temporário para a mensagem prévia
        const tempId = Date.now();
        
        // Criar mensagem prévia
        const previewUserMessage: WidgetChatMessage = {
          id: tempId, // ID temporário
          session_id: Number(sessionId),
          message_type: messageType,
          content: file.name,
          file_url: previewUrl, // Usamos a URL temporária para dar feedback visual
          created_at: new Date().toISOString(),
          is_user: true
        };
        
        // Obter mensagens atuais
        const currentMessages = queryClient.getQueryData<WidgetChatMessage[]>([
          "/api/widgets-messages", 
          Number(sessionId)
        ]) || [];
        
        // Atualizar cache com a mensagem do usuário imediatamente
        queryClient.setQueryData(
          ["/api/widgets-messages", Number(sessionId)],
          [...currentMessages, previewUserMessage]
        );
        
        // Realizar o upload do arquivo
        const res = await fetch("/api/widgets/upload", {
          method: "POST",
          body: formData,
          credentials: "include"
        });
        
        // Tratar erros específicos
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ message: "Erro desconhecido" }));
          
          // Se for erro de sessão encerrada, tentar recriar a sessão
          if (res.status === 403 && errorData.message === "Sessão encerrada") {
            console.log("Sessão encerrada, tentando recriar...");
            // Resetar tentativa de criação
            sessionCreationAttempted.current = false;
            // Invalidar consulta da sessão para forçar recriação
            queryClient.invalidateQueries({
              queryKey: ["/api/widgets/sessions", visitorId, widget?.id]
            });
            
            throw new Error("Sessão expirada. O chat será reiniciado automaticamente.");
          }
          
          throw new Error(errorData.message || "Erro ao enviar arquivo");
        }
        
        // Obter a resposta do servidor
        const responseData = await res.json();
        
        // Verificar se temos a mensagem do usuário na resposta
        if (responseData.userMessage) {
          // Garantir que a URL do arquivo da mensagem do usuário está correta
          if (isImage && responseData.userMessage.message_type === "image") {
            // Se o servidor não enviou URL para a imagem, usar a URL temporária
            if (!responseData.userMessage.file_url && previewUrl) {
              responseData.userMessage.file_url = previewUrl;
            }
          }
        }
        
        return {
          ...responseData,
          tempId: tempId, // Incluir o ID temporário para podermos encontrar a mensagem prévia
          previewUrl: previewUrl // Incluir a URL da prévia
        };
      } catch (error) {
        console.error("Erro no upload de arquivo:", error);
        throw error;
      } finally {
        // Não revocar URL aqui, pois precisamos dela para exibir a prévia
        // Ela será revogada eventualmente pelo navegador quando não for mais necessária
      }
    },
    onSuccess: (data) => {
      // Desativar a animação de carregamento da LLM
      setIsProcessingLlm(false);
      
      // Obter os dados da resposta
      const { userMessage, aiMessage, fileUrl, tempId, previewUrl } = data;
      
      console.log("Recebendo resposta do upload:", {
        userMsg: userMessage?.id, 
        fileUrl, 
        userMsgFileUrl: userMessage?.file_url
      });
      
      // Obter mensagens atuais
      const currentMessages = queryClient.getQueryData<WidgetChatMessage[]>([
        "/api/widgets-messages", 
        currentSession?.id
      ]) || [];
      
      // Filtrar todas as mensagens temporárias do usuário (as que possuem ID temporário)
      // exceto a que acabou de ser enviada, que manteremos como está
      const filteredMessages = currentMessages.filter(msg => 
        !msg.is_user || // Manter todas as mensagens que não são do usuário
        msg.id < 1000000000000 || // Manter mensagens com ID não-temporário
        (msg.id === tempId && msg.file_url === previewUrl) // Manter mensagem temporária que acabamos de adicionar
      );
      
      const newMessages = [...filteredMessages];
      
      // Criar uma cópia da mensagem para garantir que podemos modificá-la
      const finalUserMessage = userMessage ? { ...userMessage } : null;
      
      // Se o servidor enviou um fileUrl separado, é garantido que é o correto
      if (finalUserMessage && fileUrl) {
        // Usar a URL do arquivo retornada pelo servidor, que é garantida como correta
        finalUserMessage.file_url = fileUrl;
        console.log("URL do arquivo definida a partir de fileUrl:", fileUrl);
      } 
      // Se não temos fileUrl separado mas temos userMessage com message_type image
      else if (finalUserMessage && finalUserMessage.message_type === "image") {
        // Se o servidor não enviou URL do arquivo ou enviou uma URL vazia, usar a URL da prévia
        if (!finalUserMessage.file_url || finalUserMessage.file_url === '') {
          // Procurar a mensagem de prévia
          const previewMessage = filteredMessages.find(msg => msg.id === tempId);
          if (previewMessage && previewMessage.file_url) {
            finalUserMessage.file_url = previewMessage.file_url;
            console.log("URL do arquivo definida a partir de previewMessage:", previewMessage.file_url);
          }
        }
      }
      
      // Adicionar mensagem oficial do usuário se presente na resposta
      // substituindo a versão temporária
      if (finalUserMessage) {
        // Remover qualquer mensagem temporária correspondente
        const actualMessages = newMessages.filter(msg => msg.id !== tempId);
        newMessages.length = 0; // Esvaziar o array
        newMessages.push(...actualMessages, finalUserMessage);
        
        console.log("Mensagem final do usuário:", {
          id: finalUserMessage.id,
          tipo: finalUserMessage.message_type,
          url: finalUserMessage.file_url
        });
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
      // Desativar a animação de carregamento da LLM
      setIsProcessingLlm(false);
      
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
        
        toast({
          title: "Sessão reiniciada",
          description: "Sua sessão foi reiniciada. Por favor, tente novamente.",
          variant: "default",
        });
      } else {
        toast({
          title: "Erro ao enviar arquivo",
          description: error.message || "Não foi possível enviar o arquivo. Por favor, tente novamente.",
          variant: "destructive",
        });
      }
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
        isProcessingLlm,
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