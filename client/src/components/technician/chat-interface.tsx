import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/hooks/use-language";
import { useChat } from "@/hooks/use-chat";
import { useAvatar } from "@/hooks/use-avatar";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Paperclip, Image, Send, Loader2 } from "lucide-react";
import { format } from "date-fns";

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
  
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  
  // Create a new session when component mounts if none exists
  useEffect(() => {
    if (!currentSession && !createSessionMutation.isPending) {
      createSessionMutation.mutate(user?.language);
    }
  }, [currentSession, createSessionMutation, user]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  
  const handleSendMessage = () => {
    if (!message.trim() || !currentSession) return;
    
    sendMessageMutation.mutate({
      sessionId: currentSession.id,
      content: message,
    });
    
    setMessage("");
  };
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !currentSession) return;
    
    const file = e.target.files[0];
    if (!file) return;
    
    console.log("Enviando arquivo:", file.name, file.type, file.size);
    
    uploadFileMutation.mutate({
      sessionId: currentSession.id,
      file,
    });
    
    // Reset the file input
    e.target.value = "";
  };
  
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Loading state
  if (createSessionMutation.isPending) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-neutral-600">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[80vh]">
      {/* Chat Header */}
      <div className="px-4 py-3 border-b flex items-center">
        <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 mr-3">
          {avatar?.image_url ? (
            <img
              src={avatar.image_url}
              alt={avatar.name}
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
            {avatar?.name || (user?.language === "pt" ? "Bot ToledoIA" : "ToledoIA Bot")}
          </h3>
          <p className="text-xs text-neutral-500">{t("technician.online")}</p>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-grow p-4 overflow-y-auto space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
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
                  <img
                    src={avatar.image_url}
                    alt={avatar.name}
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
              ) : msg.message_type === "image" && msg.file_url ? (
                <div>
                  <div className="flex items-center mb-2">
                    <Image className="h-4 w-4 mr-2" />
                    <span className="text-sm">{msg.content || "Imagem"}</span>
                  </div>
                  <img
                    src={msg.file_url}
                    alt="Uploaded file"
                    className="rounded-md max-h-48 w-auto"
                  />
                </div>
              ) : msg.message_type === "file" && msg.file_url ? (
                <div>
                  <div className="flex items-center">
                    <Paperclip className="h-4 w-4 mr-2" />
                    <span className="text-sm">{msg.content || "Arquivo"}</span>
                  </div>
                  <a 
                    href={msg.file_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs text-primary hover:underline"
                  >
                    {t("technician.downloadFile")}
                  </a>
                </div>
              ) : (
                <p className="text-sm text-neutral-500">{t("technician.messageUnavailable")}</p>
              )}
            </div>
          </div>
        ))}
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
              accept=".pdf,.txt"
            />
            <Button 
              variant="ghost" 
              size="icon" 
              type="button"
              className="p-2 rounded-full text-neutral-500 hover:text-primary hover:bg-primary-50"
              onClick={() => fileInputRef.current?.click()}
              disabled={!currentSession || isLoading}
            >
              {uploadFileMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Paperclip className="h-5 w-5" />
              )}
            </Button>
          </div>
          
          <div className="relative ml-1">
            <input 
              type="file" 
              ref={imageInputRef} 
              className="hidden" 
              onChange={handleFileUpload}
              accept=".png,.jpg,.jpeg"
            />
            <Button 
              variant="ghost" 
              size="icon" 
              type="button"
              className="p-2 rounded-full text-neutral-500 hover:text-primary hover:bg-primary-50"
              onClick={() => imageInputRef.current?.click()}
              disabled={!currentSession || isLoading}
            >
              {uploadFileMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Image className="h-5 w-5" />
              )}
            </Button>
          </div>
          
          <Input
            placeholder={t("technician.typeMessage")}
            className="flex-grow mx-2 py-2 px-3 border rounded-full focus:outline-none focus:ring-2 focus:ring-primary"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={!currentSession || sendMessageMutation.isPending}
          />
          
          <Button
            type="button"
            size="icon"
            className="p-2 rounded-full bg-primary text-white hover:bg-primary-600"
            onClick={handleSendMessage}
            disabled={!message.trim() || !currentSession || isLoading}
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
        <div className="text-xs text-neutral-500 mt-2 ml-1">
          {t("technician.supportedFormats")}
        </div>
      </div>
    </div>
  );
}

// Import missing icons
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
