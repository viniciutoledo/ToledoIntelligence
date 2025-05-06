import OpenAI from 'openai';
import { storage } from './storage';
import { createClient } from '@supabase/supabase-js';

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
    
    // Chunking: dividir o documento em partes processáveis
    const chunks = chunkDocumentContent(document.content);
    console.log(`Documento dividido em ${chunks.length} chunks para processamento`);
    
    // Processar cada chunk e gerar embeddings
    const embeddingResults = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`Processando chunk ${i+1}/${chunks.length} (${chunk.length} caracteres)`);
      
      // Gerar embedding via OpenAI
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: chunk,
      });
      
      // Extrair o vetor embedding
      const embedding = embeddingResponse.data[0].embedding;
      
      // Armazenar o embedding no banco (usando o Supabase para os vetores e nosso próprio banco para o registro)
      const knowledgeEntry = await storage.createKnowledgeEntry({
        content: chunk,
        embedding: JSON.stringify(embedding),
        source_type: "document",
        source_id: document.id,
        language: "pt", // Assumindo português, ajustar conforme necessário
        metadata: {
          document_name: document.name,
          document_type: document.document_type,
          chunk_index: i,
          total_chunks: chunks.length
        },
        is_verified: true,
        relevance_score: 1.0,
      });
      
      embeddingResults.push(knowledgeEntry);
      
      // Opcional: armazenar no Supabase para buscas vetoriais mais rápidas
      try {
        await supabase.from('document_embeddings').insert({
          document_id: document.id,
          chunk_index: i,
          content: chunk,
          embedding,
          metadata: {
            document_name: document.name,
            document_type: document.document_type
          }
        });
      } catch (supabaseError) {
        console.error("Erro ao armazenar embedding no Supabase:", supabaseError);
        // Não falhar, pois já armazenamos no nosso banco principal
      }
    }
    
    // Atualizar o status do documento
    await storage.updateTrainingDocument(documentId, {
      status: "indexed",
      updated_at: new Date(),
      metadata: {
        chunks_count: chunks.length,
        embedding_model: "text-embedding-ada-002",
        processing_date: new Date().toISOString()
      }
    });
    
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
        .filter(chunk => chunk.relevance_score > 0.7) // Limiar de similaridade
        .sort((a, b) => b.relevance_score - a.relevance_score)
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
      const docId = chunk.document_id;
      
      if (documentMap.has(docId)) {
        // Já temos um trecho deste documento, verificar se vale a pena adicionar mais
        const existingDoc = documentMap.get(docId)!;
        
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