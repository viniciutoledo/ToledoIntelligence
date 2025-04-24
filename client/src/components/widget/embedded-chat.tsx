import React, { useState, useEffect, useRef } from "react";
import { useWidgetChat } from "@/hooks/use-widget-chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, PaperclipIcon, ArrowUp, X, MinusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { I18nextProvider } from 'react-i18next';
import i18n from "@/lib/i18n";

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
  height = 600
}: EmbeddedChatProps) {
  const {
    widget,
    isLoadingWidget,
    messages,
    currentSession,
    isInitialized,
    sendMessageMutation,
    uploadFileMutation,
    createSessionMutation,
    initializeWidget
  } = useWidgetChat();
  
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(initialOpen);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAttaching, setIsAttaching] = useState(false);
  
  const { t, i18n } = useTranslation();
  
  // Inicializar o widget quando o componente for montado
  useEffect(() => {
    initializeWidget(apiKey);
  }, [apiKey, initializeWidget]);
  
  // Scroll para o final das mensagens quando novas mensagens forem adicionadas
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);
  
  // Iniciar uma nova sessão quando o chat for aberto
  useEffect(() => {
    if (isOpen && widget && !currentSession && isInitialized) {
      createSessionMutation.mutate({
        widgetId: widget.id,
        language: i18n.language as "pt" | "en",
        referrerUrl: document.referrer || window.location.href
      });
    }
  }, [isOpen, widget, currentSession, isInitialized, createSessionMutation, i18n.language]);
  
  // Manipuladores de eventos
  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!input.trim() || !currentSession) return;
    
    sendMessageMutation.mutate({
      sessionId: currentSession.id,
      content: input,
      messageType: "text",
      isUser: true
    });
    
    setInput("");
  };
  
  const handleFileUpload = (file: File) => {
    if (!currentSession) return;
    
    // Verificar tipo e tamanho do arquivo
    if (file.size > 10 * 1024 * 1024) { // 10MB
      alert(t("O arquivo deve ter no máximo 10MB"));
      return;
    }
    
    // Tipos permitidos
    const allowedTypes = [
      "image/jpeg", 
      "image/png", 
      "image/gif", 
      "application/pdf", 
      "text/plain", 
      "application/msword", 
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];
    
    if (!allowedTypes.includes(file.type)) {
      alert(t("Tipo de arquivo não suportado"));
      return;
    }
    
    setIsAttaching(true);
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("sessionId", currentSession.id.toString());
    
    uploadFileMutation.mutate(formData, {
      onSettled: () => {
        setIsAttaching(false);
      }
    });
  };
  
  // Notificar a página pai para fechar o widget
  const closeWidget = () => {
    setIsOpen(false);
    window.parent.postMessage("toledoia-widget-close", "*");
  };
  
  if (!isInitialized || isLoadingWidget) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }
  
  if (!widget) {
    return (
      <div className="flex flex-col h-full p-4">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-error mb-2">⚠️ {t("Widget não encontrado")}</p>
            <p className="text-sm text-muted-foreground">{t("A API key fornecida é inválida ou o widget não está ativo.")}</p>
          </div>
        </div>
      </div>
    );
  }
  
  const themeColor = widget.theme_color || "#6366F1";
  
  return (
    <I18nextProvider i18n={i18n}>
      <div 
        className="flex flex-col h-full overflow-hidden bg-background border border-border rounded-lg shadow-lg"
        style={{ width: "100%", height: "100%" }}
      >
        {/* Cabeçalho */}
        <div 
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ backgroundColor: themeColor, color: "#fff" }}
        >
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-white/20 mr-3 overflow-hidden">
              {widget.avatar_url ? (
                <img 
                  src={widget.avatar_url} 
                  alt={widget.name} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  T
                </div>
              )}
            </div>
            <div>
              <h3 className="font-medium text-sm">{widget.name}</h3>
            </div>
          </div>
          <div className="flex">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0 text-white/80 hover:text-white hover:bg-white/10"
              onClick={() => window.parent.postMessage("toledoia-widget-minimize", "*")}
            >
              <MinusIcon className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0 text-white/80 hover:text-white hover:bg-white/10"
              onClick={closeWidget}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* Área de mensagens */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Mensagem de boas-vindas */}
          {messages.length === 0 && (
            <div className="flex items-start mb-4">
              <div 
                className="w-8 h-8 rounded-full mr-2 overflow-hidden flex-shrink-0"
                style={{ backgroundColor: themeColor }}
              >
                {widget.avatar_url ? (
                  <img 
                    src={widget.avatar_url} 
                    alt={widget.name} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white">
                    T
                  </div>
                )}
              </div>
              <div className="bg-primary-50 rounded-lg rounded-tl-none py-2 px-3 max-w-[80%]">
                <p className="text-sm">{widget.greeting || t("Olá! Como posso ajudar?")}</p>
              </div>
            </div>
          )}
          
          {/* Lista de mensagens */}
          {messages.map((message) => (
            <div 
              key={message.id} 
              className={`flex items-start ${message.is_user ? 'justify-end' : ''}`}
            >
              {!message.is_user && (
                <div 
                  className="w-8 h-8 rounded-full mr-2 overflow-hidden flex-shrink-0"
                  style={{ backgroundColor: themeColor }}
                >
                  {widget.avatar_url ? (
                    <img 
                      src={widget.avatar_url} 
                      alt={widget.name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white">
                      T
                    </div>
                  )}
                </div>
              )}
              
              <div 
                className={`py-2 px-3 max-w-[80%] rounded-lg ${
                  message.is_user 
                    ? 'bg-primary text-primary-foreground rounded-br-none ml-auto' 
                    : 'bg-muted rounded-tl-none'
                }`}
              >
                {message.message_type === "text" && (
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                )}
                
                {message.message_type === "image" && message.file_url && (
                  <img 
                    src={message.file_url} 
                    alt={t("Imagem")} 
                    className="max-w-full rounded"
                  />
                )}
                
                {message.message_type === "file" && message.file_url && (
                  <a 
                    href={message.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm flex items-center underline"
                  >
                    <PaperclipIcon className="h-3 w-3 mr-1" />
                    {t("Baixar arquivo")}
                  </a>
                )}
              </div>
            </div>
          ))}
          
          {/* Indicador de carregamento durante a resposta */}
          {sendMessageMutation.isPending && !sendMessageMutation.isIdle && (
            <div className="flex items-start">
              <div 
                className="w-8 h-8 rounded-full mr-2 overflow-hidden flex-shrink-0"
                style={{ backgroundColor: themeColor }}
              >
                {widget.avatar_url ? (
                  <img 
                    src={widget.avatar_url} 
                    alt={widget.name} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white">
                    T
                  </div>
                )}
              </div>
              <div className="bg-muted rounded-lg rounded-tl-none py-2 px-3">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }}></div>
                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }}></div>
                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "600ms" }}></div>
                </div>
              </div>
            </div>
          )}
          
          {/* Elemento para scroll automático */}
          <div ref={messagesEndRef} />
        </div>
        
        {/* Área de entrada */}
        <div className="p-2 border-t">
          <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
            <Button 
              type="button"
              variant="ghost"
              size="icon"
              className="flex-shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => fileInputRef.current?.click()}
              disabled={isAttaching || !currentSession}
            >
              {isAttaching ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <PaperclipIcon className="h-5 w-5" />
              )}
              <span className="sr-only">{t("Anexar arquivo")}</span>
            </Button>
            
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("Digite sua mensagem...")}
              className="flex-1"
              disabled={sendMessageMutation.isPending || !currentSession}
            />
            
            <Button 
              type="submit"
              size="icon"
              className="flex-shrink-0"
              style={{ backgroundColor: themeColor }}
              disabled={sendMessageMutation.isPending || !input.trim() || !currentSession}
            >
              {sendMessageMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ArrowUp className="h-5 w-5" />
              )}
              <span className="sr-only">{t("Enviar mensagem")}</span>
            </Button>
            
            <input 
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileUpload(file);
                  // Limpar o input para permitir selecionar o mesmo arquivo novamente
                  e.target.value = '';
                }
              }}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.txt"
            />
          </form>
          
          <div className="flex justify-center mt-2">
            <p className="text-xs text-muted-foreground">
              Powered by ToledoIA
            </p>
          </div>
        </div>
      </div>
    </I18nextProvider>
  );
}