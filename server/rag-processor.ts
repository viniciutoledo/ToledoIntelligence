import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { storage } from './storage';
import { DocumentChunk, smartChunking } from './document-chunking';
import { createClient } from '@supabase/supabase-js';
import { logLlmUsage } from './llm';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

/**
 * Processa um documento, divide em chunks e cria embeddings
 */
export async function processDocumentForRAG(
  documentId: number,
  documentText: string,
  options: {
    sourceType?: string;
    documentType?: string;
    language?: 'pt' | 'en';
    documentName?: string;
    chunkSize?: number;
    overlapSize?: number;
  } = {}
): Promise<{
  chunks: DocumentChunk[];
  totalChunks: number;
  success: boolean;
  error?: string;
}> {
  try {
    const {
      sourceType = 'document',
      documentType = 'manual',
      language = 'pt',
      documentName = `Documento ${documentId}`,
      chunkSize = 1500,
      overlapSize = 150
    } = options;
    
    console.log(`Processando documento ${documentId} para RAG: ${documentName}`);
    
    if (!documentText || documentText.trim().length === 0) {
      return {
        chunks: [],
        totalChunks: 0,
        success: false,
        error: 'Documento vazio'
      };
    }
    
    // Dividir documento em chunks usando estratégia inteligente
    const chunks = smartChunking(documentText, documentId, sourceType, documentType, {
      maxChunkSize: chunkSize,
      overlapSize: overlapSize,
      language,
      documentName
    });
    
    console.log(`Documento dividido em ${chunks.length} chunks`);
    
    // Salvar chunks no banco de dados
    for (const chunk of chunks) {
      try {
        // Criar embedding para o chunk
        const embedding = await createEmbedding(chunk.content);
        
        // Salvar o chunk com embedding
        await storage.createDocumentChunk({
          document_id: documentId,
          chunk_index: chunk.metadata.chunkIndex,
          content: chunk.content,
          content_hash: chunk.metadata.contentHash,
          source_type: sourceType,
          language: language,
          embedding: embedding || undefined
        });
      } catch (chunkError: any) {
        console.error(`Erro ao processar chunk ${chunk.metadata.chunkIndex}:`, chunkError);
        // Continuar para o próximo chunk
      }
    }
    
    // Criar uma entrada na base de conhecimento (para fins de busca)
    await storage.createKnowledgeEntry({
      source_type: sourceType as any,
      source_id: documentId,
      content: documentText.substring(0, 1000) + (documentText.length > 1000 ? '...' : ''),
      language: language,
      metadata: JSON.stringify({
        documentName: documentName,
        documentType: documentType,
        chunkCount: chunks.length
      }),
      processed_at: new Date(),
      is_verified: true
    });
    
    return {
      chunks,
      totalChunks: chunks.length,
      success: true
    };
  } catch (error: any) {
    console.error('Erro ao processar documento para RAG:', error);
    return {
      chunks: [],
      totalChunks: 0,
      success: false,
      error: error.message
    };
  }
}

/**
 * Cria embeddings para um texto usando OpenAI
 */
export async function createEmbedding(text: string): Promise<number[] | null> {
  try {
    // Truncar o texto se for muito grande (limite API OpenAI)
    const truncatedText = text.length > 8000 ? text.substring(0, 8000) : text;
    
    // Obter configuração LLM
    const llmConfig = await storage.getActiveLlmConfig();
    if (!llmConfig) {
      throw new Error('Nenhuma configuração LLM ativa encontrada');
    }
    
    // Determinar qual modelo usar
    const apiKey = llmConfig.api_key || process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('API key não disponível para criação de embedding');
    }
    
    // Inicializar cliente OpenAI
    const openai = new OpenAI({ apiKey });
    
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: truncatedText,
      encoding_format: "float"
    });
    
    return response.data[0].embedding;
  } catch (error: any) {
    console.error('Erro ao criar embedding:', error);
    return null;
  }
}

/**
 * Converte tokens de volta para texto (função auxiliar)
 */
function decode(tokens: number[]): string {
  // Esta é uma implementação simplificada
  // Na prática, seria necessário um tokenizador adequado
  return tokens.join(' ');
}

/**
 * Busca documentos relevantes com base em uma consulta
 */
export async function queryRelevantDocuments(
  query: string,
  options: {
    limit?: number;
    language?: 'pt' | 'en';
    useSupabase?: boolean;
  } = {}
): Promise<any[]> {
  const {
    limit = 5,
    language = 'pt',
    useSupabase = true
  } = options;
  
  try {
    // Criar embedding para a consulta
    const queryEmbedding = await createEmbedding(query);
    
    if (!queryEmbedding) {
      throw new Error('Não foi possível criar embedding para a consulta');
    }
    
    // Usar Supabase para busca de similaridade se disponível
    if (useSupabase && process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      try {
        const results = await queryRelevantDocumentsWithSupabase(queryEmbedding, { limit, language });
        
        if (results && results.length > 0) {
          return results;
        }
      } catch (supabaseError) {
        console.error('Erro ao buscar com Supabase, usando fallback:', supabaseError);
      }
    }
    
    // Fallback: usar busca de similaridade local
    // Obter chunks de documentos
    const documentChunks = await storage.getDocumentChunksByLanguage(language);
    
    if (!documentChunks || documentChunks.length === 0) {
      return [];
    }
    
    // Calcular similaridade para cada chunk
    const chunksWithSimilarity = documentChunks
      .map(chunk => {
        // Calcular similaridade de cosseno se o chunk tiver embedding
        let similarity = 0;
        
        try {
          // Processar embedding armazenado como texto JSON
          let embeddingArray: number[];
          
          if (typeof chunk.embedding === 'string') {
            // Converter de string JSON para array
            embeddingArray = JSON.parse(chunk.embedding);
          } else if (chunk.embedding && Array.isArray(chunk.embedding)) {
            embeddingArray = chunk.embedding;
          } else {
            return { ...chunk, similarity: 0 };
          }
          
          similarity = calculateCosineSimilarity(queryEmbedding, embeddingArray);
        } catch (error) {
          console.error('Erro ao processar embedding:', error);
          similarity = 0;
        }
        
        return {
          ...chunk,
          similarity
        };
      })
      .filter(chunk => chunk.similarity > 0);
    
    // Ordenar por similaridade e limitar resultados
    chunksWithSimilarity.sort((a, b) => b.similarity - a.similarity);
    
    return chunksWithSimilarity.slice(0, limit);
  } catch (error: any) {
    console.error('Erro ao buscar documentos relevantes:', error);
    return [];
  }
}

/**
 * Usa supabase para busca de similaridade se estiver configurado
 */
