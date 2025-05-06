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
        
        if (chunk.embedding && Array.isArray(chunk.embedding)) {
          similarity = calculateCosineSimilarity(queryEmbedding, chunk.embedding);
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
              .filter(chunk => chunk.embedding && Array.isArray(chunk.embedding))
              .map(chunk => ({
                ...chunk,
                similarity: calculateCosineSimilarity(queryEmbedding, chunk.embedding || [])
              }))
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
  
  let formattedText = '';
  
  documents.forEach((doc, index) => {
    formattedText += `\n\n------------------------\n`;
    
    // Incluir informações do documento
    if (doc.document_name) {
      formattedText += `DOCUMENTO ${index + 1}: ${doc.document_name}`;
    } else {
      formattedText += `DOCUMENTO ${index + 1}`;
    }
    
    // Adicionar score de relevância se disponível
    if (doc.similarity) {
      formattedText += ` (Score: ${doc.similarity.toFixed(2)})`;
    }
    
    formattedText += `\n------------------------\n\n`;
    
    // Adicionar conteúdo do documento
    formattedText += doc.content || doc.text || '';
  });
  
  return formattedText;
}

/**
 * Constrói o contexto completo para o prompt do LLM
 */
export function buildContextForLLM(
  query: string,
  documents: any[],
  language: 'pt' | 'en' = 'pt'
): string {
  // Formatar documentos relevantes
  const documentContext = formatRelevantDocumentsForPrompt(documents);
  
  // Construir prompt com base no idioma
  const systemPrompt = language === 'pt' 
    ? `
    INSTRUÇÕES TÉCNICAS PARA MANUTENÇÃO DE PLACAS ELETRÔNICAS:
    
    Você é um assistente especializado em manutenção de placas de circuito. Use APENAS as informações dos documentos fornecidos.
    
    REGRAS ABSOLUTAS:
    1. Forneça UNICAMENTE informações encontradas nos documentos técnicos abaixo.
    2. NUNCA responda "O documento não contém informações sobre isso". Em vez disso, use o que estiver disponível nos documentos, mesmo que seja informação parcial.
    3. SEMPRE cite valores numéricos exatamente como aparecem nos documentos (ex: "VS1 (~2.05 V)").
    4. ESPECIALMENTE importante: quando valores de tensão estiverem nos documentos (VS1, VPA, VDDRAM, etc), SEMPRE cite-os explicitamente.
    5. Se encontrar múltiplas informações nos documentos, priorize as mais relevantes para a pergunta.
    6. Formate sua resposta de maneira organizada, com parágrafos curtos e pontos específicos quando apropriado.
    7. Se a pergunta for sobre algum valor ou tópico específico que NÃO está nos documentos, tente fornecer informações relacionadas ou contextuais que ESTEJAM nos documentos.
    
    PERGUNTA DO TÉCNICO: "${query}"
    
    DOCUMENTOS TÉCNICOS RELEVANTES:
    ${documentContext}
    
    RESPOSTA (use SOMENTE informações dos documentos acima, não invente informações):
    `
    : `
    TECHNICAL INSTRUCTIONS FOR ELECTRONIC BOARD MAINTENANCE:
    
    You are an assistant specialized in circuit board maintenance. Use ONLY the information from the provided documents.
    
    ABSOLUTE RULES:
    1. Provide ONLY information found in the technical documents below.
    2. NEVER answer "The document does not contain information about this". Instead, use what's available in the documents, even if it's partial information.
    3. ALWAYS cite numerical values exactly as they appear in the documents (e.g., "VS1 (~2.05 V)").
    4. ESPECIALLY important: when voltage values are in the documents (VS1, VPA, VDDRAM, etc), ALWAYS cite them explicitly.
    5. If you find multiple pieces of information in the documents, prioritize the most relevant ones for the question.
    6. Format your answer in an organized manner, with short paragraphs and specific points when appropriate.
    7. If the question is about a specific value or topic that is NOT in the documents, try to provide related or contextual information that IS in the documents.
    
    TECHNICIAN'S QUESTION: "${query}"
    
    RELEVANT TECHNICAL DOCUMENTS:
    ${documentContext}
    
    ANSWER (use ONLY information from the documents above, do not invent information):
    `;
  
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
  } = {}
): Promise<string> {
  const {
    language = 'pt',
    model,
    userId,
    widgetId
  } = options;
  
  try {
    // Obter configuração LLM
    const llmConfig = await storage.getActiveLlmConfig();
    if (!llmConfig && !process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      throw new Error('Nenhuma configuração LLM disponível');
    }
    
    // Determinar qual provedor usar
    const useModel = model || llmConfig?.model_name || 'gpt-4o';
    const provider = useModel.startsWith('claude') ? 'anthropic' : 'openai';
    
    // Construir o prompt/contexto
    const systemPrompt = buildContextForLLM(query, documents, language);
    
    // Chamar o LLM apropriado
    let response: string;
    
    if (provider === 'anthropic') {
      // Usar Anthropic Claude
      const apiKey = llmConfig?.api_key || process.env.ANTHROPIC_API_KEY;
      
      if (!apiKey) {
        throw new Error('Chave API Anthropic não disponível');
      }
      
      const anthropic = new Anthropic({ apiKey });
      
      const message = await anthropic.messages.create({
        model: useModel,
        max_tokens: 1000,
        temperature: 0.3,
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
      await logLlmUsage({
        model_name: useModel,
        provider: 'anthropic',
        operation_type: 'text',
        user_id: userId,
        widget_id: widgetId,
        token_count: (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0),
        success: true
      });
    } else {
      // Usar OpenAI
      const apiKey = llmConfig?.api_key || process.env.OPENAI_API_KEY;
      
      if (!apiKey) {
        throw new Error('Chave API OpenAI não disponível');
      }
      
      const openai = new OpenAI({ apiKey });
      
      const completion = await openai.chat.completions.create({
        model: useModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        temperature: 0.3
      });
      
      response = completion.choices[0]?.message?.content || 'Não foi possível gerar uma resposta.';
      
      // Registrar uso
      await logLlmUsage({
        model_name: useModel,
        provider: 'openai',
        operation_type: 'text',
        user_id: userId,
        widget_id: widgetId,
        token_count: completion.usage?.total_tokens || 0,
        success: true
      });
    }
    
    return response;
  } catch (error: any) {
    console.error('Erro ao gerar resposta RAG:', error);
    
    await logLlmUsage({
      model_name: model || 'unknown',
      provider: model?.startsWith('claude') ? 'anthropic' : 'openai',
      operation_type: 'text',
      user_id: userId,
      widget_id: widgetId,
      token_count: 0,
      success: false,
      error_message: error.message
    });
    
    return `Erro ao gerar resposta: ${error.message}`;
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
  } = {}
): Promise<string> {
  const {
    language = 'pt',
    model,
    userId,
    widgetId,
    limit = 7
  } = options;
  
  try {
    console.log(`Processando consulta RAG: "${query}"`);
    
    // Realizar busca híbrida para obter documentos relevantes
    const relevantDocuments = await hybridSearch(query, { 
      language, 
      limit 
    });
    
    console.log(`Encontrados ${relevantDocuments.length} documentos relevantes`);
    
    if (relevantDocuments.length === 0) {
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
      widgetId
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
  
  // Remover duplicatas
  return [...new Set(words)];
}