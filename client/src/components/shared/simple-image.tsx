// Componente de imagem simplificado seguindo exatamente as recomendações do usuário
interface SimpleImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
}

export function SimpleImage({ 
  src, 
  alt, 
  className = "max-w-full rounded-md object-contain"
}: SimpleImageProps) {
  if (!src) {
    return (
      <div className="p-2 bg-gray-100 rounded text-center text-gray-500 text-sm">
        Imagem não disponível
      </div>
    );
  }
  
  // Mantenha a mesma origem sem transformações
  return (
    <img
      src={src}
      alt={alt}
      style={{ maxWidth: '100%' }}
      className={className}
      onError={(e) => {
        // Exatamente como sugerido no documento
        e.currentTarget.replaceWith(
          document.createTextNode('Erro ao carregar imagem')
        );
      }}
    />
  );
}