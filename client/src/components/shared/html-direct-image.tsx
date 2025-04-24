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
  
  // Dar preferência para base64 sobre URLs
  // Uma vez que estamos tendo problemas consistentes com URLs
  if (isBase64) {
    // Usar imagem base64 diretamente - normalmente mais confiável
    return (
      <div 
        dangerouslySetInnerHTML={{ 
          __html: `<img 
            src="${src}" 
            alt="${alt}"
            style="max-width: 100%; max-height: 250px; object-fit: contain;"
            loading="lazy"
            onerror="this.onerror=null; this.parentNode.innerHTML='<div style=\\'padding: 8px; background-color: #fee2e2; color: #ef4444; border-radius: 4px; font-size: 14px;\\'>Erro ao carregar imagem</div>';"
          />`
        }} 
      />
    );
  }
  
  // Para URLs, tentar transformar em URL absoluta e adicionar timestamp para evitar cache
  let fullUrl = src;
  if (!src.startsWith('http')) {
    fullUrl = `${window.location.origin}${src.startsWith('/') ? '' : '/'}${src}`;
  }
  
  // Adicionar query param de timestamp para evitar cache
  const urlWithCache = `${fullUrl}${fullUrl.includes('?') ? '&' : '?'}_t=${Date.now()}`;
  
  // Usar HTML diretamente para evitar qualquer problema com componentes React
  return (
    <div 
      dangerouslySetInnerHTML={{ 
        __html: `<img 
          src="${urlWithCache}" 
          alt="${alt}"
          style="max-width: 100%; max-height: 250px; object-fit: contain; border: 1px solid #eee;"
          loading="lazy"
          onerror="this.onerror=null; this.parentNode.innerHTML='<div style=\\'padding: 8px; background-color: #fee2e2; color: #ef4444; border-radius: 4px; font-size: 14px;\\'>Erro ao carregar imagem</div>';"
        />`
      }} 
    />
  );
}