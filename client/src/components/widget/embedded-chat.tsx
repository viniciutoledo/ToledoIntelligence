import React, { useEffect, useState } from "react";
import { useWidgetChat } from "@/hooks/use-widget-chat";
import { ChatInterface } from "@/components/shared/chat-interface";
import { LanguageProvider } from "@/hooks/use-language";
import { Loader2 } from "lucide-react";

interface EmbeddedChatProps {
  apiKey: string;
  initialOpen?: boolean;
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  width?: number;
  height?: number;
}

export function EmbeddedChat({
  apiKey,
  initialOpen = false,
  position = "bottom-right",
  width = 350,
  height = 600,
}: EmbeddedChatProps) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const {
    widget,
    currentSession,
    messages,
    isLoadingWidget,
    isLoadingMessages,
    sendMessageMutation,
    uploadFileMutation,
    initializeWidget,
    isInitialized
  } = useWidgetChat();
  
  // Inicializar o widget quando o componente for montado
  useEffect(() => {
    if (apiKey && !isInitialized) {
      initializeWidget(apiKey);
    }
  }, [apiKey, initializeWidget, isInitialized]);
  
  // Posicionamento dinâmico
  const getPositionClasses = () => {
    switch (position) {
      case "bottom-right":
        return "bottom-4 right-4";
      case "bottom-left":
        return "bottom-4 left-4";
      case "top-right":
        return "top-4 right-4";
      case "top-left":
        return "top-4 left-4";
      default:
        return "bottom-4 right-4";
    }
  };
  
  // Lidar com envio de mensagem
  const handleSendMessage = (content: string) => {
    if (!content.trim() || !currentSession) return;
    
    sendMessageMutation.mutate({
      sessionId: currentSession.id,
      content,
    });
  };
  
  // Lidar com upload de arquivo
  const handleFileUpload = (file: File) => {
    if (!file || !currentSession) return;
    
    uploadFileMutation.mutate({
      sessionId: currentSession.id,
      file,
    });
  };
  
  // Botão para abrir/fechar o chat
  const renderChatButton = () => {
    if (isOpen) return null;
    
    return (
      <button
        className="w-16 h-16 rounded-full bg-primary text-white flex items-center justify-center shadow-lg hover:bg-primary-600 transition-all duration-200"
        onClick={() => setIsOpen(true)}
        aria-label="Abrir chat"
      >
        {isLoadingWidget ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M21 11.5C21.0034 12.8199 20.6951 14.1219 20.1 15.3C19.3944 16.7118 18.3098 17.8992 16.9674 18.7293C15.6251 19.5594 14.0782 19.9994 12.5 20C11.1801 20.0035 9.87812 19.6951 8.7 19.1L3 21L4.9 15.3C4.30493 14.1219 3.99656 12.8199 4 11.5C4.00061 9.92179 4.44061 8.37488 5.27072 7.03258C6.10083 5.69028 7.28825 4.6056 8.7 3.90003C9.87812 3.30496 11.1801 2.99659 12.5 3.00003H13C15.0843 3.11502 17.053 3.99479 18.5291 5.47089C20.0052 6.94699 20.885 8.91568 21 11V11.5Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    );
  };
  
  // Renderizar o widget
  return (
    <LanguageProvider initialLanguage={currentSession?.language || "pt"}>
      <div className={`fixed ${getPositionClasses()} z-50`}>
        {renderChatButton()}
        
        {isOpen && (
          <div
            className="bg-white rounded-lg shadow-xl overflow-hidden flex flex-col"
            style={{ width: `${width}px`, height: `${height}px` }}
          >
            {/* Cabeçalho */}
            <div className="p-4 bg-primary text-white flex justify-between items-center">
              <div className="flex items-center">
                <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center text-primary mr-2">
                  {widget?.avatar_url ? (
                    <img
                      src={widget.avatar_url}
                      alt={widget.name}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-bold">T</span>
                  )}
                </div>
                <h3 className="font-medium">{widget?.name || "Chat"}</h3>
              </div>
              <button
                className="text-white hover:text-gray-200"
                onClick={() => setIsOpen(false)}
                aria-label="Fechar chat"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M18 6L6 18M6 6L18 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            
            {/* Interface de chat */}
            <div className="flex-grow overflow-hidden">
              {isLoadingWidget || !widget ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <ChatInterface
                  messages={messages}
                  currentSession={currentSession}
                  avatar={{ 
                    image_url: widget.avatar_url,
                    name: widget.name
                  }}
                  isLoading={isLoadingMessages || sendMessageMutation.isPending || uploadFileMutation.isPending}
                  onSendMessage={handleSendMessage}
                  onFileUpload={handleFileUpload}
                  isWidget={true}
                  customTexts={{
                    typeMessage: "Digite sua mensagem...",
                    online: "Online",
                    downloadFile: "Baixar arquivo",
                    messageUnavailable: "Mensagem indisponível",
                    supportedFormats: "Formatos suportados: PNG, JPG, PDF, TXT (máx 50MB)"
                  }}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </LanguageProvider>
  );
}