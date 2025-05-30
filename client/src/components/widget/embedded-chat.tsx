import React, { useEffect, useState, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquare, X, Minimize2 } from "lucide-react";
import { useWidgetChat } from "@/hooks/use-widget-chat";
import { useTranslation } from "react-i18next";
import { useLanguage } from "@/hooks/use-language";
import { ChatInterface as SharedChatInterface } from "@/components/shared/chat-interface";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useTheme } from "next-themes";

// Função utilitária para otimizar URLs de arquivos
function getOptimizedFileUrl(fileUrl: string | null): string {
  if (!fileUrl) return "";
  
  try {
    // Limpa caracteres invisíveis ou especiais que possam estar causando problemas
    const cleanUrl = fileUrl.replace(/[\u200B-\u200D\uFEFF\u0000-\u001F\u007F-\u009F]/g, '');
    
    // Se a URL já começa com http(s), retorna como está
    if (cleanUrl.startsWith('http')) return cleanUrl;
    
    // Se a URL começa com /, adiciona a origem
    if (cleanUrl.startsWith('/')) return `${window.location.origin}${cleanUrl}`;
    
    // Se não começa com / nem com http, adiciona / no início
    return `/${cleanUrl}`;
  } catch (error) {
    console.error("Erro ao processar URL do arquivo:", error);
    return fileUrl || ""; // Retorna a URL original em caso de erro
  }
}

interface EmbeddedChatProps {
  apiKey: string;
  initialOpen?: boolean;
  hideHeader?: boolean;
  fullHeight?: boolean;
}

