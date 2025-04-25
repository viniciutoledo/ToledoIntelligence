import React from 'react';

interface SimpleImageProps {
  src: string | null;
  alt: string;
  className?: string;
}

export function SimpleImage({ src, alt, className = "" }: SimpleImageProps) {
  if (!src) {
    return null;
  }

  // Verifica se é base64
  const isBase64 = typeof src === 'string' && src.startsWith('data:');
  
  // Limpa a URL se necessário (não base64)
  const cleanSrc = !isBase64 ? getCleanUrl(src) : src;
  
  // Acrescentar classe padrão e classes adicionais
  const imgClasses = `w-full h-auto object-contain ${className}`;
  
  return (
    <img 
      src={cleanSrc} 
      alt={alt}
      className={imgClasses}
      loading="lazy"
      onError={(e) => {
        // Se a imagem falhar, não mostramos mensagem de erro ou imagem substituta
        // Apenas ocultamos o elemento da imagem para não mostrar ícone de imagem quebrada
        e.currentTarget.style.display = 'none';
      }}
    />
  );
}

// Função para limpar URLs
function getCleanUrl(url: string): string {
  // Limpa caracteres especiais que possam causar problemas
  const cleanUrl = url.replace(/[\u200B-\u200D\uFEFF\u0000-\u001F\u007F-\u009F]/g, '');
  
  // Adicionar o prefixo da origem se for um caminho relativo
  if (cleanUrl.startsWith('/')) {
    return `${window.location.origin}${cleanUrl}`;
  }
  
  // Adicionar / se for um caminho relativo sem /
  if (!cleanUrl.startsWith('http') && !cleanUrl.startsWith('/') && !cleanUrl.startsWith('blob:') && !cleanUrl.startsWith('data:')) {
    return `/${cleanUrl}`;
  }
  
  return cleanUrl;
}