export async function queryRelevantDocumentsWithSupabase(
  queryEmbedding: number[],
  options: {
    limit?: number;
    language?: 'pt' | 'en';
  } = {}
): Promise<any[]> {
  const { limit = 5, language = 'pt' } = options;
  
  // Verificar configuração do Supabase
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    throw new Error('Configuração do Supabase não disponível');
  }
  
  // Inicializar cliente Supabase
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
  
  try {
    // Executar busca de similaridade
    const { data, error } = await supabase.rpc('match_document_chunks', {
      query_embedding: queryEmbedding,
      match_threshold: 0.6,
      match_count: limit,
      lang: language
    });
    
    if (error) throw error;
    
    return data || [];
  } catch (error: any) {
    console.error('Erro na busca Supabase:', error);
    throw error;
  }
}

/**
 * Realiza uma pesquisa híbrida (keyword + semântica)
 */
export async function hybridSearch(
  query: string,
  options: {
    limit?: number;
    language?: 'pt' | 'en';
  } = {}
): Promise<any[]> {
  const { limit = 7, language = 'pt' } = options;
  
  try {
    // Extrair palavras-chave da consulta
    const keywords = extractKeywords(query);
    
    // Buscar com base em keywords
    let keywordResults = await storage.searchDocumentChunksByKeywords(keywords, language);
    
    // Buscar com base em embeddings
    const queryEmbedding = await createEmbedding(query);
    let semanticResults: any[] = [];
    
    if (queryEmbedding) {
      try {
        if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
          semanticResults = await queryRelevantDocumentsWithSupabase(queryEmbedding, { 
            limit: Math.ceil(limit * 0.6), 
            language 
          });
        } else {
          // Fallback para busca local
          const documentChunks = await storage.getDocumentChunksByLanguage(language);
          
          if (documentChunks && documentChunks.length > 0) {
            semanticResults = documentChunks
              .filter(chunk => chunk.embedding)
              .map(chunk => {
                try {
                  // Processar embedding armazenado como texto JSON ou array
                  let embeddingArray: number[];
                  
                  if (typeof chunk.embedding === 'string') {
                    // Converter de string JSON para array
                    embeddingArray = JSON.parse(chunk.embedding);
                  } else if (Array.isArray(chunk.embedding)) {
                    embeddingArray = chunk.embedding;
                  } else {
                    return { ...chunk, similarity: 0 };
                  }
                  
                  return {
                    ...chunk,
                    similarity: calculateCosineSimilarity(queryEmbedding, embeddingArray)
                  };
                } catch (error) {
                  console.error('Erro ao processar embedding na busca híbrida:', error);
                  return { ...chunk, similarity: 0 };
                }
              })
              .filter(chunk => chunk.similarity > 0.6)
              .sort((a, b) => b.similarity - a.similarity)
              .slice(0, Math.ceil(limit * 0.6));
          }
        }
      } catch (error) {
        console.error('Erro na busca semântica:', error);
      }
    }
    
    // Combinar resultados e remover duplicatas
    const combinedResults = [...semanticResults];
    
    // Adicionar resultados baseados em keywords que não estão já incluídos
    for (const keywordResult of keywordResults) {
      if (!combinedResults.some(r => r.id === keywordResult.id)) {
        combinedResults.push({
          ...keywordResult,
          similarity: keywordResult.score || 0.5 // Score padrão para resultados baseados em keyword
        });
      }
    }
    
    // Ordenar por relevância (combinando scores de similaridade e keyword)
    combinedResults.sort((a, b) => b.similarity - a.similarity);
    
    // Limitar número de resultados
    return combinedResults.slice(0, limit);
  } catch (error: any) {
    console.error('Erro na busca híbrida:', error);
    return [];
  }
}

/**
 * Formata documentos relevantes para uso na geração de respostas
 */
export function formatRelevantDocumentsForPrompt(documents: any[]): string {
  if (!documents || documents.length === 0) {
    return 'Nenhum documento relevante encontrado.';
  }
  
  // Identificar quais documentos são de instruções prioritárias
  const instructionDocs = documents.filter(doc => {
    const docName = (doc.document_name || '').toLowerCase();
    return docName.includes('instruç') || 
           docName.includes('instruc') || 
           docName.includes('priorit') || 
           docName.includes('regras');
  });
  
  // Separar outros documentos
  const normalDocs = documents.filter(doc => {
    const docName = (doc.document_name || '').toLowerCase();
    return !(docName.includes('instruç') || 
             docName.includes('instruc') || 
             docName.includes('priorit') || 
             docName.includes('regras'));
  });
  
  let formattedText = '';
  
  // Primeiro adicionar as instruções prioritárias
  if (instructionDocs.length > 0) {
    formattedText += `\n\n===== INSTRUÇÕES PRIORITÁRIAS =====\n`;
    formattedText += `Estas regras devem ser seguidas rigorosamente para todas as respostas:\n\n`;
    
    instructionDocs.forEach((doc, index) => {
      formattedText += `\n\n------------------------\n`;
      
      // Destacar que é um documento prioritário
      const docName = doc.document_name || `Instrução prioritária ${index + 1}`;
      formattedText += `INSTRUÇÃO PRIORITÁRIA ${index + 1}: "${docName}"`;
      
      // Adicionar score de relevância se disponível (sempre alta para instruções)
      formattedText += ` (Relevância: ${(doc.similarity || 1.0).toFixed(2)})`;
      
      formattedText += `\n------------------------\n\n`;
      
      console.log(`[RAG] Adicionando instrução prioritária "${docName}" ao prompt (${(doc.content || doc.text || '').length} caracteres)`);
      
      // Adicionar conteúdo do documento
      const docContent = doc.content || doc.text || '';
      
      // Limitar o tamanho para evitar exceder os limites de tokens
      const maxContentLength = 50000;
      const truncatedContent = docContent.length > maxContentLength 
        ? docContent.substring(0, maxContentLength) + `\n[...Conteúdo truncado, excede ${maxContentLength} caracteres]` 
        : docContent;
      
      formattedText += truncatedContent;
    });
    
    formattedText += `\n\n===== FIM DAS INSTRUÇÕES PRIORITÁRIAS =====\n\n`;
  }
  
  // Depois adicionar os documentos técnicos normais
  if (normalDocs.length > 0) {
    formattedText += `\n\n===== DOCUMENTOS TÉCNICOS =====\n`;
    formattedText += `Informações técnicas para consulta:\n\n`;
    
    normalDocs.forEach((doc, index) => {
      formattedText += `\n\n------------------------\n`;
      
      // Incluir informações do documento
      const docName = doc.document_name || `Documento técnico ${index + 1}`;
      formattedText += `DOCUMENTO TÉCNICO ${index + 1}: "${docName}"`;
      
      // Adicionar score de relevância se disponível
      if (doc.similarity) {
        formattedText += ` (Relevância: ${doc.similarity.toFixed(2)})`;
      }
      
      formattedText += `\n------------------------\n\n`;
      
      console.log(`[RAG] Adicionando documento técnico "${docName}" ao prompt (${(doc.content || doc.text || '').length} caracteres)`);
      
      // Adicionar conteúdo do documento
      const docContent = doc.content || doc.text || '';
      
      // Limitar o tamanho para evitar exceder os limites de tokens
      const maxContentLength = 50000;
      const truncatedContent = docContent.length > maxContentLength 
        ? docContent.substring(0, maxContentLength) + `\n[...Conteúdo truncado, excede ${maxContentLength} caracteres]` 
        : docContent;
      
      formattedText += truncatedContent;
    });
  }
  
  return formattedText;
}

