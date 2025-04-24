import { useEffect } from "react";
import { useLanguage } from "@/hooks/use-language";
import { useChat } from "@/hooks/use-chat";
import { useAvatar } from "@/hooks/use-avatar";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { ChatInterface as SharedChatInterface } from "@/components/shared/chat-interface";

export function ChatInterface() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { avatar } = useAvatar();
  const {
    currentSession,
    messages,
    createSessionMutation,
    sendMessageMutation,
    uploadFileMutation,
  } = useChat();
  
  const isLoading = createSessionMutation.isPending || 
                   sendMessageMutation.isPending || 
                   uploadFileMutation.isPending;
  
  // Criar uma nova sessão quando o componente monta, se nenhuma existir
  useEffect(() => {
    if (!currentSession && !createSessionMutation.isPending) {
      createSessionMutation.mutate(user?.language);
    }
  }, [currentSession, createSessionMutation, user]);
  
  // Estado de carregamento
  if (createSessionMutation.isPending) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-neutral-600">{t("common.loading")}</p>
      </div>
    );
  }

  // Formatando o avatar para o componente compartilhado
  const chatAvatar = avatar ? {
    image_url: avatar.image_url,
    name: avatar.name || (user?.language === "pt" ? "Bot ToledoIA" : "ToledoIA Bot")
  } : undefined;

  // Lidar com o envio de mensagem
  const handleSendMessage = (content: string) => {
    if (!content.trim() || !currentSession) return;
    
    sendMessageMutation.mutate({
      sessionId: currentSession.id,
      content,
    });
  };
  
  // Lidar com o upload de arquivo
  const handleFileUpload = (file: File) => {
    if (!file || !currentSession) return;
    
    uploadFileMutation.mutate({
      sessionId: currentSession.id,
      file,
    });
  };

  return (
    <SharedChatInterface
      messages={messages}
      currentSession={currentSession}
      avatar={chatAvatar}
      isLoading={isLoading}
      onSendMessage={handleSendMessage}
      onFileUpload={handleFileUpload}
    />
  );
}