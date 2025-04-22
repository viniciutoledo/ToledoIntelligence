import { createContext, ReactNode, useContext, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";

interface ChatSession {
  id: number;
  user_id: number;
  started_at: string;
  ended_at: string | null;
  language: "pt" | "en";
}

interface ChatMessage {
  id: number;
  session_id: number;
  user_id: number;
  message_type: "text" | "image" | "file";
  content: string | null;
  file_url: string | null;
  created_at: string;
  is_user: boolean;
}

type ChatContextType = {
  sessions: ChatSession[];
  currentSession: ChatSession | null;
  messages: ChatMessage[];
  isLoadingSessions: boolean;
  isLoadingMessages: boolean;
  createSessionMutation: any;
  endSessionMutation: any;
  sendMessageMutation: any;
  uploadFileMutation: any;
  setCurrentSession: (sessionId: number | null) => void;
};

export const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [currentSession, setCurrentSessionState] = useState<ChatSession | null>(null);

  // Get chat sessions
  const {
    data: sessions = [],
    isLoading: isLoadingSessions,
    refetch: refetchSessions,
  } = useQuery<ChatSession[]>({
    queryKey: ["/api/chat/sessions"],
    refetchOnWindowFocus: false,
  });

  // Get messages for current session
  const {
    data: messages = [],
    isLoading: isLoadingMessages,
    refetch: refetchMessages,
  } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/sessions", currentSession?.id, "messages"],
    enabled: !!currentSession,
    refetchOnWindowFocus: false,
  });

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: async (language?: string) => {
      const res = await apiRequest("POST", "/api/chat/sessions", { language });
      return await res.json();
    },
    onSuccess: (newSession: ChatSession) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/sessions"] });
      setCurrentSessionState(newSession);
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // End session mutation
  const endSessionMutation = useMutation({
    mutationFn: async (sessionId: number) => {
      const res = await apiRequest("PUT", `/api/chat/sessions/${sessionId}/end`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/sessions"] });
      if (currentSession) {
        setCurrentSessionState(null);
      }
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Send text message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({
      sessionId,
      content,
    }: {
      sessionId: number;
      content: string;
    }) => {
      const res = await apiRequest(
        "POST",
        `/api/chat/sessions/${sessionId}/messages`,
        { content }
      );
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/chat/sessions", currentSession?.id, "messages"],
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Upload file mutation
  const uploadFileMutation = useMutation({
    mutationFn: async ({
      sessionId,
      file,
    }: {
      sessionId: number;
      file: File;
    }) => {
      console.log("Iniciando upload de arquivo:", {
        name: file.name,
        type: file.type,
        size: file.size,
        sessionId
      });
      
      const formData = new FormData();
      formData.append("file", file);
      
      try {
        const res = await fetch(`/api/chat/sessions/${sessionId}/messages`, {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        console.log("Resposta do servidor:", {
          status: res.status,
          statusText: res.statusText,
          ok: res.ok
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error("Erro na resposta:", errorText);
          throw new Error(errorText || res.statusText);
        }

        const data = await res.json();
        console.log("Dados recebidos após upload:", data);
        return data;
      } catch (err) {
        console.error("Erro no upload:", err);
        throw err;
      }
    },
    onSuccess: (data) => {
      console.log("Upload bem-sucedido:", data);
      queryClient.invalidateQueries({
        queryKey: ["/api/chat/sessions", currentSession?.id, "messages"],
      });
      
      // Força uma atualização imediata da lista de mensagens
      setTimeout(() => {
        queryClient.invalidateQueries({
          queryKey: ["/api/chat/sessions", currentSession?.id, "messages"],
        });
      }, 500);
    },
    onError: (error: Error) => {
      console.error("Erro no mutation de upload:", error);
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Set current session
  const setCurrentSession = (sessionId: number | null) => {
    if (!sessionId) {
      setCurrentSessionState(null);
      return;
    }

    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      setCurrentSessionState(session);
    }
  };

  return (
    <ChatContext.Provider
      value={{
        sessions,
        currentSession,
        messages,
        isLoadingSessions,
        isLoadingMessages,
        createSessionMutation,
        endSessionMutation,
        sendMessageMutation,
        uploadFileMutation,
        setCurrentSession,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