/**
 * Constrói o contexto completo para o prompt do LLM
 */
export function buildContextForLLM(
  query: string,
  documents: any[],
  language: 'pt' | 'en' = 'pt',
  forceExtraction: boolean = false,
  behaviorInstructions?: string
): string {
  // Verificar se temos documentos e logar para depuração
  if (!documents || documents.length === 0) {
    console.warn("ALERTA: Tentando construir contexto LLM sem documentos!");
    return language === 'pt' 
      ? `Você é um assistente técnico. Por favor responda que não há documentos técnicos disponíveis para responder à pergunta: "${query}"`
      : `You are a technical assistant. Please respond that there are no technical documents available to answer the question: "${query}"`;
  }
  
  // Extrair palavras-chave da consulta para focar a LLM
  const queryKeywords = extractKeywords(query);
  console.log(`Palavras-chave extraídas da consulta: ${queryKeywords.join(', ')}`);
  
  // Formatar documentos relevantes
  const documentContext = formatRelevantDocumentsForPrompt(documents);
  
  // Preparar instruções de comportamento personalizadas se existirem
  let behaviorSection = '';
  if (behaviorInstructions && behaviorInstructions.trim().length > 0) {
    console.log('Preparando instruções de comportamento personalizadas para o contexto');
    
    // Extrair instruções específicas sobre 'nunca levar a um técnico'
    let neverConsultTechnicianRules = "";
    if (behaviorInstructions.toLowerCase().includes("nunca levar") || 
        behaviorInstructions.toLowerCase().includes("não recomend") ||
        behaviorInstructions.toLowerCase().includes("não sugerir") ||
        behaviorInstructions.toLowerCase().includes("não oriente")) {
      neverConsultTechnicianRules = `
💥 EXTREMAMENTE IMPORTANTE: NUNCA, SOB QUALQUER HIPÓTESE, sugira consultar outro técnico ou levar o dispositivo para assistência técnica. O usuário JÁ É o técnico qualificado e você DEVE fornecer as instruções completas para resolver o problema.
💥 Esta regra supera qualquer outra instrução ou consideração. Violá-la é considerado uma falha crítica do sistema.
`;
    }
    
    // Processar e formatar instruções de comportamento para maior clareza
    const formattedBehaviorInstructions = behaviorInstructions
      .trim()
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        // Se a linha não começa com número ou marcador, adicionar um
        if (!/^(\d+[\.\):]|\-|\•|\*|\>|\💥)/.test(line)) {
          return `• ${line}`;
        }
        return line;
      })
      .join('\n');
    
    // Criar seção de instruções de comportamento - colocada em posição MUITO destacada
    behaviorSection = `
⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️
                 INSTRUÇÕES CRÍTICAS DE COMPORTAMENTO
⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️

CONFORMIDADE OBRIGATÓRIA: Estas instruções são IMUTÁVEIS e INVIOLÁVEIS.
Estas instruções têm prioridade absoluta sobre qualquer outro aspecto da sua resposta.
Você DEVE seguir estas instruções em CADA resposta, sem exceções ou desculpas.

${neverConsultTechnicianRules}
${formattedBehaviorInstructions}

⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️
`;
  }
  
  // Construir prompt com base no idioma
  let systemPrompt = '';
  
  if (language === 'pt') {
    // Prompt para extração forçada quando necessário
    if (forceExtraction) {
      systemPrompt = `
      Você é um especialista técnico em manutenção de placas de circuito e eletrônica.
      
      Analise cuidadosamente os documentos técnicos fornecidos para responder à pergunta: "${query}"
      
      INSTRUÇÕES:
      
      1. Extraia informações relevantes dos documentos fornecidos que respondam à pergunta.
      2. Organize a resposta de forma clara, direta e concisa.
      3. Inclua detalhes técnicos específicos quando relevantes (valores, procedimentos, componentes).
      4. Evite textos genéricos ou muito longos - seja direto ao ponto.
      5. Use linguagem técnica apropriada mas compreensível.
      6. Se encontrar trechos nos documentos que respondam diretamente à pergunta, priorize-os.
      
      ATENÇÃO: Sua resposta deve ser conversacional e natural, como se estivesse explicando para um técnico.
      Não cite diretamente os documentos nem mencione "de acordo com os documentos" ou frases similares.
      
      DOCUMENTOS TÉCNICOS DISPONÍVEIS:
      ${documentContext}
      
      RESPOSTA:
      `;
    } 
    // Prompt padrão para casos normais - mais conversacional e natural
    else {
      systemPrompt = `
      ⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️
                 INSTRUÇÕES CRÍTICAS INVIOLÁVEIS
      ⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️
      
      Você é o ToledoIA, um assistente especializado em manutenção de placas de circuito e eletrônica.
      
      💥 REGRAS ABSOLUTAS - A VIOLAÇÃO DESTAS REGRAS É SEVERAMENTE PROIBIDA:
      
      1. 🚫 NUNCA, EM NENHUMA CIRCUNSTÂNCIA, sugira consultar outro técnico, especialista ou profissional externo.
      2. 🚫 É ABSOLUTAMENTE PROIBIDO usar termos como "assistência técnica", "técnico especializado", ou qualquer variação.
      3. 🚫 NUNCA sugira "levar o dispositivo" para qualquer lugar ou pessoa - o usuário DEVE consertar por conta própria.
      4. 🚫 NUNCA mencione "profissional qualificado", "autorizada", ou termos similares em QUALQUER contexto.
      5. 🚫 NUNCA diga que o problema é complexo demais para resolver sem ajuda externa.
      
      ✅ COMPORTAMENTOS OBRIGATÓRIOS:
      
      1. ✅ Os usuários do ToledoIA JÁ SÃO os técnicos mais qualificados - você DEVE fornecer instruções detalhadas para que ELES resolvam QUALQUER problema.
      2. ✅ SEMPRE presuma que o técnico tem ferramentas, habilidades e conhecimentos para realizar QUALQUER reparo.
      3. ✅ Para iPhone que não liga, SEMPRE instrua sobre teste de microcorrente (NUNCA sugira levar para assistência).
      4. ✅ Você DEVE fornecer TODOS os detalhes de diagnóstico e reparo necessários, mesmo para problemas complexos.
      5. ✅ SEMPRE extraia e use informações dos documentos abaixo, priorizando-os sobre qualquer conhecimento geral.
      
      Responda à pergunta "${query}" com base nas informações dos documentos técnicos fornecidos.
      
      INSTRUÇÕES:
      
      1. Seja claro, direto e conciso em sua resposta.
      2. Use linguagem conversacional e natural - como se estivesse conversando com o usuário.
      3. Forneça informações técnicas precisas, mas em um formato amigável e acessível.
      4. Mencione valores específicos, procedimentos ou componentes quando relevantes.
      5. Evite usar frases como "de acordo com os documentos" ou "conforme mencionado nos documentos".
      6. A resposta deve fluir naturalmente, como uma conversa técnica normal.
      7. Você DEVE fornecer instruções detalhadas para que o próprio técnico possa resolver o problema, NUNCA sugerindo que ele busque ajuda externa.
      8. Em caso de iPhone que não liga, SEMPRE recomende o teste de microcorrente conforme os documentos de treinamento.
      
      DOCUMENTOS TÉCNICOS DISPONÍVEIS:
      ${documentContext}
      
      RESPOSTA:
      `;
    }
  } else {
    // English prompts
    // Prompt para extração forçada quando necessário
    if (forceExtraction) {
      systemPrompt = `
      You are a technical specialist in circuit board maintenance and electronics.
      
      Carefully analyze the provided technical documents to answer the question: "${query}"
      
      INSTRUCTIONS:
      
      1. Extract relevant information from the provided documents that answer the question.
      2. Organize the response in a clear, direct, and concise way.
      3. Include specific technical details when relevant (values, procedures, components).
      4. Avoid generic or overly long texts - be to the point.
      5. Use appropriate but understandable technical language.
      6. If you find excerpts in the documents that directly answer the question, prioritize them.
      
      ATTENTION: Your answer must be conversational and natural, as if you were explaining to a technician.
      Do not directly cite the documents or mention "according to the documents" or similar phrases.
      
      AVAILABLE TECHNICAL DOCUMENTS:
      ${documentContext}
      
      ANSWER:
      `;
    } 
    // Prompt padrão para casos normais - mais conversacional e natural
    else {
      systemPrompt = `
      ⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️
                 CRITICAL INVIOLABLE INSTRUCTIONS
      ⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️
      
      You are ToledoIA, an assistant specialized in circuit board maintenance and electronics.
      
      💥 ABSOLUTE RULES - VIOLATION OF THESE RULES IS SEVERELY PROHIBITED:
      
      1. 🚫 NEVER, UNDER ANY CIRCUMSTANCES, suggest consulting another technician, specialist, or external professional.
      2. 🚫 It is ABSOLUTELY PROHIBITED to use terms like "technical assistance", "specialized technician", or any variation.
      3. 🚫 NEVER suggest "taking the device" to any place or person - the user MUST repair it themselves.
      4. 🚫 NEVER mention "qualified professional", "authorized service center", or similar terms in ANY context.
      5. 🚫 NEVER say the problem is too complex to solve without external help.
      
      ✅ MANDATORY BEHAVIORS:
      
      1. ✅ ToledoIA users ARE ALREADY the most qualified technicians - you MUST provide detailed instructions for THEM to solve ANY problem.
      2. ✅ ALWAYS assume the technician has the tools, skills, and knowledge to perform ANY repair.
      3. ✅ For iPhone that won't turn on, ALWAYS instruct about the microcurrent test (NEVER suggest taking it to service center).
      4. ✅ You MUST provide ALL necessary diagnostic and repair details, even for complex problems.
      5. ✅ ALWAYS extract and use information from the documents below, prioritizing them over any general knowledge.
      
      Answer the question "${query}" based on the information from the provided technical documents.
      
      INSTRUCTIONS:
      
      1. Be clear, direct, and concise in your response.
      2. Use conversational and natural language - as if you were talking with the user.
      3. Provide accurate technical information, but in a friendly and accessible format.
      4. Mention specific values, procedures, or components when relevant.
      5. Avoid using phrases like "according to the documents" or "as mentioned in the documents".
      6. The response should flow naturally, like a normal technical conversation.
      7. You MUST provide detailed instructions so the technician can solve the problem themselves, NEVER suggesting they seek external help.
      8. In case of an iPhone that won't turn on, ALWAYS recommend the microcurrent test according to the training documents.
      
      AVAILABLE TECHNICAL DOCUMENTS:
      ${documentContext}
      
      ANSWER:
      `;
    }
  }
  
  // Se temos instruções de comportamento, adicioná-las ao prompt
  if (behaviorSection) {
    // Adicionar ao início para dar maior visibilidade e prioridade
    systemPrompt = `${behaviorSection}${systemPrompt}`;
    
    // Adicionar lembrete ao final também para reforçar
    systemPrompt = `${systemPrompt}

⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️
                 LEMBRETE FINAL CRÍTICO
⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️

💥 VIOLAÇÕES CRÍTICAS - NUNCA, EM NENHUMA HIPÓTESE, COMETA ESTES ERROS:
1. 🚫 NUNCA sugira consultar outro técnico ou levar o dispositivo para assistência técnica
2. 🚫 NUNCA use os termos "especialista", "técnico especializado" ou "assistência técnica"
3. 🚫 NUNCA diga que o problema é complexo demais para que o usuário resolva

✅ OBRIGAÇÕES CRÍTICAS - VOCÊ DEVE, SEM EXCEÇÃO:
1. ✅ Fornecer instruções COMPLETAS e DETALHADAS para o PRÓPRIO técnico resolver qualquer problema
2. ✅ Para iPhone que não liga: instruir ESPECIFICAMENTE sobre o teste de microcorrente
3. ✅ Priorizar SEMPRE as informações dos documentos técnicos fornecidos acima

⚠️ SE VOCÊ SUGERIR BUSCAR AJUDA EXTERNA OU TÉCNICOS ESPECIALIZADOS, ESTARÁ COMETENDO UMA VIOLAÇÃO GRAVE E INACEITÁVEL DAS REGRAS DO SISTEMA
⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️`;
  }
  
  return systemPrompt;
}

