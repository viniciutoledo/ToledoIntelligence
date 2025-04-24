import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/hooks/use-language";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Paperclip, Image, Send, Loader2, X } from "lucide-react";
import { SimpleImage } from "./simple-image";

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

// Tipos compartilhados
interface ChatMessage {
  id: number;
  session_id: number;
  message_type: "text" | "image" | "file";
  content: string | null;
  file_url: string | null;
  created_at: string;
  is_user: boolean;
  fileBase64?: string; // Adicionado para suporte a fallback base64
}

interface ChatAvatar {
  image_url?: string;
  name?: string;
}

interface ChatInterfaceProps {
  // Dados
  messages: ChatMessage[];
  currentSession: { id: number } | null;
  avatar?: ChatAvatar;
  isWidget?: boolean;
  
  // Status
  isLoading: boolean;
  isProcessingLlm?: boolean;
  
  // Callbacks
  onSendMessage: (content: string) => void;
  onFileUpload: (file: File) => void;
  
  // Traduções customizadas (opcionais)
  customTexts?: {
    typeMessage?: string;
    online?: string;
    downloadFile?: string;
    messageUnavailable?: string;
    supportedFormats?: string;
  }
}

// Componente de Usuário (reutilizado do original)
function User(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function ChatInterface({
  messages = [],
  currentSession,
  avatar,
  isWidget = false,
  isLoading = false,
  isProcessingLlm = false,
  onSendMessage,
  onFileUpload,
  customTexts = {}
}: ChatInterfaceProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  
  const [message, setMessage] = useState("");
  const [fileSelected, setFileSelected] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Textos da interface
  const texts = {
    typeMessage: customTexts.typeMessage || t("technician.typeMessage"),
    online: customTexts.online || t("technician.online"),
    downloadFile: customTexts.downloadFile || t("technician.downloadFile"),
    messageUnavailable: customTexts.messageUnavailable || t("technician.messageUnavailable"),
    supportedFormats: customTexts.supportedFormats || "Formatos suportados: PNG, JPG, PDF, TXT (máx 50MB)"
  };
  
  // Scroll para o último mensagem quando novos mensagens são adicionados
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !currentSession) return;
    
    const file = e.target.files[0];
    if (!file) {
      setFileSelected(false);
      setSelectedFile(null);
      return;
    }
    
    // Verificar tamanho do arquivo (máximo 50MB)
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB em bytes
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: t("common.error"),
        description: t("technician.fileTooLarge"),
        variant: "destructive",
      });
      
      // Limpar seleção
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    
    setFileSelected(true);
    setSelectedFile(file);
  };
  
  const handleSendMessage = () => {
    if ((!message.trim() && !selectedFile) || !currentSession) return;
    
    if (selectedFile) {
      onFileUpload(selectedFile);
      
      // Limpar arquivo selecionado após envio
      setSelectedFile(null);
      setFileSelected(false);
      
      // Reset do input de arquivo
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
    
    if (message.trim()) {
      onSendMessage(message);
      setMessage("");
    }
  };
  
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className={`flex flex-col ${isWidget ? 'h-full' : 'h-[80vh]'}`}>
      {/* Chat Header */}
      <div className="px-4 py-3 border-b flex items-center">
        <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 mr-3">
          {avatar?.image_url ? (
            <SimpleImage
              src={avatar.image_url}
              alt={avatar.name || "Avatar"}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600">
              <span className="text-lg font-bold">T</span>
            </div>
          )}
        </div>
        <div>
          <h3 className="font-medium text-neutral-800">
            {avatar?.name || "ToledoIA"}
          </h3>
          <p className="text-xs text-neutral-500">{texts.online}</p>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-grow p-4 overflow-y-auto space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            data-message-id={msg.id}
            className={`flex items-start ${
              msg.is_user ? "flex-row-reverse" : ""
            }`}
          >
            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
              msg.is_user 
                ? "bg-neutral-300 text-neutral-600 ml-2 mt-1" 
                : "bg-primary-100 text-primary-600 mr-2 mt-1"
            }`}>
              {msg.is_user ? (
                <User className="h-4 w-4" />
              ) : (
                avatar?.image_url ? (
                  <SimpleImage
                    src={avatar.image_url}
                    alt={avatar.name || "Avatar"}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-bold">T</span>
                )
              )}
            </div>
            
            <div className={`py-2 px-3 max-w-[80%] ${
              msg.is_user 
                ? "bg-primary text-white rounded-lg rounded-tr-none" 
                : "bg-neutral-100 text-neutral-800 rounded-lg rounded-tl-none"
            }`}>
              {msg.message_type === "text" ? (
                <p className="text-sm">{msg.content}</p>
              ) : msg.message_type === "image" ? (
                <div>
                  <div className="flex items-center mb-2">
                    <Image className="h-4 w-4 mr-2" />
                    <span className="text-sm">{msg.content || "Imagem"}</span>
                  </div>
                  <div className="image-container relative">
                    {(msg.file_url || msg.fileBase64) ? (
                      <div className="image-wrapper relative">
                        {/* Usando componente SimpleImage para melhor exibição das imagens */}
                        <SimpleImage 
                          src={msg.file_url}
                          alt="Imagem enviada" 
                          className="rounded-md max-h-60 max-w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="p-4 bg-gray-100 rounded text-gray-500 text-sm">
                        {texts.messageUnavailable}
                      </div>
                    )}
                  </div>
                  {msg.file_url && !msg.file_url.startsWith('blob:') && (
                    <a 
                      href={getOptimizedFileUrl(msg.file_url)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-xs text-primary hover:underline"
                    >
                      {texts.downloadFile}
                    </a>
                  )}
                </div>
              ) : msg.message_type === "file" && msg.file_url ? (
                <div>
                  <div className="flex items-center">
                    <Paperclip className="h-4 w-4 mr-2" />
                    <span className="text-sm">{msg.content || "Arquivo"}</span>
                  </div>
                  <a 
                    href={getOptimizedFileUrl(msg.file_url)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs text-primary hover:underline"
                  >
                    {texts.downloadFile}
                  </a>
                </div>
              ) : (
                <p className="text-sm text-neutral-500">{texts.messageUnavailable}</p>
              )}
            </div>
          </div>
        ))}
        
        {/* Indicador de digitação - Três pontos animados */}
        {isProcessingLlm && (
          <div className="flex items-start">
            <div className="h-8 w-8 rounded-full flex items-center justify-center bg-primary-100 text-primary-600 mr-2 mt-1">
              {avatar?.image_url ? (
                <SimpleImage
                  src={avatar.image_url}
                  alt={avatar.name || "Avatar"}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <span className="text-sm font-bold">T</span>
              )}
            </div>
            <div className="py-2 px-3 bg-neutral-100 text-neutral-800 rounded-lg rounded-tl-none">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className="p-4 border-t">
        <div className="flex items-center">
          <div className="relative">
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileUpload}
              accept=".pdf,.txt,.png,.jpg,.jpeg,.gif"
            />
            <Button 
              variant="ghost" 
              size="icon" 
              type="button"
              className="p-2 rounded-full text-neutral-500 hover:text-primary hover:bg-primary-50"
              onClick={() => fileInputRef.current?.click()}
              disabled={!currentSession || isLoading}
              title={t("technician.uploadFileOrImage")}
            >
              {isLoading && fileSelected ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Paperclip className="h-5 w-5" />
              )}
            </Button>
          </div>
          
          <Input
            placeholder={texts.typeMessage}
            className="flex-grow mx-2 py-2 px-3 border rounded-full focus:outline-none focus:ring-2 focus:ring-primary"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={!currentSession || isLoading}
          />
          
          <Button
            type="button"
            size="icon"
            className="p-2 rounded-full bg-primary text-white hover:bg-primary-600"
            onClick={handleSendMessage}
            disabled={(!message.trim() && !selectedFile) || !currentSession || isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
        
        {selectedFile && (
          <div className="mt-2 ml-1 text-xs bg-primary-50 p-2 rounded-md flex items-center justify-between">
            <div className="flex items-center">
              <Paperclip className="h-3 w-3 mr-1 text-primary" />
              <span className="text-neutral-700">{selectedFile.name}</span>
            </div>
            <button 
              onClick={() => {
                setSelectedFile(null);
                setFileSelected(false);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="ml-2 p-1 hover:bg-red-100 rounded-full"
              title={t("common.cancel")}
            >
              <X className="h-3 w-3 text-red-500" />
            </button>
          </div>
        )}
        
        <div className="text-xs text-neutral-500 mt-2 ml-1">
          {texts.supportedFormats}
        </div>
      </div>
    </div>
  );
}