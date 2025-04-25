import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Paperclip, Image as ImageIcon, X } from 'lucide-react';

// Esta é uma variação do componente de imagem externa para integrar com o chat existente
export function ExternalImageInput({
  onSendImage,
  className = "",
}: {
  onSendImage: (url: string) => void;
  className?: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  // Validar a URL da imagem
  const validateImageUrl = useCallback(async (url: string): Promise<boolean> => {
    // Verificar formato básico da URL
    if (!url || !url.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i)) {
      toast({
        title: "URL inválida",
        description: "A URL deve apontar para uma imagem (JPG, PNG, GIF, WebP)",
        variant: "destructive"
      });
      return false;
    }

    // Testar se a imagem carrega
    try {
      setIsValidating(true);
      return await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
        // Definir timeout para não travar a interface
        setTimeout(() => resolve(false), 5000);
      });
    } catch (error) {
      return false;
    } finally {
      setIsValidating(false);
    }
  }, []);

  // Enviar a URL da imagem
  const handleSend = useCallback(async () => {
    const isValid = await validateImageUrl(imageUrl);
    
    if (!isValid) {
      toast({
        title: "Imagem não carregada",
        description: "Não foi possível verificar a imagem. Verifique a URL e tente novamente.",
        variant: "destructive"
      });
      return;
    }

    onSendImage(imageUrl);
    setImageUrl('');
    setIsExpanded(false);
    
    toast({
      description: "Imagem externa enviada com sucesso!"
    });
  }, [imageUrl, onSendImage, validateImageUrl]);

  // Cancelar o envio
  const handleCancel = useCallback(() => {
    setImageUrl('');
    setIsExpanded(false);
  }, []);

  // Alternar o painel de entrada de URL
  const toggleUrlInput = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  return (
    <div className={`${className}`}>
      {!isExpanded ? (
        <Button
          variant="ghost"
          size="icon"
          title="Enviar imagem externa (URL)"
          onClick={toggleUrlInput}
          className="text-muted-foreground hover:text-foreground"
        >
          <ImageIcon className="h-5 w-5" />
        </Button>
      ) : (
        <div className="flex flex-col w-full bg-muted/20 p-2 rounded-md space-y-2">
          <div className="flex items-center space-x-2">
            <Input
              placeholder="https://exemplo.com/imagem.jpg"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="flex-1 text-sm"
              disabled={isValidating}
            />
            <Button
              size="sm"
              variant="default"
              disabled={!imageUrl || isValidating}
              onClick={handleSend}
            >
              {isValidating ? 'Verificando...' : 'Enviar'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancel}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {imageUrl && (
            <div className="relative w-full max-h-40 overflow-hidden rounded border bg-background">
              <img
                src={imageUrl}
                alt="Pré-visualização"
                className="max-w-full max-h-40 mx-auto object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          )}
          
          <p className="text-xs text-muted-foreground">
            Dica: Use esta opção para enviar imagens hospedadas externamente e evitar problemas de upload.
          </p>
        </div>
      )}
    </div>
  );
}