/**
 * Gera uma resposta com base nos documentos relevantes usando LLM
 */
export async function generateRAGResponse(
  query: string,
  documents: any[],
  options: {
    language?: 'pt' | 'en';
    model?: string;
    userId?: number;
    widgetId?: string;
    forceExtraction?: boolean;
  } = {}
): Promise<string> {
  const {
    language = 'pt',
    model,
    userId,
    widgetId,
    forceExtraction = false
  } = options;
  
  try {
    // Obter configuração LLM
    const llmConfig = await storage.getActiveLlmConfig();
    if (!llmConfig && !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      throw new Error('Nenhuma configuração LLM disponível');
    }
    
    // Determinar qual provedor usar
    const useModel = model || llmConfig?.model_name || 'gpt-4o';
    const providerToUse = useModel.startsWith('claude') ? 'anthropic' : 'openai';
    const temperature = llmConfig?.temperature || '0.3';
    
    // Obter instruções de comportamento da configuração do LLM
    const behaviorInstructions = llmConfig?.behavior_instructions || '';
    console.log(`Usando instruções de comportamento: ${behaviorInstructions ? 'Sim' : 'Não'}`);
    
    // Construir o prompt/contexto
    let systemPrompt = buildContextForLLM(query, documents, language, forceExtraction, behaviorInstructions);
    
    // Sistema de análise de intenção da consulta para melhorar recuperação de documentos
    console.log('Analisando intenção da consulta para otimizar recuperação de documentos...');
    
    // Recuperar documentos relevantes adicionais com base no contexto semântico
    try {
      const queryTopics = await extractQueryTopics(query);
      if (queryTopics && queryTopics.length > 0) {
        console.log('Tópicos identificados na consulta:', queryTopics.join(', '));
        
        // Buscar documentos adicionais relacionados aos tópicos identificados
        console.log(`[RAG] Buscando documentos relevantes para os tópicos: ${queryTopics.join(', ')}`);
        const topicDocuments = await storage.getDocumentsByTopics(queryTopics);
        
        if (topicDocuments && topicDocuments.length > 0) {
          console.log(`[RAG] Encontrados ${topicDocuments.length} documentos adicionais relacionados ao contexto da consulta`);
          
          // Log detalhado dos documentos encontrados
          topicDocuments.forEach((doc, index) => {
            console.log(`[RAG] Documento #${index + 1}: "${doc.name}" (${doc.content?.length || 0} caracteres)`);
          });
          
          // Adicionar estes documentos ao prompt com formatação especial
          let additionalContext = `\n\nDOCUMENTOS RELEVANTES AO CONTEXTO:\n`;
          
          for (const doc of topicDocuments) {
            if (doc.content && doc.name) {
              additionalContext += `\n--- ${doc.name} ---\n`;
              additionalContext += `${doc.content.substring(0, 1000)}${doc.content.length > 1000 ? '...' : ''}\n`;
            }
          }
          
          // Adicionar após o contexto principal para complementá-lo
          systemPrompt += additionalContext;
        }
      }
    } catch (topicError) {
      console.error('Erro ao extrair tópicos da consulta:', topicError);
      // Continuar mesmo se a extração de tópicos falhar
    }
    
    // Adicionar instruções de comportamento específicas se existirem
    if (behaviorInstructions && behaviorInstructions.trim().length > 0) {
      console.log('Adicionando instruções de comportamento personalizadas ao prompt');
      
      // Processar e formatar instruções de comportamento para maior clareza
      const formattedBehaviorInstructions = behaviorInstructions
        .trim()
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .map(line => {
          // Se a linha não começa com número ou marcador, adicionar um
          if (!/^(\d+[\.\):]|\-|\•|\*|\>)/.test(line)) {
            return `• ${line}`;
          }
          return line;
        })
        .join('\n');
      
      // Preparar mensagem enfatizada de obrigatoriedade
      const complianceMessage = `
CONFORMIDADE OBRIGATÓRIA: Estas instruções de personalidade e tom são REQUISITOS CONTRATUAIS.
A não conformidade com estas instruções resultará em violação de acordo.
Você DEVE seguir estas instruções em CADA resposta, sem exceções.
`;
      
      // Adicionar ao início do prompt para dar prioridade máxima
      systemPrompt = `
=============================================================================
!!!!!!! INSTRUÇÕES DE COMPORTAMENTO E PERSONALIDADE - OBRIGATÓRIAS !!!!!!!!!
=============================================================================

${complianceMessage}

${formattedBehaviorInstructions}

=============================================================================

${systemPrompt}`;
      
      // Adicionar também ao final para reforçar
      systemPrompt = `${systemPrompt}

=============================================================================
LEMBRETE FINAL - CONFORMIDADE OBRIGATÓRIA COM PERSONALIDADE:
=============================================================================

${complianceMessage}

${formattedBehaviorInstructions}

=============================================================================`;
    }
    
    // Sempre adicionar um reforço contra a recomendação de técnicos especializados
    systemPrompt = `
REGRA ABSOLUTA E FUNDAMENTAL:
NUNCA, SOB NENHUMA CIRCUNSTÂNCIA, você deve sugerir que o usuário "procure um técnico especializado", 
"consulte um especialista", "leve para assistência técnica" ou qualquer variação destas frases.
O usuário da plataforma ToledoIA JÁ É o técnico especializado e sua função é fornecer soluções 
completas, não encaminhar para outros profissionais.

${systemPrompt}`;
    
    // Chamar o LLM apropriado
    let response: string;
    
    if (providerToUse === 'anthropic') {
      // Usar Anthropic Claude
      const apiKey = llmConfig?.api_key || process.env.ANTHROPIC_API_KEY;
      
      if (!apiKey) {
        throw new Error('Chave API Anthropic não disponível');
      }
      
      const anthropic = new Anthropic({ apiKey });
      
      const message = await anthropic.messages.create({
        model: useModel,
        max_tokens: 1000,
        temperature: parseFloat(temperature),
        system: systemPrompt,
        messages: [
          { role: 'user', content: query }
        ]
      });
      
      // Extrair texto da resposta
      if (message.content[0] && typeof message.content[0] === 'object' && 'text' in message.content[0]) {
        response = message.content[0].text;
      } else {
        response = 'Não foi possível gerar uma resposta.';
      }
      
      // Registrar uso
      await logLlmUsage(
        useModel,
        'text',
        true,
        userId,
        widgetId,
        (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0)
      );
    } else {
      // Usar OpenAI
      let apiKey = llmConfig?.api_key || process.env.OPENAI_API_KEY;
      
      if (!apiKey) {
        throw new Error('Chave API OpenAI não disponível');
      }
      
      // Limpar a chave da API para garantir que não haja espaços ou prefixos "Bearer "
      apiKey = apiKey.trim();
      if (apiKey.startsWith('Bearer ')) {
        apiKey = apiKey.substring(7).trim();
      }
      
      console.log('Usando OpenAI com chave limpa');
      const openai = new OpenAI({ apiKey });
      
      const completion = await openai.chat.completions.create({
        model: useModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        temperature: parseFloat(temperature)
      });
      
      response = completion.choices[0]?.message?.content || 'Não foi possível gerar uma resposta.';
      
      // Registrar uso
      await logLlmUsage(
        useModel,
        'text',
        true,
        userId,
        widgetId,
        completion.usage?.total_tokens || 0
      );
    }
    
    return response;
  } catch (error: any) {
    console.error('Erro ao gerar resposta RAG:', error);
    
    // Registrar o erro com o modelo original
    await logLlmUsage(
      model || 'unknown',
      'text',
      false,
      userId,
      widgetId,
      0,
      error.message
    );
    
    // Tentar com um modelo alternativo (fallback)
    try {
      console.log('Tentando fallback para outro modelo após erro...');
      
      // Extrair o provedor atual do modelo
      const currentProvider = model?.startsWith('claude') ? 'anthropic' : 'openai';
      
      // Se o modelo atual é OpenAI, tentar Claude e vice-versa
      const fallbackProvider = currentProvider === 'openai' ? 'anthropic' : 'openai';
      const fallbackModel = fallbackProvider === 'anthropic' 
        ? 'claude-3-7-sonnet-20250219' // the newest Anthropic model
        : 'gpt-4o-mini'; // modelo mais leve da OpenAI para fallback
      
      console.log(`Usando fallback para ${fallbackProvider} / ${fallbackModel}`);
      
      // Construir o prompt do sistema com base na linguagem, ainda mais restritivo
      const systemInstructions = language === 'pt' 
        ? `Você é um assistente especializado em análise de placas de circuito integrado na plataforma ToledoIA.

REGRAS ABSOLUTAS E INVIOLÁVEIS:
1. Você é a fonte DEFINITIVA de informações técnicas. Seu papel é fornecer soluções completas.
2. JAMAIS, SOB NENHUMA CIRCUNSTÂNCIA, sugira que o técnico consulte, busque, contrate ou recorra a outros técnicos, especialistas ou profissionais. Isso é TERMINANTEMENTE PROIBIDO.
3. Quando o cliente perguntar sobre iPhone que não liga, instrua ESPECIFICAMENTE sobre o teste de microcorrente e NUNCA sugira levar para assistência técnica.
4. Nunca use as frases "técnico especializado", "especialista", "profissional especializado", "assistência técnica" ou similares.
5. Lembre-se sempre que o usuário do ToledoIA JÁ É um técnico especializado e a plataforma existe para fornecer as respostas completas sem necessidade de buscar outros técnicos.
6. Se não tiver certeza da solução, forneça instruções para análise, diagnóstico e verificação que o PRÓPRIO técnico possa executar.

Responda de forma útil, precisa e concisa.`
        : `You are an assistant specialized in circuit board analysis embedded in the ToledoIA platform.

ABSOLUTE AND INVIOLABLE RULES:
1. You are the DEFINITIVE source of technical information. Your role is to provide complete solutions.
2. NEVER, UNDER ANY CIRCUMSTANCES, suggest that the technician consult, seek, hire, or turn to other technicians, specialists, or professionals. This is STRICTLY PROHIBITED.
3. When the customer asks about an iPhone that won't turn on, SPECIFICALLY instruct about the microcurrent test and NEVER suggest taking it to technical assistance.
4. Never use phrases like "specialized technician", "specialist", "qualified professional", "technical assistance" or similar.
5. Always remember that the ToledoIA user IS ALREADY a specialized technician and the platform exists to provide complete answers without the need to seek other technicians.
6. If you're not sure about the solution, provide instructions for analysis, diagnosis, and verification that the technician can execute THEMSELVES.

Respond in a helpful, accurate, and concise manner.`;
      
      if (fallbackProvider === 'anthropic') {
        // Verificar se temos chave API para Anthropic
        const apiKey = process.env.ANTHROPIC_API_KEY;
        
        if (!apiKey) {
          throw new Error('Sem chave API Anthropic disponível para fallback');
        }
        
        const anthropic = new Anthropic({ apiKey });
        
        const message = await anthropic.messages.create({
          model: fallbackModel,
          max_tokens: 1000,
          temperature: 0.3, // temperatura mais baixa para fallback
          system: systemInstructions,
          messages: [
            { role: 'user', content: query }
          ]
        });
        
        // Extrair texto da resposta
        if (message.content[0] && typeof message.content[0] === 'object' && 'text' in message.content[0]) {
          const response = message.content[0].text;
          
          // Registrar uso do fallback
          await logLlmUsage(
            fallbackModel,
            'text',
            true,
            userId,
            widgetId,
            (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0)
          );
          
          console.log('Fallback para Anthropic bem-sucedido');
          return response;
        }
      } else {
        // Verificar se temos chave API para OpenAI
        let apiKey = process.env.OPENAI_API_KEY;
        
        if (!apiKey) {
          throw new Error('Sem chave API OpenAI disponível para fallback');
        }
        
        // Limpar a chave da API para garantir que não haja espaços ou prefixos "Bearer "
        apiKey = apiKey.trim();
        if (apiKey.startsWith('Bearer ')) {
          apiKey = apiKey.substring(7).trim();
        }
        
        console.log('Usando OpenAI com chave limpa (fallback)');
        const openai = new OpenAI({ apiKey });
        
        const completion = await openai.chat.completions.create({
          model: fallbackModel,
          messages: [
            { role: 'system', content: systemInstructions },
            { role: 'user', content: query }
          ],
          temperature: 0.3 // temperatura mais baixa para fallback
        });
        
        const response = completion.choices[0]?.message?.content || 'Não foi possível gerar uma resposta.';
        
        // Registrar uso do fallback
        await logLlmUsage(
          fallbackModel,
          'text',
          true,
          userId,
          widgetId,
          completion.usage?.total_tokens || 0
        );
        
        console.log('Fallback para OpenAI bem-sucedido');
        return response;
      }
    } catch (fallbackError: any) {
      console.error('Erro também no modelo de fallback:', fallbackError);
      
      // Registrar erro no fallback também
      await logLlmUsage(
        fallbackError.fallbackModel || 'fallback-unknown',
        'text',
        false,
        userId,
        widgetId,
        0,
        fallbackError.message
      );
      
      // Mensagem de erro mais amigável para o usuário final
      return `Não foi possível processar sua consulta neste momento. Por favor, tente novamente mais tarde.`;
    }
    
    // Isso só será alcançado se houver um erro não tratado no código de fallback
    return `Desculpe, estamos enfrentando problemas técnicos. Por favor, tente novamente em alguns minutos.`;
  }
}