export function EmbeddedChat({ apiKey, initialOpen = false, hideHeader = false, fullHeight = false }: EmbeddedChatProps) {
  const { theme } = useTheme();
  // Tipagem do widget para uso na função
  type WidgetType = {
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
    hide_minimize_button?: boolean;
    hide_close_button?: boolean;
    default_height?: string;
    default_width?: string;
    custom_css?: string;
    background_color?: string;
    font_size?: string;
    font_color?: string;
    bot_message_bg_color?: string;
    user_message_bg_color?: string;
  };
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(initialOpen);
  
  const {
    widget,
    isLoadingWidget,
    currentSession,
    messages,
    isInitialized,
    isProcessingLlm,
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
    // Tentar obter a API key de window.name se não foi passada como prop
    // Isso é uma alternativa para casos onde o postMessage falha
    const tryExtractApiKeyFromWindowName = () => {
      try {
        if (window.name && window.name.startsWith('apiKey=')) {
          return window.name.substring(7);
        }
      } catch (e) {
        console.error('Erro ao ler window.name:', e);
      }
      return null;
    };

    // Configurar receptor de mensagens do pai para receber a chave API
    const messageHandler = (event: MessageEvent) => {
      if (event.data && typeof event.data === 'object' && event.data.type === 'PROVIDE_API_KEY') {
        console.log('Recebido API key via postMessage');
        if (event.data.apiKey && !isInitialized) {
          initializeWidget(event.data.apiKey);
        }
      }
    };
    
    window.addEventListener('message', messageHandler);
    
    // Solicitar a chave API do pai se necessário
    if (window.parent && window.parent !== window) {
      console.log('Solicitando API key do pai');
      window.parent.postMessage({ type: 'REQUEST_API_KEY' }, '*');
    }
    
    // Se temos a chave API via props, usamos ela
    if (apiKey && !isInitialized) {
      console.log('Inicializando widget com API key fornecida via props');
      initializeWidget(apiKey);
    } 
    // Tentar extrair do nome da janela como backup
    else if (!isInitialized) {
      const extractedApiKey = tryExtractApiKeyFromWindowName();
      if (extractedApiKey) {
        console.log('Inicializando widget com API key extraída de window.name');
        initializeWidget(extractedApiKey);
      }
    }
    
    return () => {
      window.removeEventListener('message', messageHandler);
    };
  }, [apiKey, isInitialized, initializeWidget]);
  
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
  // Desativada a pedido do cliente
  const handleMinimize = () => {
    // Não faz nada - opção de minimizar removida
    console.log('Minimize option disabled');
  };
  
  // Função para enviar mensagem para a página pai para fechar o widget
  const handleClose = () => {
    setIsOpen(false);
    if (window.parent && window.parent !== window) {
      window.parent.postMessage("toledoia-widget-close", "*");
    }
  };
  
  // Widget sempre ficará aberto, não terá mais opção de minimizar
  // Iniciamos sempre com isOpen = true e não permitimos minimizar
  useEffect(() => {
    setIsOpen(true);
  }, []); // Executa apenas na montagem do componente
  
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
  
  // Detectar se estamos dentro de um iframe
  // Usando uma variável para guardar o resultado em vez de useMemo
  // para evitar erros de renderização de hooks
  const isInIframe = (() => {
    if (typeof window === 'undefined') return false;
    
    try {
      return window.self !== window.top;
    } catch (e) {
      // Se houver erro de segurança de cross-origin, provavelmente estamos em um iframe
      return true;
    }
  })();
  
  // Removendo completamente o CSS personalizado para tentar corrigir o problema
  // O CSS será adicionado diretamente na página em uma versão futura
  // Isso evita problemas com hooks e renderização condicional que estão causando o erro
  
  // Container
  const containerStyles = {
    position: isInIframe || fullHeight ? "absolute" : "fixed",
    bottom: isInIframe || fullHeight ? 0 : "1rem",
    right: isInIframe || fullHeight ? 0 : "1rem",
    height: isInIframe || fullHeight ? "100%" : (widget?.default_height ? `${widget.default_height}px` : "500px"),
    width: isInIframe || fullHeight ? "100%" : (widget?.default_width ? `${widget.default_width}px` : "350px"),
    backgroundColor: theme === "dark" ? "#121212" : (widget?.background_color || "#FFFFFF"),
    color: theme === "dark" ? "#FFFFFF" : (widget?.font_color || "#000000"),
    fontSize: widget?.font_size || "14px", // Tamanho padrão
  } as React.CSSProperties;
  
  // Format widget data for chat component
  const chatAvatar = widget ? {
    image_url: widget.avatar_url ? getOptimizedFileUrl(widget.avatar_url) : undefined,
    name: widget.name
  } : { name: "ToledoIA" };
  
  // Textos customizados
  const customTexts = {
    typeMessage: t("widget.typeMessage", "Digite sua mensagem..."),
    online: t("widget.online", "Online"),
    downloadFile: t("widget.downloadFile", "Baixar arquivo"),
    messageUnavailable: t("widget.messageUnavailable", "Conteúdo não disponível"),
    supportedFormats: t("widget.supportedFormats", "Formatos suportados: PNG, JPG, PDF (máx 50MB)")
  };
  
  // Obtendo os parâmetros da URL e calculando se o header deve ser ocultado - tudo de uma vez para evitar problemas com hooks
  const shouldHideHeader = (() => {
    // Se prop hideHeader é true, já retornamos true
    if (hideHeader) return true;
    
    // Caso contrário, verificamos o parâmetro na URL
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('hideHeader') === 'true';
    } catch (e) {
      return false;
    }
  })();

  // Funcionalidade de CSS personalizado temporariamente removida

  return (
    <div 
      className={`rounded-lg bg-card border shadow-xl overflow-hidden flex flex-col embedded-chat-container ${fullHeight ? 'full-height-embed' : ''}`}
      style={containerStyles}
    >
      {/* Header - só exibe se não estiver configurado para ocultar e se o widget existir */}
      {!shouldHideHeader && widget && (
        <div 
          className="p-3 flex items-center justify-between border-b"
          style={{ 
            backgroundColor: theme === "dark" ? "#1A1A1A" : (widget.theme_color || "#5B58F0"), 
            color: theme === "dark" ? "#FFFFFF" : "white" 
          }}
        >
          <div className="flex items-center">
            <div className="h-8 w-8 rounded-full flex-shrink-0 overflow-hidden">
              {widget.avatar_url ? (
                <img 
                  src={getOptimizedFileUrl(widget.avatar_url)} 
                  alt={widget.name} 
                  loading="lazy"
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
            {/* Botão de mudança de tema */}
            <ThemeToggle />
            
            {/* Botão de minimizar desativado a pedido do cliente */}
            {/* Botão de fechar apenas quando não está configurado para ocultar */}
            {!widget.hide_close_button && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="hover:bg-white/20 text-white"
              >
                <X size={18} />
              </Button>
            )}
          </div>
        </div>
      )}
      
      {/* Chat Content */}
      <div className="flex-1 overflow-hidden chat-content-wrapper">
        <SharedChatInterface
          messages={messages}
          currentSession={currentSession}
          avatar={chatAvatar}
          isWidget={true}
          isLoading={isLoading}
          isProcessingLlm={isProcessingLlm}
          onSendMessage={handleSendMessage}
          onFileUpload={handleFileUpload}
          customStyles={{
            backgroundColor: theme === "dark" ? "#121212" : (widget?.background_color || "#FFFFFF"),
            fontColor: theme === "dark" ? "#FFFFFF" : (widget?.font_color || "#000000"),
            fontSize: widget?.font_size || "16px", // Aumentando tamanho padrão para 16px
            botMessageBgColor: theme === "dark" ? "#2A2A2A" : (widget?.bot_message_bg_color || "#F2EFE5"),
            userMessageBgColor: theme === "dark" ? "#2A2A2A" : (widget?.user_message_bg_color || "#F2EFE5")
          }}
          customTexts={customTexts}
        />
      </div>
      
      {/* Footer para iframe embedded */}
      {fullHeight && (
        <div className="embedded-chat-footer text-center text-xs p-1 text-muted-foreground bg-muted/50">
          Powered by ToledoIA
        </div>
      )}
    </div>
  );
}