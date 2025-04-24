interface DirectImageProps {
  src: string | null | undefined;
  alt: string;
}

export function DirectImage({ src, alt }: DirectImageProps) {
  // Se não houver URL, retornar mensagem de erro
  if (!src) {
    return <div className="text-red-500 text-sm py-2">Imagem não disponível</div>;
  }

  // Se for uma URL base64, usar diretamente
  if (src.startsWith('data:')) {
    return (
      <img 
        src={src} 
        alt={alt} 
        style={{ maxWidth: '100%', maxHeight: '300px' }}
        loading="lazy"
        onError={(e) => {
          console.error(`Erro ao carregar imagem base64: ${src.substring(0, 30)}...`);
          e.currentTarget.outerHTML = '<div class="text-red-500 text-sm py-2">Erro ao carregar imagem base64</div>';
        }}
      />
    );
  }

  // Para URLs normais, garantir que sejam completas
  let fullUrl = src;
  if (src && !src.startsWith('http')) {
    // Se não iniciar com http, considerar como relativa à origem atual
    fullUrl = `${window.location.origin}${src.startsWith('/') ? '' : '/'}${src}`;
  }

  return (
    <img 
      src={fullUrl} 
      alt={alt} 
      style={{ maxWidth: '100%', maxHeight: '300px' }}
      loading="lazy"
      crossOrigin="anonymous"
      onError={(e) => {
        console.error(`Erro ao carregar imagem URL: ${fullUrl}`);
        e.currentTarget.outerHTML = '<div class="text-red-500 text-sm py-2">Erro ao carregar imagem</div>';
      }}
    />
  );
}