import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';

// Este componente permite usar URLs externas para imagens no chat
export function ExternalImageChat({ onSend }: { onSend: (imageUrl: string) => void }) {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Função para verificar se a URL é válida
  const isValidImageUrl = (url: string): boolean => {
    const regex = /^(http|https):\/\/[^ "]+$/;
    return regex.test(url);
  };

  // Função para verificar se a imagem carrega corretamente
  const checkImage = (url: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
  };

  // Função para enviar a URL da imagem
  const handleSendImage = async () => {
    // Validar URL
    if (!isValidImageUrl(imageUrl)) {
      toast({
        title: "URL inválida",
        description: "Por favor, insira uma URL válida que comece com http:// ou https://",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    // Verificar se a imagem carrega
    const isValid = await checkImage(imageUrl);
    if (!isValid) {
      toast({
        title: "Imagem inválida",
        description: "Não foi possível carregar a imagem. Verifique se a URL é válida e acessível.",
        variant: "destructive"
      });
      setIsLoading(false);
      return;
    }

    // Enviar a URL da imagem
    onSend(imageUrl);
    setImageUrl('');
    setIsLoading(false);
    
    toast({
      title: "Imagem enviada",
      description: "A URL da imagem foi enviada com sucesso ao chat."
    });
  };

  return (
    <div className="border rounded-md p-4 my-4">
      <h3 className="text-lg font-semibold mb-2">Enviar imagem externa</h3>
      <p className="text-sm text-gray-500 mb-3">
        Use uma URL de imagem externa (deve terminar com .jpg, .jpeg, .png, etc.) para evitar problemas de upload.
      </p>
      
      <div className="flex space-x-2">
        <Input
          placeholder="https://exemplo.com/imagem.png"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          className="flex-1"
        />
        <Button 
          onClick={handleSendImage} 
          disabled={isLoading || !imageUrl}
          className="whitespace-nowrap"
        >
          {isLoading ? 'Verificando...' : 'Enviar imagem'}
        </Button>
      </div>
      
      {imageUrl && (
        <div className="mt-3">
          <p className="text-sm font-semibold mb-1">Pré-visualização:</p>
          <img 
            src={imageUrl} 
            alt="Pré-visualização" 
            className="max-w-full max-h-40 object-contain border rounded"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      )}
    </div>
  );
}