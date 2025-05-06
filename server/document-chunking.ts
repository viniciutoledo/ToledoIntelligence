import { createHash } from 'crypto';

// Tipos para os chunks
export interface DocumentChunk {
  content: string;
  metadata: {
    documentId: number;
    chunkIndex: number;
    sourceType: string;
    contentHash: string;
    documentName?: string;
    language?: string;
  };
}

// Função para dividir textos em chunks com sobreposição
export function chunkText(
  text: string,
  documentId: number,
  sourceType: string = 'document',
  options: {
    chunkSize?: number;
    chunkOverlap?: number;
    language?: string;
    documentName?: string;
  } = {}
): DocumentChunk[] {
  const {
    chunkSize = 1000,
    chunkOverlap = 200,
    language = 'pt',
    documentName
  } = options;

  if (!text || text.trim().length === 0) {
    return [];
  }

  // Tratamento para remover caracteres de controle e normalizar espaços
  text = text
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Calcular o passo (stride) para sobreposição
  const stride = chunkSize - chunkOverlap;

  const chunks: DocumentChunk[] = [];
  let currentIndex = 0;

  // Dividir o texto em chunks
  while (currentIndex < text.length) {
    // Extrair chunk atual
    let chunkText = text.substring(
      currentIndex,
      Math.min(currentIndex + chunkSize, text.length)
    );

    // Se não estamos no final e é possível ajustar para não cortar no meio de uma palavra
    if (currentIndex + chunkSize < text.length) {
      // Encontrar o último espaço antes do limite
      const lastSpace = chunkText.lastIndexOf(' ');
      if (lastSpace > 0) {
        chunkText = chunkText.substring(0, lastSpace);
      }
    }

    // Calcular hash para verificar duplicação
    const contentHash = createHash('md5')
      .update(chunkText)
      .digest('hex');

    // Criar o chunk e adicionar ao array
    chunks.push({
      content: chunkText,
      metadata: {
        documentId,
        chunkIndex: chunks.length,
        sourceType,
        contentHash,
        documentName,
        language
      }
    });

    // Atualizar o índice para o próximo chunk, considerando a sobreposição
    const newIndex = currentIndex + chunkText.length;
    currentIndex = newIndex > currentIndex ? newIndex - chunkOverlap : newIndex;
  }

  console.log(`Documento ${documentId} dividido em ${chunks.length} chunks`);
  return chunks;
}

// Função para dividir um documento grande em chunks, preservando contexto semântico
export function semanticChunking(
  text: string,
  documentId: number,
  sourceType: string = 'document',
  options: {
    maxChunkSize?: number;
    language?: string;
    documentName?: string;
  } = {}
): DocumentChunk[] {
  const {
    maxChunkSize = 1500,
    language = 'pt',
    documentName
  } = options;

  if (!text || text.trim().length === 0) {
    return [];
  }

  // Normalização do texto
  text = text
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Dividir o texto em parágrafos
  const paragraphs = text
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  const chunks: DocumentChunk[] = [];
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    // Se o parágrafo sozinho excede o tamanho máximo, divida-o
    if (paragraph.length > maxChunkSize) {
      // Adicionar o chunk atual se não estiver vazio
      if (currentChunk.length > 0) {
        const contentHash = createHash('md5')
          .update(currentChunk)
          .digest('hex');
          
        chunks.push({
          content: currentChunk,
          metadata: {
            documentId,
            chunkIndex: chunks.length,
            sourceType,
            contentHash,
            documentName,
            language
          }
        });
        currentChunk = '';
      }
      
      // Dividir o parágrafo grande usando chunkText
      const paragraphChunks = chunkText(
        paragraph,
        documentId,
        sourceType,
        {
          chunkSize: maxChunkSize,
          chunkOverlap: 150,
          language,
          documentName
        }
      );
      
      chunks.push(...paragraphChunks);
      continue;
    }
    
    // Se adicionar o parágrafo atual excederia o tamanho máximo
    if (currentChunk.length + paragraph.length + 1 > maxChunkSize) {
      // Salvar o chunk atual
      const contentHash = createHash('md5')
        .update(currentChunk)
        .digest('hex');
        
      chunks.push({
        content: currentChunk,
        metadata: {
          documentId,
          chunkIndex: chunks.length,
          sourceType,
          contentHash,
          documentName,
          language
        }
      });
      
      // Iniciar um novo chunk com o parágrafo atual
      currentChunk = paragraph;
    } else {
      // Adicionar o parágrafo ao chunk atual
      currentChunk = currentChunk.length > 0
        ? `${currentChunk}\n\n${paragraph}`
        : paragraph;
    }
  }
  
  // Adicionar o último chunk se não estiver vazio
  if (currentChunk.length > 0) {
    const contentHash = createHash('md5')
      .update(currentChunk)
      .digest('hex');
      
    chunks.push({
      content: currentChunk,
      metadata: {
        documentId,
        chunkIndex: chunks.length,
        sourceType,
        contentHash,
        documentName,
        language
      }
    });
  }

  console.log(`Documento ${documentId} dividido semanticamente em ${chunks.length} chunks`);
  return chunks;
}

