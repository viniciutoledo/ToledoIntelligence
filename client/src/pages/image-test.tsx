import React, { useState } from 'react';
import { TestImage } from '@/components/shared/test-image';
import { UltimateImage } from '@/components/shared/ultimate-image';
import { ExternalImageChat } from '@/components/shared/external-image-chat';

// Esta página permitirá isolar e testar os problemas de exibição de imagens
export default function ImageTestPage() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageAsBase64, setImageAsBase64] = useState<string | null>(null);
  const [testUrl, setTestUrl] = useState<string>('');
  
  // Manipulador para converter a imagem selecionada para base64
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Converter para base64
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setImageAsBase64(base64);
    };
    reader.readAsDataURL(file);
  };
  
  // Manipulador para testar a exibição de uma URL
  const handleUrlTest = () => {
    if (testUrl.trim()) {
      setSelectedImage(testUrl);
    }
  };
  
  // Gera uma imagem de teste com apenas um pixel em PNG
  const generateTestPng = () => {
    // Criar um canvas de 1x1 pixel
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    
    // Desenhar um pixel vermelho
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'red';
      ctx.fillRect(0, 0, 1, 1);
      
      // Converter para data URL (PNG)
      const dataUrl = canvas.toDataURL('image/png');
      setSelectedImage(dataUrl);
      console.log('Imagem de teste gerada:', dataUrl.substring(0, 50) + '...');
    }
  };
  
  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Página de Teste de Imagens</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Seção 1: Imagem estática de teste */}
        <div className="border p-4 rounded">
          <h2 className="text-xl font-semibold mb-4">1. Teste de Imagem Estática</h2>
          <TestImage src="https://placehold.co/400x300?text=Imagem+de+Teste" />
        </div>
        
        {/* Seção 2: Teste com UltimateImage */}
        <div className="border p-4 rounded">
          <h2 className="text-xl font-semibold mb-4">2. Teste com UltimateImage</h2>
          <p className="text-sm mb-2">Selecione uma imagem para testar:</p>
          
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleImageSelect}
            className="block w-full text-sm mb-4"
          />
          
          <div className="mb-4">
            <input 
              type="text" 
              placeholder="Ou digite uma URL de imagem" 
              className="p-2 border rounded w-full mb-2"
              value={testUrl}
              onChange={(e) => setTestUrl(e.target.value)}
            />
            <button 
              onClick={handleUrlTest}
              className="bg-blue-500 text-white px-4 py-2 rounded"
            >
              Testar URL
            </button>
          </div>
          
          <button 
            onClick={generateTestPng}
            className="bg-green-500 text-white px-4 py-2 rounded mb-4"
          >
            Gerar Pixel PNG de Teste
          </button>
          
          <div className="border p-2 rounded">
            {imageAsBase64 && (
              <div className="mb-4">
                <p className="text-sm font-semibold mb-1">Imagem carregada como Base64:</p>
                <UltimateImage src={imageAsBase64} />
              </div>
            )}
            
            {selectedImage && (
              <div>
                <p className="text-sm font-semibold mb-1">Imagem selecionada:</p>
                <UltimateImage src={selectedImage} />
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Seção 3: Alternativa para chat */}
      <div className="mt-6 p-4 border rounded">
        <h2 className="text-xl font-semibold mb-4">3. Solução Alternativa para Chat</h2>
        <p className="text-sm mb-4">
          Como o upload direto no chat não está funcionando, use esta abordagem para enviar imagens externas:
        </p>
        
        <ExternalImageChat 
          onSend={(url) => {
            // Em uma implementação real, este manipulador enviaria a URL para o chat
            console.log("URL da imagem enviada para o chat:", url);
            // Para demonstração, exibimos a imagem
            setSelectedImage(url);
          }} 
        />
        
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded">
          <h3 className="text-amber-800 font-medium">Como usar:</h3>
          <ol className="list-decimal ml-5 text-sm text-amber-700 space-y-1 mt-2">
            <li>Converta sua imagem para PNG usando uma ferramenta online (ex: convertio.co)</li>
            <li>Faça upload em um serviço de hospedagem de imagens (ex: imgur.com, postimages.org)</li>
            <li>Copie o link direto da imagem e cole no campo acima</li>
            <li>A URL da imagem será enviada para o chat, contornando o problema de upload</li>
          </ol>
        </div>
      </div>
      
      <div className="mt-6 p-4 bg-gray-100 rounded">
        <h2 className="text-lg font-semibold mb-2">Logs de Depuração</h2>
        <p className="text-xs">Abra o console do navegador (F12) para ver logs detalhados sobre o processamento da imagem.</p>
      </div>
    </div>
  );
}