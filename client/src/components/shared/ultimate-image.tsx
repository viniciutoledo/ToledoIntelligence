interface UltimateImageProps {
  src: string | null | undefined;
  alt?: string;
  className?: string;
}

// Abordagem ultraminimalista para resolver o problema "Cannot set properties of null"
export function UltimateImage({ src, alt = "Imagem", className = "" }: UltimateImageProps) {
  if (!src) {
    return (
      <div className="p-2 bg-red-50 text-red-500 text-sm rounded">
        Imagem não disponível
      </div>
    );
  }

  // Detectar imagens base64
  const isBase64 = src.startsWith('data:');
  
  // Se for base64, usar diretamente, caso contrário tentar resolver URL
  const imageSrc = isBase64 
    ? src 
    : !src.startsWith('http') 
      ? `${window.location.origin}${src.startsWith('/') ? '' : '/'}${src}` 
      : src;

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={`max-w-full max-h-60 object-contain ${className}`}
      onError={(e) => {
        // Substituir elemento por mensagem de erro quando falhar
        const target = e.currentTarget;
        if (target.parentNode) {
          // Criar um novo elemento div para substituir a imagem
          const errorDiv = document.createElement('div');
          errorDiv.className = "p-2 bg-red-50 text-red-500 text-sm rounded";
          errorDiv.textContent = "Erro ao carregar imagem";
          
          // Substituir imagem pelo div de erro
          target.parentNode.replaceChild(errorDiv, target);
        }
      }}
    />
  );
}