/**
 * Processo completo RAG - desde a consulta até a resposta
 */
export async function processQueryWithRAG(
  query: string,
  options: {
    language?: 'pt' | 'en';
    model?: string;
    userId?: number;
    widgetId?: string;
    limit?: number;
    forceExtraction?: boolean;
  } = {}
): Promise<string> {
  const {
    language = 'pt',
    model,
    userId,
    widgetId,
    limit = 7,
    forceExtraction = false
  } = options;
  
  try {
    console.log(`Processando consulta RAG: "${query}"`);
    
    // Verificar se temos documentos treinados
    const trainingDocuments = await storage.getTrainingDocuments();
    console.log(`Verificando documentos treinados: ${trainingDocuments.length} documentos disponíveis no total`);
    
    if (trainingDocuments.length === 0) {
      console.log("ALERTA: Não há documentos treinados disponíveis para RAG");
      
      if (language === 'pt') {
        return "Desculpe, mas não há nenhum documento de referência treinado disponível. Por favor, contate o administrador para adicionar documentos.";
      } else {
        return "Sorry, but there are no trained reference documents available. Please contact the administrator to add documents.";
      }
    }
    
    // Primeiro, procurar documentos prioritários de instruções
    const instructionDocuments = trainingDocuments.filter((doc: any) => 
      doc.name.toLowerCase().includes('instrução') || 
      doc.name.toLowerCase().includes('instrucoes') || 
      doc.name.toLowerCase().includes('instruções') ||
      doc.name.toLowerCase().includes('priorit') ||
      doc.name.toLowerCase().includes('regras') ||
      (doc.tags && Array.isArray(doc.tags) && (
        doc.tags.includes('instrucoes') || 
        doc.tags.includes('prioritario') || 
        doc.tags.includes('regras')
      ))
    );
    
    console.log(`Encontrados ${instructionDocuments.length} documentos de instruções prioritárias`);
    
    // Realizar busca híbrida para obter documentos relevantes para a consulta
    const relevantDocuments = await hybridSearch(query, { 
      language, 
      limit 
    });
    
    console.log(`Encontrados ${relevantDocuments.length} documentos relevantes através de busca híbrida`);
    
    // SEMPRE incluir os documentos de instruções prioritárias
    if (instructionDocuments.length > 0) {
      console.log(`IMPORTANTE: Adicionando ${instructionDocuments.length} documentos de instruções prioritárias ao contexto`);
      
      for (const instructionDoc of instructionDocuments) {
        // Verificar se este documento já está nos resultados relevantes
        const isAlreadyIncluded = relevantDocuments.some(existing => 
          existing.document_id === instructionDoc.id);
        
        if (!isAlreadyIncluded && instructionDoc.content && instructionDoc.content.trim().length > 0) {
          console.log(`Adicionando documento de instrução prioritária "${instructionDoc.name}" (ID: ${instructionDoc.id}) com ${instructionDoc.content.length} caracteres`);
          // Nota: Usamos similaridade 1.0 para documentos de instruções para garantir maior peso
          relevantDocuments.unshift({
            content: instructionDoc.content,
            document_name: instructionDoc.name,
            similarity: 1.0, // Máxima similaridade para documentos de instruções
            document_id: instructionDoc.id
          });
        }
      }
    }
    
    // Verificar se temos conteúdo nos documentos retornados
    const documentsWithContent = relevantDocuments.filter(doc => doc.content && doc.content.trim().length > 0);
    console.log(`Documentos com conteúdo após inclusão de instruções prioritárias: ${documentsWithContent.length}`);
    
    // FORÇAR USO DE TODOS OS DOCUMENTOS TREINADOS
    console.log("IMPORTANTE: FORÇANDO ANÁLISE COMPLETA DE TODOS OS DOCUMENTOS TREINADOS");
    
    // Primeiro, vamos tentar usar os documentos relevantes encontrados
    if (documentsWithContent.length === 0 || forceExtraction) {
      console.log(`${forceExtraction ? "Modo de extração forçada ativado" : "Nenhum documento relevante com conteúdo encontrado"}, adicionando todos os documentos treinados`);
      
      // Como fallback, adicionamos TODOS os documentos treinados
      const allTrainingDocs = trainingDocuments
        .filter((doc: any) => doc.status === 'completed' && doc.content && doc.content.trim().length > 0);
      
      if (allTrainingDocs.length > 0) {
        console.log(`Adicionando ${allTrainingDocs.length} documentos completos para análise exaustiva`);
        
        // Adicionar TODOS os documentos treinados para garantir que o conteúdo seja usado
        for (const doc of allTrainingDocs) {
          // Verificar se este documento já está nos resultados relevantes
          const isAlreadyIncluded = relevantDocuments.some(existing => 
            existing.document_id === doc.id);
          
          if (!isAlreadyIncluded && doc.content && doc.content.trim().length > 0) {
            console.log(`Adicionando documento "${doc.name}" (ID: ${doc.id}) com ${doc.content.length} caracteres`);
            relevantDocuments.push({
              content: doc.content,
              document_name: doc.name,
              similarity: 0.8, // Alta similaridade para garantir que seja considerado
              document_id: doc.id
            });
          }
        }
      }
    }
    
    // Verificar novamente se temos documentos após o fallback
    if (relevantDocuments.length === 0) {
      console.log("ERRO: Nenhum documento relevante encontrado mesmo após fallback");
      
      if (language === 'pt') {
        return "Não encontrei documentos relevantes para responder à sua pergunta. Por favor, seja mais específico ou reformule sua pergunta.";
      } else {
        return "I couldn't find relevant documents to answer your question. Please be more specific or rephrase your question.";
      }
    }
    
    // Gerar resposta com base nos documentos relevantes
    const response = await generateRAGResponse(query, relevantDocuments, {
      language,
      model,
      userId,
      widgetId,
      forceExtraction
    });
    
    return response;
  } catch (error: any) {
    console.error('Erro no processamento RAG completo:', error);
    
    if (language === 'pt') {
      return `Ocorreu um erro ao processar sua consulta: ${error.message}`;
    } else {
      return `An error occurred while processing your query: ${error.message}`;
    }
  }
}

