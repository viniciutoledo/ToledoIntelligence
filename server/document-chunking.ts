import crypto from 'crypto';

/**
 * Interface para os chunks de documento com metadados
 */
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

/**
 * Divide um texto em chunks de tamanho semelhante, respeitando parágrafos
 */
export function chunkText(
  text: string,
  documentId: number,
  sourceType: string = 'document',
  options: {
    maxChunkSize?: number;
    overlapSize?: number;
    language?: string;
    documentName?: string;
  } = {}
): DocumentChunk[] {
  const {
    maxChunkSize = 1500,
    overlapSize = 150,
    language = 'pt',
    documentName = `Documento ${documentId}`
  } = options;

  // Dividir texto em parágrafos
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  if (paragraphs.length === 0) {
    return [];
  }
  
  const chunks: DocumentChunk[] = [];
  let currentChunk = '';
  let currentParagraphs: string[] = [];
  let chunkIndex = 0;
  
  // Processar parágrafos
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i].trim();
    
    // Se adicionar este parágrafo faz o chunk ficar muito grande
    if (currentChunk.length + paragraph.length + 1 > maxChunkSize && currentChunk.length > 0) {
      // Salvar chunk atual
      chunks.push(createChunk(
        currentChunk, 
        chunkIndex, 
        documentId, 
        sourceType, 
        { language, documentName }
      ));
      
      // Iniciar novo chunk com sobreposição
      const overlapParagraphs = getOverlapParagraphs(currentParagraphs, overlapSize);
      currentChunk = overlapParagraphs.join('\n\n');
      currentParagraphs = [...overlapParagraphs];
      chunkIndex++;
    }
    
    // Adicionar parágrafo ao chunk atual
    if (currentChunk.length > 0) {
      currentChunk += '\n\n';
    }
    currentChunk += paragraph;
    currentParagraphs.push(paragraph);
  }
  
  // Adicionar último chunk se não estiver vazio
  if (currentChunk.trim().length > 0) {
    chunks.push(createChunk(
      currentChunk, 
      chunkIndex, 
      documentId, 
      sourceType, 
      { language, documentName }
    ));
  }
  
  return chunks;
}

/**
 * Divide o documento em chunks com base na semântica do texto, 
 * tentando manter juntos parágrafos relacionados
 */
