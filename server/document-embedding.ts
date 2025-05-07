import OpenAI from 'openai';
import { storage } from './storage';
import { createClient } from '@supabase/supabase-js';
import { smartChunking, DocumentChunk } from './document-chunking';

// Verificar credenciais do Supabase
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error("Credenciais do Supabase não encontradas nas variáveis de ambiente");
}

// Inicializar cliente Supabase
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Processa um documento e gera embeddings para o seu conteúdo
 * @param documentId ID do documento a ser processado
 */
export async function processDocumentEmbeddings(documentId: number): Promise<boolean> {
  try {
    // Verificar se temos uma chave API
    if (!process.env.OPENAI_API_KEY) {
      console.error("Chave API OpenAI não configurada nas variáveis de ambiente");
      return false;
    }

    console.log(`Iniciando processamento de embeddings para documento ${documentId}`);
    
    // Buscar o documento
    const document = await storage.getTrainingDocument(documentId);
    if (!document) {
      console.error(`Documento com ID ${documentId} não encontrado`);
      return false;
    }
    
    // Verificar se o documento tem conteúdo OU tem um arquivo associado
    if ((!document.content || document.content.trim().length === 0) && 
        (!document.file_path || document.file_path.trim().length === 0)) {
      // Verificar o tipo de documento
      if (document.document_type === 'file' && document.file_path) {
        // Tentar extrair conteúdo do arquivo
        try {
          // Aqui poderíamos adicionar lógica para ler o arquivo, mas por enquanto apenas atualizamos o status
          await storage.updateTrainingDocument(documentId, { status: 'error', error_message: 'Arquivo não possui conteúdo legível' });
          console.error(`Documento ${documentId} tem arquivo, mas não foi possível extrair conteúdo`);
          return false;
        } catch (error) {
          console.error(`Erro ao tentar processar arquivo do documento ${documentId}:`, error);
          return false;
        }
      } else {
        // Não há conteúdo nem arquivo
        console.error(`Documento ${documentId} não tem conteúdo para processamento`);
        await storage.updateTrainingDocument(documentId, { status: 'error', error_message: 'Documento sem conteúdo' });
        return false;
      }
    }
    
    // Inicializar cliente OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // Verificar se há conteúdo para processar
    if (!document.content) {
      console.error(`Documento ${documentId} não possui conteúdo para chunking`);
      return false;
    }
    
    // Chunking: dividir o documento em partes processáveis usando o algoritmo avançado
    console.log(`Iniciando chunking avançado para documento ${documentId} (${document.content.length} caracteres)`);
    
    // Usar smart chunking para lidar melhor com documentos grandes
    const documentChunks = smartChunking(
      document.content,
      document.id,
      'document',
      document.document_type === 'file' ? 'technical' : (document.document_type || 'manual'),
      { 
        maxChunkSize: 1500,
        overlapSize: 150,
        language: 'pt',
        documentName: document.name
      }
    );
    
    // Extrair apenas o conteúdo dos chunks para processamento adicional
    const chunks = documentChunks.map(chunk => chunk.content);
    console.log(`Documento dividido em ${chunks.length} chunks para processamento usando algoritmo avançado`);
    
    // Processar cada chunk e gerar embeddings
    const embeddingResults = [];
    for (let i = 0; i < documentChunks.length; i++) {
      const docChunk = documentChunks[i];
      
      // Calcular e atualizar o progresso do documento
      const progress = Math.floor((i / documentChunks.length) * 100);
      
      // Atualizar o progresso do documento a cada 5% ou pelo menos a cada 5 chunks em documentos pequenos
      if (i === 0 || i === documentChunks.length - 1 || i % Math.max(1, Math.min(5, Math.floor(documentChunks.length / 20))) === 0) {
        await storage.updateTrainingDocument(documentId, { 
          progress,
          status: "processing" 
        });
        console.log(`Progresso do documento ${documentId}: ${progress}%`);
      }
      
      // Verificar se o chunk é válido
      if (!docChunk || !docChunk.content) {
        console.error(`Chunk ${i+1}/${documentChunks.length} inválido ou sem conteúdo, pulando`);
        continue;
      }
      
      const chunk = docChunk.content;
      
      // Verificar se o metadata existe
      if (!docChunk.metadata) {
        console.error(`Chunk ${i+1}/${documentChunks.length} não possui metadata válido, pulando`);
        continue;
      }
      
      const chunkMeta = docChunk.metadata;
      
      // Validar os campos essenciais do metadata
      if (typeof chunkMeta.chunkIndex !== 'number' || 
          typeof chunkMeta.contentHash !== 'string') {
        console.error(`Chunk ${i+1}/${documentChunks.length} possui metadata incompleto, pulando`);
        continue;
      }
      
      console.log(`Processando chunk ${i+1}/${documentChunks.length} (${chunk.length} caracteres, índice: ${chunkMeta.chunkIndex})`);
      
      let knowledgeEntry = null;
      let embeddingVector = null;
      
      try {
        // Gerar embedding via OpenAI
        const embeddingResponse = await openai.embeddings.create({
          model: "text-embedding-ada-002",
          input: chunk,
        });
        
        // Extrair o vetor embedding
        embeddingVector = embeddingResponse.data[0].embedding;
        
        // Preparar metadata com valores seguros
        const documentName = chunkMeta.documentName || document.name || `Documento ${document.id}`;
        const contentHash = chunkMeta.contentHash || '';
        const chunkIndex = typeof chunkMeta.chunkIndex === 'number' ? chunkMeta.chunkIndex : 0;
        
        // Armazenar o embedding no banco de dados principal
        knowledgeEntry = await storage.createKnowledgeEntry({
          content: chunk,
          embedding: JSON.stringify(embeddingVector),
          source_type: "document",
          source_id: document.id,
          chunk_index: chunkIndex,
          // Usar 'pt' como padrão pois o tipo aceitável é limitado
          language: "pt",
          metadata: JSON.stringify({
            document_name: documentName,
            document_type: document.document_type,
            chunk_index: chunkIndex,
            total_chunks: documentChunks.length,
            content_hash: contentHash
          }),
          is_verified: true,
          relevance_score: 1.0,
        });
        
        console.log(`Chunk ${i+1}/${documentChunks.length} processado com sucesso`);
        
        // Adicionar à lista de resultados apenas se foi processado com sucesso
        if (knowledgeEntry) {
          embeddingResults.push(knowledgeEntry);
        }
        
        // Opcional: armazenar no Supabase para buscas vetoriais mais rápidas
        if (embeddingVector) {
          try {
            // Preparar metadata seguro para o Supabase também
            const documentName = chunkMeta.documentName || document.name || `Documento ${document.id}`;
            const documentType = document.document_type || 'unknown';
            const contentHash = chunkMeta.contentHash || '';
            const chunkIndex = typeof chunkMeta.chunkIndex === 'number' ? chunkMeta.chunkIndex : 0;
            
            await supabase.from('document_embeddings').insert({
              document_id: document.id,
              chunk_index: chunkIndex,
              content: chunk,
              embedding: embeddingVector,
              metadata: {
                document_name: documentName,
                document_type: documentType,
                content_hash: contentHash
              }
            });
            console.log(`Chunk ${i+1} armazenado com sucesso no Supabase`);
          } catch (supabaseError) {
            console.error(`Erro ao armazenar chunk ${i+1} no Supabase:`, supabaseError);
            // Não falhar, pois já armazenamos no nosso banco principal
          }
        }
      } catch (error) {
        console.error(`Erro ao processar chunk ${i+1}/${documentChunks.length}:`, error);
        // Continuar mesmo com erro em um chunk individual
        continue;
      }
    }
    
    // Atualizar o status do documento com informações de processamento
    try {
      // Verificar a estrutura correta do documento no schema
      await storage.updateTrainingDocument(documentId, {
        status: "indexed",
        updated_at: new Date(),
        file_metadata: {
          chunks_count: documentChunks.length,
          embedding_model: "text-embedding-ada-002",
          processing_date: new Date().toISOString(),
          processed: true
        }
      });
      
      // Adicionar log detalhado para depuração
      console.log(`Documento ${documentId} atualizado com status 'indexed'. ` +
        `Total chunks processados: ${documentChunks.length}, ` +
        `Embeddings gerados: ${embeddingResults.length}`);
    } catch (updateError) {
      console.error(`Erro ao atualizar status final do documento ${documentId}:`, updateError);
      // Continuamos mesmo com erro no update de status, pois os chunks já foram processados
    }
    
    console.log(`Processamento de embeddings concluído para documento ${documentId}. Gerados ${embeddingResults.length} vetores.`);
    return true;
  } catch (error: any) {
    console.error(`Erro ao processar embeddings para documento ${documentId}:`, error);
    
    // Atualizar status do documento
    try {
      await storage.updateTrainingDocument(documentId, {
        status: "error",
        error_message: error.message,
        updated_at: new Date()
      });
    } catch (updateError) {
      console.error("Erro adicional ao atualizar status do documento:", updateError);
    }
    
    return false;
  }
}

