import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Image } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";

interface ExternalImageInputProps {
  onSendImage: (imageUrl: string) => void;
}

export function ExternalImageInput({ onSendImage }: ExternalImageInputProps) {
  const [showInput, setShowInput] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const { toast } = useToast();
  const { t } = useLanguage();

  const handleSubmit = () => {
    if (!imageUrl || !imageUrl.trim()) {
      toast({
        title: t("common.error"),
        description: t("technician.enterValidUrl"),
        variant: "destructive",
      });
      return;
    }

    // Validar a URL (verificação básica se está formatada como uma URL)
    try {
      new URL(imageUrl);
    } catch (e) {
      toast({
        title: t("common.error"),
        description: t("technician.invalidUrl"),
        variant: "destructive",
      });
      return;
    }

    // Verificar extensão da imagem para filtrar só URLs de imagem
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    const hasImageExtension = imageExtensions.some(ext => 
      imageUrl.toLowerCase().endsWith(ext) || 
      imageUrl.toLowerCase().includes(`${ext}?`) || 
      imageUrl.toLowerCase().includes(`${ext}&`)
    );

    if (!hasImageExtension) {
      toast({
        title: t("common.error"),
        description: t("technician.urlMustBeImage"),
        variant: "destructive",
      });
      return;
    }

    // Enviar a URL da imagem
    onSendImage(imageUrl);
    
    // Limpar e esconder o input após enviar
    setImageUrl("");
    setShowInput(false);
  };

  return (
    <div className="relative">
      <Button 
        variant="ghost" 
        size="icon" 
        type="button"
        className="p-2 rounded-full text-neutral-500 hover:text-primary hover:bg-primary-50"
        onClick={() => setShowInput(!showInput)}
        title="Enviar imagem externa"
      >
        <Image className="h-5 w-5" />
      </Button>
      
      {showInput && (
        <div className="absolute left-0 bottom-full mb-2 p-2 bg-white shadow-lg rounded-md border z-10 w-72">
          <p className="text-xs text-gray-600 mb-2">Cole a URL de uma imagem online:</p>
          <div className="flex">
            <input
              type="text"
              className="flex-grow p-2 border text-sm rounded-l-md"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://exemplo.com/imagem.jpg"
            />
            <button
              className="bg-primary text-white p-2 rounded-r-md text-sm"
              onClick={handleSubmit}
            >
              Enviar
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            URLs de imagens devem terminar com .jpg, .png, .gif, etc.
          </p>
        </div>
      )}
    </div>
  );
}