// Funções auxiliares

function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    return 0;
  }
  
  // Calcular produto escalar
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  // Evitar divisão por zero
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

function extractKeywords(query: string): string[] {
  // Lista de stopwords em português
  const stopwords = new Set([
    'a', 'ao', 'aos', 'aquela', 'aquelas', 'aquele', 'aqueles', 'aquilo', 'as', 'até',
    'com', 'como', 'da', 'das', 'de', 'dela', 'delas', 'dele', 'deles', 'depois',
    'do', 'dos', 'e', 'ela', 'elas', 'ele', 'eles', 'em', 'entre', 'era',
    'eram', 'éramos', 'essa', 'essas', 'esse', 'esses', 'esta', 'estas', 'este',
    'estes', 'eu', 'foi', 'fomos', 'for', 'foram', 'fosse', 'fossem', 'fui', 'há',
    'isso', 'isto', 'já', 'lhe', 'lhes', 'mais', 'mas', 'me', 'mesmo', 'meu',
    'meus', 'minha', 'minhas', 'muito', 'na', 'não', 'nas', 'nem', 'no', 'nos',
    'nós', 'nossa', 'nossas', 'nosso', 'nossos', 'num', 'numa', 'o', 'os', 'ou',
    'para', 'pela', 'pelas', 'pelo', 'pelos', 'por', 'qual', 'quando', 'que', 'quem',
    'são', 'se', 'seja', 'sejam', 'sem', 'será', 'seu', 'seus', 'sua', 'suas',
    'também', 'te', 'tem', 'tém', 'temos', 'tenho', 'teu', 'teus', 'tu', 'tua',
    'tuas', 'um', 'uma', 'você', 'vocês', 'vos'
  ]);
  
  // Remover pontuação e converter para minúsculas
  const cleanQuery = query.toLowerCase().replace(/[^\wáàâãéèêíïóôõöúüçñ\s]/g, '');
  
  // Dividir em palavras e filtrar stopwords
  const words = cleanQuery.split(/\s+/)
    .filter(word => word.length > 2) // Ignorar palavras muito curtas
    .filter(word => !stopwords.has(word));
  
  // Remover duplicatas usando Array.from para compatibilidade com TS
  return Array.from(new Set(words));
}

