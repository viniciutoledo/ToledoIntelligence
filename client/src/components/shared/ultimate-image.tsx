import React from 'react';
import { TestImage } from './test-image';

interface UltimateImageProps {
  src: string | null | undefined;
  alt?: string;
  className?: string;
}

// Componente simplificado que usa o TestImage
export function UltimateImage({ src, alt = "Imagem", className = "" }: UltimateImageProps) {
  // Usamos o componente TestImage que foi confirmado funcionar bem
  return <TestImage src={src} alt={alt} className={className} />;
}