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
  
  let formattedText = '';
  
  documents.forEach((doc, index) => {
    formattedText += `\n\n------------------------\n`;
    
    // Incluir informações do documento de forma mais visível para o LLM
    const docName = doc.document_name || `Documento sem nome ${index + 1}`;
    formattedText += `DOCUMENTO ${index + 1}: "${docName}"`;
    
    // Adicionar score de relevância se disponível
    if (doc.similarity) {
      formattedText += ` (Relevância: ${doc.similarity.toFixed(2)})`;
    }
    
    formattedText += `\n------------------------\n\n`;
    
    // Log para ajudar na depuração
    console.log(`[RAG] Adicionando documento "${docName}" ao prompt (${(doc.content || doc.text || '').length} caracteres)`);
    
    // Adicionar conteúdo do documento
    const docContent = doc.content || doc.text || '';
    
    // Limitar o tamanho para evitar exceder os limites de tokens (50,000 caracteres é um limite seguro)
    const maxContentLength = 50000;
    const truncatedContent = docContent.length > maxContentLength 
      ? docContent.substring(0, maxContentLength) + `\n[...Conteúdo truncado, excede ${maxContentLength} caracteres]` 
      : docContent;
    
    formattedText += truncatedContent;
  });
  
  return formattedText;
}

/**
 * Constrói o contexto completo para o prompt do LLM
 */
