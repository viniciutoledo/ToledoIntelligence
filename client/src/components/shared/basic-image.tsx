// Componente ultrassimples para mostrar imagens, sem complexidade
interface BasicImageProps {
  src: string | null | undefined;
  alt: string;
}

export function BasicImage({ src, alt }: BasicImageProps) {
  if (!src) {
    return <div>Imagem não disponível</div>;
  }
  
  return (
    <img 
      src={src} 
      alt={alt} 
      style={{ maxWidth: '100%' }} 
      onError={(e) => {
        // Substituir a imagem com texto de erro
        e.currentTarget.outerHTML = 'Erro ao carregar imagem';
        
        // Log para depuração
        console.error('Erro ao carregar imagem:', src);
      }}
    />
  );
}