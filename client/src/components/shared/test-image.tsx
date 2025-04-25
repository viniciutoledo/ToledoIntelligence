import React from 'react';

// Componente para testar a exibição de uma imagem PNG simples diretamente codificada
export function TestImage() {
  // Esta é uma string base64 para um pixel PNG de 1x1
  const simplePngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  
  return (
    <div className="flex flex-col items-center gap-4 p-4 border rounded">
      <h3 className="text-lg font-medium">Teste de Imagem PNG</h3>
      <p className="text-sm text-gray-600 mb-2">Esta é uma imagem PNG de 1x1 pixel codificada diretamente:</p>
      
      <img 
        src={`data:image/png;base64,${simplePngBase64}`}
        alt="Teste PNG simples"
        className="border border-gray-300 p-1"
        style={{ width: '50px', height: '50px' }}
      />
      
      <p className="text-xs text-gray-500 mt-2">
        Se esta imagem for exibida corretamente (um pequeno quadrado), a plataforma suporta imagens PNG base64 básicas.
      </p>
    </div>
  );
}