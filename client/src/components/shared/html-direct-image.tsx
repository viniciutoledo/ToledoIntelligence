interface HtmlDirectImageProps {
  src: string | null | undefined;
  alt?: string;
}

// Este componente usa HTML diretamente para renderizar uma imagem,
// evitando qualquer abstração ou otimização React
export function HtmlDirectImage({ src, alt = "Imagem" }: HtmlDirectImageProps) {
  if (!src) {
    return <div dangerouslySetInnerHTML={{ __html: '<div style="padding: 8px; background-color: #fee2e2; color: #ef4444; border-radius: 4px; font-size: 14px;">Imagem não disponível</div>' }} />;
  }

  // Detectar imagens base64
  const isBase64 = src.startsWith('data:');
  
  // Se for uma URL que não começa com http, transformar em URL absoluta
  let fullUrl = src;
  if (!isBase64 && !src.startsWith('http')) {
    fullUrl = `${window.location.origin}${src.startsWith('/') ? '' : '/'}${src}`;
  }

  const finalUrl = isBase64 ? src : fullUrl;
  
  // Usar HTML diretamente para evitar qualquer problema com componentes React
  return (
    <div 
      dangerouslySetInnerHTML={{ 
        __html: `<img 
          src="${finalUrl}" 
          alt="${alt}"
          style="max-width: 100%; max-height: 250px; object-fit: contain;"
          crossorigin="anonymous"
          loading="lazy"
          onerror="this.onerror=null; this.parentNode.innerHTML='<div style=\\'padding: 8px; background-color: #fee2e2; color: #ef4444; border-radius: 4px; font-size: 14px;\\'>Erro ao carregar imagem</div>';"
        />`
      }} 
    />
  );
}