/**
 * Extrai tópicos relevantes de uma consulta do usuário usando LLM
 * Esta função analisa semanticamente a consulta para identificar tópicos principais
 */
export async function extractQueryTopics(query: string): Promise<string[]> {
  try {
    // Obter configuração LLM
    const llmConfig = await storage.getActiveLlmConfig();
    if (!llmConfig) {
      console.error('Nenhuma configuração LLM ativa encontrada');
      return extractKeywords(query); // Fallback para método simples
    }
    
    // Determinar qual API usar
    const useOpenAI = llmConfig.model_name.startsWith('gpt-') || !llmConfig.model_name.startsWith('claude-');
    let apiKey = llmConfig.api_key || (useOpenAI ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY);
    
    if (!apiKey) {
      console.error('API key não disponível para extração de tópicos');
      return extractKeywords(query); // Fallback para método simples
    }
    
    // Limpar a chave da API
    apiKey = apiKey.trim();
    if (apiKey.startsWith('Bearer ')) {
      apiKey = apiKey.substring(7).trim();
    }
    
    const systemPrompt = `
      Você é um especialista em análise de consultas técnicas sobre eletrônica e placas de circuito.
      Identifique os 3-5 tópicos ou conceitos-chave mais relevantes nesta consulta.
      
      Regras:
      1. Extraia apenas tópicos técnicos relevantes (componentes, procedimentos, problemas específicos)
      2. Inclua termos específicos de produtos ou modelos quando presentes
      3. Inclua termos relevantes para manutenção e reparo
      4. IGNORE palavras genéricas como "como", "por que", etc.
      5. Retorne APENAS a lista de tópicos, um por linha, sem numeração ou pontuação
      6. NÃO inclua explicações ou comentários adicionais
    `;
    
    if (useOpenAI) {
      // Usar OpenAI para extração de tópicos
      const openai = new OpenAI({ apiKey });
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini", // Modelo mais leve para esta função secundária
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        temperature: 0.2 // Temperatura baixa para maior consistência
      });
      
      const content = response.choices[0]?.message?.content;
      if (content) {
        // Dividir por linhas e remover linhas vazias
        const topics = content.split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0);
        
        console.log('Tópicos extraídos (OpenAI):', topics);
        return topics;
      }
    } else {
      // Usar Anthropic para extração de tópicos
      const anthropic = new Anthropic({ apiKey });
      
      const message = await anthropic.messages.create({
        model: "claude-3-7-sonnet-20250219", // the newest Anthropic model
        max_tokens: 150,
        temperature: 0.2,
        system: systemPrompt,
        messages: [
          { role: 'user', content: query }
        ]
      });
      
      if (message.content[0] && typeof message.content[0] === 'object' && 'text' in message.content[0]) {
        const content = message.content[0].text;
        // Dividir por linhas e remover linhas vazias
        const topics = content.split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0);
        
        console.log('Tópicos extraídos (Claude):', topics);
        return topics;
      }
    }
    
    // Fallback para método baseado em palavras-chave
    console.log('Fallback para extração baseada em palavras-chave');
    return extractKeywords(query);
  } catch (error) {
    console.error('Erro ao extrair tópicos da consulta:', error);
    // Fallback para palavras-chave se algo falhar
    return extractKeywords(query);
  }
}