/**
 * Divide o conteúdo do documento em chunks de tamanho adequado para processamento
 * @param content Conteúdo do documento
 * @param maxChunkSize Tamanho máximo de cada chunk em caracteres
 * @returns Array de chunks
 */
function chunkDocumentContent(content: string, maxChunkSize: number = 1500): string[] {
  // Verificações básicas
  if (!content || content.trim().length === 0) {
    return [];
  }
  
  const chunks: string[] = [];
  const text = content.trim();
  
  // Tokenização simples por parágrafos
  // Uma implementação mais sofisticada consideraria a estrutura semântica do documento
  const paragraphs = text.split(/\n\s*\n/);
  
  let currentChunk = "";
  
  for (const paragraph of paragraphs) {
    // Verificar se o parágrafo é muito grande por si só
    if (paragraph.length > maxChunkSize) {
      // Dividir parágrafo grande em pedaços menores
      const sentenceSplits = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
      
      for (const sentence of sentenceSplits) {
        if (currentChunk.length + sentence.length + 1 <= maxChunkSize) {
          currentChunk += (currentChunk ? " " : "") + sentence;
        } else {
          // Chunk atual está cheio, iniciar um novo
          if (currentChunk) {
            chunks.push(currentChunk);
          }
          
          // Se a sentença for maior que o tamanho máximo, dividi-la arbitrariamente
          if (sentence.length > maxChunkSize) {
            // Dividir em pedaços de maxChunkSize caracteres
            let remainingSentence = sentence;
            while (remainingSentence.length > 0) {
              const chunkPart = remainingSentence.substring(0, maxChunkSize);
              chunks.push(chunkPart);
              remainingSentence = remainingSentence.substring(maxChunkSize);
            }
            currentChunk = "";
          } else {
            currentChunk = sentence;
          }
        }
      }
    } else if (currentChunk.length + paragraph.length + 2 <= maxChunkSize) {
      // Adicionar parágrafo ao chunk atual
      currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
    } else {
      // Chunk atual está cheio, iniciar um novo
      chunks.push(currentChunk);
      currentChunk = paragraph;
    }
  }
  
  // Adicionar o último chunk se não estiver vazio
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

/**
 * Busca documentos relevantes para uma consulta específica
 * @param query Consulta do usuário
 * @param maxResults Número máximo de resultados a retornar
 * @returns Array de documentos com trechos relevantes
 */
export async function searchRelevantDocuments(query: string, maxResults: number = 3): Promise<Array<{
  document_id: number;
  document_name: string;
  content: string;
  relevance_score: number;
}>> {
  try {
    // Verificar se temos uma chave API
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("Chave API OpenAI não configurada nas variáveis de ambiente");
    }
    
    console.log(`Buscando documentos relevantes para consulta: "${query}"`);
    
    // Gerar embedding para a consulta
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: query,
    });
    
    const queryEmbedding = embeddingResponse.data[0].embedding;
    
    // Buscar chunks mais relevantes do banco
    // Primeiro tentar com Supabase para busca vetorial mais eficiente
    let relevantChunks = [];
    
    try {
      // Consulta no Supabase com similaridade vetorial
      const { data, error } = await supabase.rpc('match_embeddings', {
        query_embedding: queryEmbedding,
        similarity_threshold: 0.7,
        match_count: maxResults * 2 // Buscar mais para ter margem de segurança
      });
      
      if (error) throw error;
      
      relevantChunks = data;
    } catch (supabaseError) {
      console.error("Erro na busca vetorial via Supabase:", supabaseError);
      
      // Fallback para nosso próprio banco
      console.log("Usando método de fallback para busca semântica");
      const knowledgeEntries = await storage.getKnowledgeEntries("pt");
      
      // Cálculo manual de similaridade (menos eficiente)
      relevantChunks = knowledgeEntries
        .filter(entry => entry.source_type === "document" && entry.embedding)
        .map(entry => {
          try {
            // Converter string de embedding para array
            let embeddingArray: number[];
            
            if (typeof entry.embedding === 'string') {
              embeddingArray = JSON.parse(entry.embedding);
            } else if (Array.isArray(entry.embedding)) {
              embeddingArray = entry.embedding;
            } else {
              console.error('Formato de embedding inválido:', typeof entry.embedding);
              return null;
            }
            
            // Calcular similaridade de cosseno
            const similarity = calculateCosineSimilarity(queryEmbedding, embeddingArray);
            
            const metadata = typeof entry.metadata === 'string' 
              ? JSON.parse(entry.metadata)
              : entry.metadata || {};
              
            return {
              document_id: entry.source_id,
              document_name: metadata.document_name || "Documento sem nome",
              content: entry.content,
              relevance_score: similarity
            };
          } catch (error) {
            console.error('Erro ao processar embedding:', error);
            return null;
          }
        })
        .filter(Boolean) // Filtrar itens nulos
        .filter(chunk => chunk && typeof chunk.relevance_score === 'number' && chunk.relevance_score > 0.7) // Limiar de similaridade
        .sort((a, b) => {
          // Garantir que a e b são objetos válidos com propriedade relevance_score
          if (!a || !b) return 0;
          return (b.relevance_score || 0) - (a.relevance_score || 0);
        })
        .slice(0, maxResults * 2);
    }
    
    // Processar e consolidar os resultados
    // Juntar chunks do mesmo documento e remover duplicações
    const documentMap = new Map<number, {
      document_id: number;
      document_name: string;
      content: string;
      relevance_score: number;
    }>();
    
    for (const chunk of relevantChunks) {
      // Verificar se o chunk é válido e possui todas as propriedades necessárias
      if (!chunk || !chunk.document_id || !chunk.document_name || !chunk.content || 
          typeof chunk.relevance_score !== 'number') {
        console.warn('Chunk inválido ou incompleto ignorado durante o processamento');
        continue;
      }
      
      const docId = chunk.document_id;
      
      if (documentMap.has(docId)) {
        // Já temos um trecho deste documento, verificar se vale a pena adicionar mais
        const existingDoc = documentMap.get(docId);
        
        // Verificar se existingDoc é válido
        if (!existingDoc) {
          console.warn(`Documento com ID ${docId} no mapa, mas retornou null/undefined. Isso não deveria acontecer.`);
          continue;
        }
        
        // Se o novo chunk for mais relevante, atualizamos a pontuação
        if (chunk.relevance_score > existingDoc.relevance_score) {
          existingDoc.relevance_score = chunk.relevance_score;
        }
        
        // Adicionar conteúdo se não for duplicado e não exceder tamanho razoável
        if (!existingDoc.content.includes(chunk.content) && 
            existingDoc.content.length + chunk.content.length < 2500) {
          existingDoc.content += "\n\n" + chunk.content;
        }
      } else {
        // Novo documento, adicionar ao mapa
        documentMap.set(docId, {
          document_id: docId,
          document_name: chunk.document_name,
          content: chunk.content,
          relevance_score: chunk.relevance_score
        });
      }
    }
    
    // Converter mapa para array e ordenar por relevância
    const consolidatedResults = Array.from(documentMap.values())
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, maxResults);
      
    console.log(`Encontrados ${consolidatedResults.length} documentos relevantes para a consulta`);
    
    return consolidatedResults;
  } catch (error: any) {
    console.error("Erro ao buscar documentos relevantes:", error);
    return [];
  }
}

/**
 * Calcula a similaridade de cosseno entre dois vetores
 * @param vecA Primeiro vetor
 * @param vecB Segundo vetor
 * @returns Valor de similaridade (0-1)
 */
function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error("Vetores devem ter o mesmo tamanho");
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += Math.pow(vecA[i], 2);
    normB += Math.pow(vecB[i], 2);
  }
  
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (normA * normB);
}