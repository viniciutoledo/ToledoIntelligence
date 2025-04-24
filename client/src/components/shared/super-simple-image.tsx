interface SuperSimpleImageProps {
  src: string | null | undefined;
  alt?: string;
}

export function SuperSimpleImage({ src, alt = "Imagem" }: SuperSimpleImageProps) {
  if (!src) {
    return <div className="p-2 bg-red-50 text-red-500 text-sm rounded">Imagem não disponível</div>;
  }

  // Detectar imagens base64
  const isBase64 = src.startsWith('data:');
  
  // Se for uma URL que não começa com http, transformar em URL absoluta
  let fullUrl = src;
  if (!isBase64 && !src.startsWith('http')) {
    fullUrl = `${window.location.origin}${src.startsWith('/') ? '' : '/'}${src}`;
  }

  // Retornar tag IMG básica
  return (
    <img 
      src={isBase64 ? src : fullUrl} 
      alt={alt}
      style={{ maxWidth: '100%', maxHeight: '250px', objectFit: 'contain' }}
      crossOrigin="anonymous"
      loading="lazy"
    />
  );
}