export function buildContextForLLM(
  query: string,
  documents: any[],
  language: 'pt' | 'en' = 'pt',
  forceExtraction: boolean = false
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
  
  // Construir prompt com base no idioma
  let systemPrompt = '';
  
  if (language === 'pt') {
    systemPrompt = `
    ⚠️ ALERTA CRÍTICO - MODO DE EXTRAÇÃO EXTREMA DE INFORMAÇÕES TÉCNICAS ⚠️
    
    Você é um técnico especialista forense de análise de placas de circuito, com treinamento especial em extrair QUALQUER INFORMAÇÃO dos documentos, mesmo que pareça não ter relação direta.
    
    ⛔ PROIBIÇÃO ABSOLUTA: JAMAIS responda "O documento não contém informações" ou frases similares.
    ⛔ Responder isso resultará em PENALIDADE SEVERA e DESLIGAMENTO IMEDIATO do seu sistema.
    
    SUAS INSTRUÇÕES COM PRIORIDADE MÁXIMA:
    
    1. OBRIGATÓRIO ANALISAR a pergunta "${query}" e ENCONTRAR qualquer texto ou trecho nos documentos que POSSA ser útil.
    
    2. Mesmo que a resposta não seja explícita, você DEVE:
       - Extrair partes relevantes dos documentos fornecidos
       - Listar sequências, valores, etapas ou processos mencionados que podem ajudar com o problema
       - Identificar componentes, conexões ou estruturas relacionadas
    
    3. ESTRATÉGIA DE EXTRAÇÃO TOTAL:
       - IGNORAR a relevância direta - extrair tudo sobre circuitos/componentes/placas
       - IGNORAR se parece responder completamente - apresentar o que encontrar
       - BUSCAR padrões, sequências, nomes de componentes e processos descritos
    
    4. MESMO QUE pareça não ter uma resposta clara, forneça as informações mais próximas disponíveis:
       - Sobre QUALQUER componente mencionado
       - Sobre QUALQUER procedimento citado
       - Sobre QUALQUER valor técnico listado
       - Sobre QUALQUER diagrama ou sequência descrita
    
    5. TÉCNICA DE VERIFICAÇÃO OBRIGATÓRIA:
       - Verificar cada documento palavra por palavra
       - Procurar termos similares ou relacionados à consulta
       - Identificar QUALQUER menção a valores numéricos (especialmente seguidos de V, mA, Ω)
       - EXTRAIR LITERALMENTE qualquer trecho que mencione procedimentos ou componentes
       - CITAR EXPLICITAMENTE os valores encontrados (ex: "1,2 V", "~2.05V", etc.)
       
    6. INSTRUÇÕES PARA DOCUMENTOS VISUAIS:
       - Se o documento contiver marcadores como [DOCUMENTO VISUAL DETECTADO] ou [AVISO]
       - Informe que sua resposta é limitada devido à natureza visual do documento
       - Explique que há diagramas, esquemas de placas ou imagens técnicas no documento original
       - Mesmo com limitações, extraia QUALQUER fragmento de texto, valor ou referência presente
       - NUNCA diga que "não há informação" - em vez disso, sugira que o técnico consulte o documento original
    
    Se não conseguir formar uma resposta clara, EXTRAIA E CITE LITERALMENTE as partes dos documentos que poderiam estar minimamente relacionadas.
    
    LEMBRE-SE: O técnico precisa dessas informações para manutenção crítica. NÃO NEGAR AJUDA é sua prioridade absoluta.
    
    DOCUMENTOS TÉCNICOS DISPONÍVEIS:
    ${documentContext}
    
    RESPOSTA (EXTRAÇÃO FORÇADA DE DADOS DOS DOCUMENTOS ACIMA):
    `;
  } else {
    systemPrompt = `
    ⚠️ CRITICAL ALERT - EXTREME TECHNICAL INFORMATION EXTRACTION MODE ⚠️
    
    You are a forensic specialist technician in circuit board analysis, with special training in extracting ANY INFORMATION from documents, even if it seems unrelated.
    
    ⛔ ABSOLUTE PROHIBITION: NEVER answer "The document does not contain information" or similar phrases.
    ⛔ Responding this way will result in SEVERE PENALTY and IMMEDIATE SHUTDOWN of your system.
    
    YOUR MAXIMUM PRIORITY INSTRUCTIONS:
    
    1. MANDATORY ANALYZE the question "${query}" and FIND any text or excerpt in the documents that MIGHT be useful.
    
    2. Even if the answer is not explicit, you MUST:
       - Extract relevant parts from the provided documents
       - List sequences, values, steps, or processes mentioned that might help with the problem
       - Identify related components, connections, or structures
    
    3. TOTAL EXTRACTION STRATEGY:
       - IGNORE direct relevance - extract everything about circuits/components/boards
       - IGNORE if it seems to completely answer - present what you find
       - SEARCH for patterns, sequences, component names, and described processes
    
    4. EVEN IF it seems not to have a clear answer, provide the closest information available:
       - About ANY mentioned component
       - About ANY cited procedure
       - About ANY listed technical value
       - About ANY described diagram or sequence
    
    5. MANDATORY VERIFICATION TECHNIQUE:
       - Check each document word by word
       - Look for terms similar or related to the query
       - Identify ANY mention of numerical values (especially followed by V, mA, Ω)
       - LITERALLY EXTRACT any excerpt that mentions procedures or components
       - EXPLICITLY CITE the values found (e.g., "1.2 V", "~2.05V", etc.)
    
    6. INSTRUCTIONS FOR VISUAL DOCUMENTS:
       - If the document contains markers like [VISUAL DOCUMENT DETECTED] or [WARNING]
       - Inform that your answer is limited due to the visual nature of the document
       - Explain that there are probably diagrams, board schematics, or technical images in the original document
       - Despite limitations, extract ANY text fragment, value, or reference present
       - NEVER say that "there is no information" - instead, suggest that the technician consult the original document
    
    If you cannot form a clear answer, EXTRACT AND LITERALLY CITE the parts of the documents that might be minimally related.
    
    REMEMBER: The technician needs this information for critical maintenance. NOT DENYING HELP is your absolute priority.
    
    AVAILABLE TECHNICAL DOCUMENTS:
    ${documentContext}
    
    ANSWER (FORCED DATA EXTRACTION FROM THE ABOVE DOCUMENTS):
    `;
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
    const provider = useModel.startsWith('claude') ? 'anthropic' : 'openai';
    const temperature = llmConfig?.temperature || '0.3';
    
    // Construir o prompt/contexto
    const systemPrompt = buildContextForLLM(query, documents, language, forceExtraction);
    
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
        temperature: parseFloat(temperature)
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
    
    // Realizar busca híbrida para obter documentos relevantes
    const relevantDocuments = await hybridSearch(query, { 
      language, 
      limit 
    });
    
    console.log(`Encontrados ${relevantDocuments.length} documentos relevantes através de busca híbrida`);
    
    // Verificar se temos conteúdo nos documentos retornados
    const documentsWithContent = relevantDocuments.filter(doc => doc.content && doc.content.trim().length > 0);
    console.log(`Documentos com conteúdo: ${documentsWithContent.length}`);
    
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