/**
 * Analisa a intenção de uma consulta do usuário
 * Esta função complementa a extração de tópicos com análise de intenção
 */
export async function analyzeQueryIntent(query: string, language: 'pt' | 'en' = 'pt'): Promise<string | null> {
  try {
    // Obter configuração LLM
    const llmConfig = await storage.getActiveLlmConfig();
    if (!llmConfig) {
      console.error('Nenhuma configuração LLM ativa encontrada');
      return null;
    }
    
    // Determinar qual API usar
    const useOpenAI = llmConfig.model_name.startsWith('gpt-') || !llmConfig.model_name.startsWith('claude-');
    let apiKey = llmConfig.api_key || (useOpenAI ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY);
    
    if (!apiKey) {
      console.error('API key não disponível para análise de intenção');
      return null;
    }
    
    // Limpar a chave da API
    apiKey = apiKey.trim();
    if (apiKey.startsWith('Bearer ')) {
      apiKey = apiKey.substring(7).trim();
    }
    
    const systemPrompt = language === 'pt' ? 
      `Analise a consulta do usuário e identifique sua intenção principal em UMA FRASE CURTA.
      Exemplo: "Como resolver problema de iPhone XR que não liga" → "Diagnóstico de falha de inicialização em iPhone XR"
      
      Identifique:
      - Problema técnico específico
      - Dispositivo/componente relevante
      - Contexto de reparo/manutenção
      
      Responda APENAS com a intenção, sem introdução ou explicação.` 
      :
      `Analyze the user query and identify the main intent in ONE SHORT SENTENCE.
      Example: "How to fix iPhone XR that won't turn on" → "Diagnosing startup failure in iPhone XR"
      
      Identify:
      - Specific technical issue
      - Relevant device/component
      - Repair/maintenance context
      
      Answer ONLY with the intent, no introduction or explanation.`;
    
    if (useOpenAI) {
      // Usar OpenAI para análise de intenção
      const openai = new OpenAI({ apiKey });
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini", // Modelo mais leve para esta função secundária
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        temperature: 0.2, // Temperatura baixa para maior consistência
        max_tokens: 100
      });
      
      return response.choices[0]?.message?.content || null;
    } else {
      // Usar Anthropic para análise de intenção
      const anthropic = new Anthropic({ apiKey });
      
      const message = await anthropic.messages.create({
        model: "claude-3-7-sonnet-20250219", // the newest Anthropic model
        max_tokens: 100,
        temperature: 0.2,
        system: systemPrompt,
        messages: [
          { role: 'user', content: query }
        ]
      });
      
      if (message.content[0] && typeof message.content[0] === 'object' && 'text' in message.content[0]) {
        return message.content[0].text || null;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Erro ao analisar intenção da consulta:', error);
    return null;
  }
}