export function semanticChunking(
  text: string,
  documentId: number,
  sourceType: string = 'document',
  documentType: string = 'manual',
  options: {
    maxChunkSize?: number;
    overlapSize?: number;
    language?: string;
    documentName?: string;
  } = {}
): DocumentChunk[] {
  const {
    maxChunkSize = 1500,
    overlapSize = 150,
    language = 'pt',
    documentName = `Documento ${documentId}`
  } = options;
  
  // Para documentos técnicos, dividimos por seções
  if (documentType === 'manual' || documentType === 'technical') {
    // Identificar padrões de seções/títulos
    const sectionPattern = /^(#{1,3}|CAPÍTULO|SEÇÃO|PARTE|MÓDULO|[0-9]+\.)\s+.+$/im;
    
    // Dividir por potenciais seções
    const sections = text.split(new RegExp(`(?=${sectionPattern.source})`, 'im'))
      .filter(section => section.trim().length > 0);
    
    if (sections.length > 1) {
      // Temos seções identificáveis
      return paragraphToChunks(sections, documentId, sourceType, {
        maxChunkSize,
        overlapSize,
        language,
        documentName
      });
    }
  }
  
  // Para textos mais estruturados, tentar identificar pontos naturais de quebra
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  // Agrupar parágrafos que parecem relacionados
  const groupedParagraphs: string[] = [];
  let currentGroup = '';
  
  for (const paragraph of paragraphs) {
    // Heurística simples: se o parágrafo é muito curto ou começa com caracteres
    // que indicam continuação, agrupar com o anterior
    const isContinuation = /^(•|-|\*|[a-z]|[0-9]+\.)/.test(paragraph.trim()) || 
                           paragraph.trim().length < 50;
    
    if (isContinuation && currentGroup.length > 0) {
      currentGroup += '\n\n' + paragraph;
    } else {
      if (currentGroup.length > 0) {
        groupedParagraphs.push(currentGroup);
      }
      currentGroup = paragraph;
    }
  }
  
  if (currentGroup.length > 0) {
    groupedParagraphs.push(currentGroup);
  }
  
  return paragraphToChunks(groupedParagraphs, documentId, sourceType, {
    maxChunkSize,
    overlapSize,
    language,
    documentName
  });
}

/**
 * Divide o texto recursivamente, tentando manter a coesão do conteúdo
 */
export function recursiveChunking(
  text: string,
  documentId: number,
  sourceType: string = 'document',
  options: {
    maxChunkSize?: number;
    overlapSize?: number;
    language?: string;
    documentName?: string;
  } = {}
): DocumentChunk[] {
  const {
    maxChunkSize = 1500,
    overlapSize = 150,
    language = 'pt',
    documentName = `Documento ${documentId}`
  } = options;
  
  const chunks: DocumentChunk[] = [];
  
  // Função recursiva para quebrar texto
  function splitTextRecursively(
    textToSplit: string, 
    chunkIndex: number,
    depth: number = 0
  ): number {
    if (textToSplit.length <= maxChunkSize || depth > 5) {
      // Se o texto cabe em um chunk ou atingimos profundidade máxima
      chunks.push(createChunk(
        textToSplit,
        chunkIndex,
        documentId,
        sourceType,
        { language, documentName }
      ));
      return chunkIndex + 1;
    }
    
    // Tentativa 1: Dividir por parágrafos
    const paragraphs = textToSplit.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    if (paragraphs.length > 1) {
      let currentChunk = '';
      let nextIndex = chunkIndex;
      
      for (let i = 0; i < paragraphs.length; i++) {
        const paragraph = paragraphs[i];
        
        if (currentChunk.length + paragraph.length + 2 > maxChunkSize) {
          if (currentChunk.length > 0) {
            chunks.push(createChunk(
              currentChunk,
              nextIndex,
              documentId,
              sourceType,
              { language, documentName }
            ));
            nextIndex++;
            currentChunk = '';
          }
          
          // Se um único parágrafo for maior que o tamanho máximo
          if (paragraph.length > maxChunkSize) {
            nextIndex = splitTextRecursively(paragraph, nextIndex, depth + 1);
            continue;
          }
        }
        
        if (currentChunk.length > 0) {
          currentChunk += '\n\n';
        }
        currentChunk += paragraph;
      }
      
      if (currentChunk.length > 0) {
        chunks.push(createChunk(
          currentChunk,
          nextIndex,
          documentId,
          sourceType,
          { language, documentName }
        ));
        nextIndex++;
      }
      
      return nextIndex;
    }
    
    // Tentativa 2: Dividir por frases
    const sentences = textToSplit.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
    
    if (sentences.length > 1) {
      let currentChunk = '';
      let sentenceGroup: string[] = [];
      
      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        
        if (currentChunk.length + sentence.length + 1 > maxChunkSize) {
          if (currentChunk.length > 0) {
            chunks.push(createChunk(
              currentChunk,
              chunkIndex,
              documentId,
              sourceType,
              { language, documentName }
            ));
            chunkIndex++;
            
            // Adicionar sobreposição
            const overlapSentences = getOverlapSentences(sentenceGroup, overlapSize);
            currentChunk = overlapSentences.join(' ');
            sentenceGroup = [...overlapSentences];
          }
        }
        
        if (currentChunk.length > 0 && !currentChunk.endsWith(' ')) {
          currentChunk += ' ';
        }
        currentChunk += sentence;
        sentenceGroup.push(sentence);
      }
      
      if (currentChunk.length > 0) {
        chunks.push(createChunk(
          currentChunk,
          chunkIndex,
          documentId,
          sourceType,
          { language, documentName }
        ));
        chunkIndex++;
      }
      
      return chunkIndex;
    }
    
    // Tentativa 3: Dividir no meio se tudo mais falhar
    const midPoint = Math.floor(textToSplit.length / 2);
    let splitPoint = midPoint;
    
    // Tentar encontrar um espaço próximo ao meio
    for (let i = 0; i < 100; i++) {
      if (midPoint + i < textToSplit.length && textToSplit[midPoint + i] === ' ') {
        splitPoint = midPoint + i;
        break;
      }
      if (midPoint - i >= 0 && textToSplit[midPoint - i] === ' ') {
        splitPoint = midPoint - i;
        break;
      }
    }
    
    const firstHalf = textToSplit.substring(0, splitPoint).trim();
    const secondHalf = textToSplit.substring(splitPoint).trim();
    
    let nextChunkIndex = chunkIndex;
    
    if (firstHalf.length > 0) {
      nextChunkIndex = splitTextRecursively(firstHalf, nextChunkIndex, depth + 1);
    }
    
    if (secondHalf.length > 0) {
      nextChunkIndex = splitTextRecursively(secondHalf, nextChunkIndex, depth + 1);
    }
    
    return nextChunkIndex;
  }
  
  splitTextRecursively(text, 0);
  
  return chunks;
}

/**
 * Combina diferentes estratégias para chunking inteligente de documentos
 */