// Função para chunks recursivos baseados em cabeçalhos e seções
export function recursiveChunking(
  text: string,
  documentId: number,
  sourceType: string = 'document',
  options: {
    maxChunkSize?: number;
    language?: string;
    documentName?: string;
  } = {}
): DocumentChunk[] {
  const {
    maxChunkSize = 1500,
    language = 'pt',
    documentName
  } = options;

  if (!text || text.trim().length === 0) {
    return [];
  }

  // Detectar padrões de cabeçalho (Markdown ou formatação típica de documento)
  const headingPatterns = [
    /^#+\s+(.+)$/gm,                         // Markdown headings
    /^(.+)\n[=]{2,}$/gm,                    // Underlined headers (======)
    /^(.+)\n[-]{2,}$/gm,                    // Underlined subheaders (-----)
    /^\d+\.\s+(.+)$/gm,                     // Numbered sections like "1. Title"
    /^[A-Z\s]+:$/gm,                        // ALL CAPS followed by colon
    /^[A-Z][a-z]+\s+\d+(\.\d+)*\s+(.+)$/gm  // Section numbers like "Section 1.2.3 Title"
  ];

  // Dividir o texto em seções baseadas em cabeçalhos
  let sections = [text];
  
  for (const pattern of headingPatterns) {
    const newSections: string[] = [];
    
    for (const section of sections) {
      const matches = [...section.matchAll(new RegExp(pattern, 'gm'))];
      
      if (matches.length <= 1) {
        newSections.push(section);
        continue;
      }
      
      // Dividir esta seção nos cabeçalhos encontrados
      let lastIndex = 0;
      
      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        if (!match.index) continue;
        
        // Se não for o primeiro cabeçalho
        if (i > 0) {
          newSections.push(section.substring(lastIndex, match.index).trim());
        }
        
        lastIndex = match.index;
      }
      
      // Adicionar a última seção
      if (lastIndex < section.length) {
        newSections.push(section.substring(lastIndex).trim());
      }
    }
    
    if (newSections.length > sections.length) {
      sections = newSections;
    }
  }

  // Para cada seção, aplicar chunking semântico se for muito grande
  const chunks: DocumentChunk[] = [];
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    
    if (section.length <= maxChunkSize) {
      // A seção cabe em um único chunk
      const contentHash = createHash('md5')
        .update(section)
        .digest('hex');
        
      chunks.push({
        content: section,
        metadata: {
          documentId,
          chunkIndex: chunks.length,
          sourceType,
          contentHash,
          documentName,
          language
        }
      });
    } else {
      // Usar chunking semântico para esta seção
      const sectionChunks = semanticChunking(
        section,
        documentId,
        sourceType,
        {
          maxChunkSize,
          language,
          documentName
        }
      );
      
      chunks.push(...sectionChunks);
    }
  }

  console.log(`Documento ${documentId} dividido recursivamente em ${chunks.length} chunks`);
  return chunks;
}

// Função para escolher a melhor estratégia de chunking baseada no tipo de documento
export function smartChunking(
  text: string,
  documentId: number,
  sourceType: string = 'document',
  documentType: string = 'generic',
  options: {
    maxChunkSize?: number;
    language?: string;
    documentName?: string;
  } = {}
): DocumentChunk[] {
  // Analisar o texto para determinar sua estrutura
  const hasStructure = /^#+\s+|\n={3,}|\n-{3,}|^\d+\.\s+|^[A-Z\s]+:/.test(text);
  const avgParagraphLength = text.split(/\n\n+/).reduce((sum, p) => sum + p.length, 0) / 
                           Math.max(1, text.split(/\n\n+/).length);
  
  // Escolher estratégia baseada em heurística
  if (hasStructure && text.length > 3000) {
    return recursiveChunking(text, documentId, sourceType, options);
  } else if (avgParagraphLength > 500) {
    return chunkText(text, documentId, sourceType, options);
  } else {
    return semanticChunking(text, documentId, sourceType, options);
  }
}