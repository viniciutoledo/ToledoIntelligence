import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquare, X, Minimize2 } from "lucide-react";
import { useWidgetChat } from "@/hooks/use-widget-chat";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/hooks/use-language";
import { ChatInterface as SharedChatInterface } from "@/components/shared/chat-interface";

interface EmbeddedChatProps {
  apiKey: string;
  initialOpen?: boolean;
}

export function EmbeddedChat({ apiKey, initialOpen = false }: EmbeddedChatProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(initialOpen);
  
  const {
    widget,
    isLoadingWidget,
    currentSession,
    messages,
    isInitialized,
    createSessionMutation,
    endSessionMutation,
    sendMessageMutation,
    uploadFileMutation,
    initializeWidget,
  } = useWidgetChat();
  
  // Status de carregamento
  const isLoading = isLoadingWidget || 
                   createSessionMutation.isPending || 
                   sendMessageMutation.isPending || 
                   uploadFileMutation.isPending;
  
  // Inicializar widget quando o componente é montado (apenas uma vez)
  useEffect(() => {
    if (apiKey && !isInitialized) {
      initializeWidget(apiKey);
    }
  }, [apiKey, isInitialized]);
  
  // Se não houver sessão ativa e o widget estiver carregado, inicie uma sessão
  const sessionCreationAttempted = useRef(false);
  const sessionCreatedRef = useRef(false);
  
  useEffect(() => {
    // Resetar a tentativa se não temos mais uma sessão (foi encerrada)
    if (!currentSession && sessionCreatedRef.current) {
      sessionCreationAttempted.current = false;
      sessionCreatedRef.current = false;
    }
    
    // Verificar se temos widget mas não temos sessão ativa para criar uma nova
    if (widget && !currentSession && !createSessionMutation.isPending && isInitialized && !sessionCreationAttempted.current) {
      // Marcar que já tentamos criar uma sessão para evitar futuras tentativas
      sessionCreationAttempted.current = true;
      
      console.log("Iniciando nova sessão para o widget", widget.id);
      
      // Criar a sessão
      createSessionMutation.mutate({
        widgetId: widget.id,
        language: language as "pt" | "en",
        referrerUrl: document.referrer || window.location.href
      });
    }
    
    // Marcar que temos uma sessão quando ela é criada
    if (currentSession) {
      sessionCreatedRef.current = true;
    }
  }, [widget, currentSession, isInitialized]); // Evitar loops mantendo apenas dependências essenciais
  
  // Finalizar sessão quando componente for desmontado
  useEffect(() => {
    return () => {
      if (currentSession && !currentSession.ended_at) {
        // Usando o objeto mutation diretamente sem dependência
        if (endSessionMutation && typeof endSessionMutation.mutate === 'function') {
          try {
            endSessionMutation.mutate(currentSession.id);
          } catch (error) {
            console.error("Erro ao finalizar sessão:", error);
          }
        }
      }
    };
  }, [currentSession]);
  
  // Handler para enviar mensagens
  const handleSendMessage = (content: string) => {
    if (!currentSession) return;
    
    sendMessageMutation.mutate({
      sessionId: currentSession.id,
      content,
      isUser: true
    });
  };
  
  // Handler para upload de arquivos
  const handleFileUpload = (file: File) => {
    if (!currentSession) return;
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("session_id", currentSession.id.toString());
    
    uploadFileMutation.mutate(formData);
  };
  
  // Função para enviar mensagem para a página pai para minimizar/fechar o widget
  const handleMinimize = () => {
    setIsOpen(false);
    if (window.parent && window.parent !== window) {
      window.parent.postMessage("toledoia-widget-minimize", "*");
    }
  };
  
  // Função para enviar mensagem para a página pai para fechar o widget
  const handleClose = () => {
    setIsOpen(false);
    if (window.parent && window.parent !== window) {
      window.parent.postMessage("toledoia-widget-close", "*");
    }
  };
  
  // Botão de chat (quando está minimizado)
  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 rounded-full h-14 w-14 p-0 flex items-center justify-center"
        style={{ backgroundColor: widget?.theme_color || "#6366F1" }}
      >
        <MessageSquare size={24} />
      </Button>
    );
  }
  
  // Loading state
  if (!isInitialized || isLoadingWidget) {
    return (
      <div className="fixed bottom-4 right-4 h-[500px] w-[350px] rounded-lg bg-card border shadow-xl flex flex-col">
        <div className="flex items-center justify-center h-full">
          <Loader2 className="animate-spin h-8 w-8 text-primary" />
        </div>
      </div>
    );
  }
  
  // Widget not found state
  if (!widget) {
    return (
      <div className="fixed bottom-4 right-4 h-[500px] w-[350px] rounded-lg bg-card border shadow-xl flex flex-col">
        <div className="flex items-center justify-center h-full p-4 text-center">
          <div>
            <h3 className="font-semibold text-lg mb-2">
              {t("widget.notFound")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("widget.invalidKey")}
            </p>
            <Button onClick={handleClose} className="mt-4">
              {t("common.close")}
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  // Container
  const containerStyles = {
    position: window.parent && window.parent !== window ? "absolute" : "fixed",
    bottom: window.parent && window.parent !== window ? 0 : "1rem",
    right: window.parent && window.parent !== window ? 0 : "1rem",
    height: window.parent && window.parent !== window ? "100%" : "500px",
    width: window.parent && window.parent !== window ? "100%" : "350px",
  } as React.CSSProperties;
  
  // Format widget data for chat component
  const chatAvatar = {
    image_url: widget.avatar_url && widget.avatar_url.startsWith('/') 
      ? `${window.location.origin}${widget.avatar_url}` 
      : widget.avatar_url,
    name: widget.name
  };
  
  // Textos customizados
  const customTexts = {
    typeMessage: t("widget.typeMessage", "Digite sua mensagem..."),
    online: t("widget.online", "Online"),
    downloadFile: t("widget.downloadFile", "Baixar arquivo"),
    messageUnavailable: t("widget.messageUnavailable", "Conteúdo não disponível"),
    supportedFormats: t("widget.supportedFormats", "Formatos suportados: PNG, JPG, PDF (máx 50MB)")
  };
  
  return (
    <div 
      className="rounded-lg bg-card border shadow-xl overflow-hidden flex flex-col"
      style={containerStyles}
    >
      {/* Header */}
      <div 
        className="p-3 flex items-center justify-between border-b"
        style={{ backgroundColor: widget.theme_color || "#6366F1", color: "white" }}
      >
        <div className="flex items-center">
          <div className="h-8 w-8 rounded-full flex-shrink-0 overflow-hidden">
            {widget.avatar_url ? (
              <img 
                src={widget.avatar_url.startsWith('/') ? `${window.location.origin}${widget.avatar_url}` : widget.avatar_url} 
                alt={widget.name} 
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full bg-primary-100 flex items-center justify-center text-primary-600">
                <span className="text-sm font-bold">T</span>
              </div>
            )}
          </div>
          <div className="ml-2">
            <p className="font-medium text-sm text-white">{widget.name}</p>
          </div>
        </div>
        <div className="flex space-x-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleMinimize}
            className="hover:bg-white/20 text-white"
          >
            <Minimize2 size={18} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="hover:bg-white/20 text-white"
          >
            <X size={18} />
          </Button>
        </div>
      </div>
      
      {/* Chat Content */}
      <div className="flex-1 overflow-hidden">
        <SharedChatInterface
          messages={messages}
          currentSession={currentSession}
          avatar={chatAvatar}
          isWidget={true}
          isLoading={isLoading}
          onSendMessage={handleSendMessage}
          onFileUpload={handleFileUpload}
          customTexts={customTexts}
        />
      </div>
    </div>
  );
}