export function smartChunking(
  text: string,
  documentId: number,
  sourceType: string = 'document',
  documentType: string = 'manual',
  options: {
    maxChunkSize?: number;
    overlapSize?: number;
    language?: string;
    documentName?: string;
  } = {}
): DocumentChunk[] {
  // Determinar qual estratégia usar com base no tipo e tamanho do documento
  
  // Para documentos pequenos, usar chunking simples
  if (text.length < 3000) {
    return chunkText(text, documentId, sourceType, options);
  }
  
  // Para manuais ou documentos técnicos, tentar chunking semântico
  if (documentType === 'manual' || documentType === 'technical') {
    const chunks = semanticChunking(text, documentId, sourceType, documentType, options);
    
    // Se gerou poucos chunks, tentar com chunking recursivo
    if (chunks.length <= 1 && text.length > options.maxChunkSize!) {
      return recursiveChunking(text, documentId, sourceType, options);
    }
    
    return chunks;
  }
  
  // Para documentos gerais e longos, usar chunking recursivo
  if (text.length > 10000) {
    return recursiveChunking(text, documentId, sourceType, options);
  }
  
  // Default para documentos médios
  return chunkText(text, documentId, sourceType, options);
}

// Funções auxiliares

function createChunk(
  content: string, 
  chunkIndex: number, 
  documentId: number, 
  sourceType: string,
  options: { language?: string; documentName?: string } = {}
): DocumentChunk {
  const contentHash = crypto
    .createHash('md5')
    .update(content)
    .digest('hex');
  
  return {
    content,
    metadata: {
      documentId,
      chunkIndex,
      sourceType,
      contentHash,
      documentName: options.documentName,
      language: options.language,
    }
  };
}

function getOverlapSentences(sentences: string[], overlapSize: number): string[] {
  if (sentences.length === 0) return [];
  
  let totalLength = 0;
  const result: string[] = [];
  
  // Adicionar frases do final até atingir o tamanho da sobreposição
  for (let i = sentences.length - 1; i >= 0; i--) {
    const sentence = sentences[i];
    if (totalLength + sentence.length > overlapSize) {
      if (result.length === 0) {
        result.unshift(sentence);
      }
      break;
    }
    
    totalLength += sentence.length + 1; // +1 para espaço
    result.unshift(sentence);
  }
  
  return result;
}

function getOverlapParagraphs(paragraphs: string[], overlapSize: number): string[] {
  if (paragraphs.length === 0) return [];
  
  let totalLength = 0;
  const result: string[] = [];
  
  // Adicionar parágrafos do final até atingir o tamanho da sobreposição
  for (let i = paragraphs.length - 1; i >= 0; i--) {
    const paragraph = paragraphs[i];
    if (totalLength + paragraph.length > overlapSize) {
      if (result.length === 0) {
        result.unshift(paragraph);
      }
      break;
    }
    
    totalLength += paragraph.length + 2; // +2 para \n\n
    result.unshift(paragraph);
  }
  
  return result;
}

function paragraphToChunks(
  paragraphs: string[],
  documentId: number,
  sourceType: string,
  options: {
    maxChunkSize?: number;
    overlapSize?: number;
    language?: string;
    documentName?: string;
  } = {}
): DocumentChunk[] {
  const {
    maxChunkSize = 1500,
    overlapSize = 150,
    language = 'pt',
    documentName = `Documento ${documentId}`
  } = options;
  
  const chunks: DocumentChunk[] = [];
  let currentChunk = '';
  let currentParagraphs: string[] = [];
  let chunkIndex = 0;
  
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i].trim();
    
    if (paragraph.length > maxChunkSize) {
      // Parágrafo muito grande, usar chunking recursivo para ele
      if (currentChunk.length > 0) {
        chunks.push(createChunk(
          currentChunk,
          chunkIndex,
          documentId,
          sourceType,
          { language, documentName }
        ));
        chunkIndex++;
      }
      
      const subChunks = recursiveChunking(
        paragraph,
        documentId,
        sourceType,
        { maxChunkSize, overlapSize, language, documentName }
      );
      
      subChunks.forEach((chunk, idx) => {
        chunks.push({
          ...chunk,
          metadata: {
            ...chunk.metadata,
            chunkIndex: chunkIndex + idx
          }
        });
      });
      
      chunkIndex += subChunks.length;
      currentChunk = '';
      currentParagraphs = [];
      continue;
    }
    
    if (currentChunk.length + paragraph.length + 2 > maxChunkSize && currentChunk.length > 0) {
      chunks.push(createChunk(
        currentChunk,
        chunkIndex,
        documentId,
        sourceType,
        { language, documentName }
      ));
      
      // Iniciar novo chunk com sobreposição
      const overlapParagraphs = getOverlapParagraphs(currentParagraphs, overlapSize);
      currentChunk = overlapParagraphs.join('\n\n');
      currentParagraphs = [...overlapParagraphs];
      chunkIndex++;
    }
    
    if (currentChunk.length > 0) {
      currentChunk += '\n\n';
    }
    currentChunk += paragraph;
    currentParagraphs.push(paragraph);
  }
  
  if (currentChunk.trim().length > 0) {
    chunks.push(createChunk(
      currentChunk,
      chunkIndex,
      documentId,
      sourceType,
      { language, documentName }
    ));
  }
  
  return chunks;
}