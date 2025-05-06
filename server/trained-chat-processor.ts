import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { logLlmUsage } from './llm';
import { storage } from './storage';

/**
 * Processa uma mensagem de chat garantindo que documentos de treinamento sejam usados
 * para responder à consulta do usuário.
 * 
 * @param message A mensagem do usuário
 * @param userId ID do usuário (opcional)
 * @param widgetId ID do widget (opcional) 
 * @param useDocuments Se deve usar documentos (default true)
 */
export async function processChatWithTrainedDocuments(
  message: string,
  userId?: number,
  widgetId?: string,
  useDocuments: boolean = true
): Promise<string> {
  try {
    console.log('Processando mensagem com documentos de treinamento');
    console.log(`useDocuments: ${useDocuments}, userId: ${userId}, widgetId: ${widgetId}`);
    
    // Obter configuração LLM ativa
    const llmConfig = await storage.getActiveLlmConfig();
    if (!llmConfig) {
      throw new Error('Nenhuma configuração LLM ativa encontrada');
    }
    
    // Verificar se devemos usar treinamento e se temos documentos
    if (!useDocuments || llmConfig.should_use_training === false) {
      console.log('Treinamento desativado, usando apenas LLM sem documentos');
      return await processRegularChat(message, llmConfig, userId, widgetId);
    }
    
    // Buscar todos os documentos de treinamento
    console.log('Buscando documentos de treinamento para consulta');
    const documents = await storage.getTrainingDocuments();
    if (!documents || documents.length === 0) {
      console.log('Nenhum documento de treinamento encontrado, usando LLM padrão');
      return await processRegularChat(message, llmConfig, userId, widgetId);
    }
    
    console.log(`Encontrados ${documents.length} documentos de treinamento`);
    
    // Preparar o contexto com o conteúdo dos documentos
    let documentContext = '';
    let documentCount = 0;
    
    // Incluir conteúdo de todos os documentos no contexto (dentro do limite de tokens)
    for (const doc of documents) {
      if (doc.content && doc.content.trim()) {
        // Adicionar separador e metadados do documento
        documentContext += `\n\n--- DOCUMENTO ${documentCount + 1}: ${doc.name} ---\n\n`;
        documentContext += doc.content.trim();
        documentCount++;
      }
    }
    
    if (documentCount === 0) {
      console.log('Nenhum documento com conteúdo válido encontrado, usando LLM padrão');
      return await processRegularChat(message, llmConfig, userId, widgetId);
    }
    
    console.log(`Usando ${documentCount} documentos para responder à consulta`);
    
    // Construir o prompt com instruções rígidas para usar documentos
    const systemPrompt = `
    Você é um assistente especializado em manutenção de placas de circuito, com conhecimento em eletrônica.
    
    INSTRUÇÕES CRÍTICAS:
    1. Você DEVE responder EXCLUSIVAMENTE com base nas informações presentes nos DOCUMENTOS fornecidos abaixo.
    2. Se a informação NÃO estiver nos documentos, responda: "Não encontrei informações sobre isso nos documentos disponíveis."
    3. NUNCA invente informações ou use seu conhecimento prévio para responder.
    4. Seja preciso e cite diretamente os documentos em sua resposta quando possível.
    5. Se encontrar valores numéricos nos documentos (como tensões, volts), mencione-os exatamente como aparecem nos documentos.
    6. Se um documento mencionar termos técnicos como VS1, VPA, VCORE, etc., priorize essas informações na resposta.
    
    A seguir estão os documentos com informações técnicas para consulta:
    ${documentContext}
    `;
    
    // Determinar qual provedor usar com base no modelo configurado
    const provider = llmConfig.model_name.startsWith('gpt') ? 'openai' : 'anthropic';
    const modelName = llmConfig.model_name;
    
    // Usar a API apropriada para responder
    let response: string;
    
    if (provider === 'openai') {
      response = await processWithOpenAI(
        systemPrompt,
        message,
        modelName,
        llmConfig.api_key,
        userId,
        widgetId
      );
    } else {
      response = await processWithAnthropic(
        systemPrompt,
        message,
        modelName,
        llmConfig.api_key,
        userId,
        widgetId
      );
    }
    
    console.log('Resposta gerada com documentos de treinamento');
    return response;
    
  } catch (error: any) {
    console.error('Erro ao processar mensagem com documentos:', error);
    return `Ocorreu um erro ao processar sua mensagem: ${error.message}`;
  }
}

/**
 * Processa um chat com OpenAI
 */
async function processWithOpenAI(
  systemPrompt: string,
  userMessage: string,
  modelName: string,
  apiKey: string,
  userId?: number,
  widgetId?: string
): Promise<string> {
  try {
    // Verificar se a chave API está disponível
    if (!apiKey) {
      if (process.env.OPENAI_API_KEY) {
        console.log('Usando chave OpenAI do ambiente como fallback');
        apiKey = process.env.OPENAI_API_KEY;
      } else {
        throw new Error('Chave API OpenAI não disponível');
      }
    }
    
    // Inicializar cliente OpenAI
    const openai = new OpenAI({ apiKey });
    
    // Realizar a chamada à API
    const completion = await openai.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.3 // Baixo para respostas mais precisas e focadas no conteúdo dos documentos
    });
    
    // Extrair a resposta do modelo
    const response = completion.choices[0]?.message?.content || 'Não foi possível gerar uma resposta.';
    
    // Registrar o uso do LLM
    await logLlmUsage(
      modelName,
      'text',
      true,
      userId,
      widgetId,
      completion.usage?.total_tokens || 0
    );
    
    return response;
  } catch (error: any) {
    console.error('Erro ao processar com OpenAI:', error);
    
    // Registrar o erro
    await logLlmUsage(
      modelName,
      'text',
      false,
      userId,
      widgetId,
      0,
      error.message
    );
    
    throw error;
  }
}

/**
 * Processa um chat com Anthropic
 */
async function processWithAnthropic(
  systemPrompt: string,
  userMessage: string,
  modelName: string,
  apiKey: string,
  userId?: number,
  widgetId?: string
): Promise<string> {
  try {
    // Verificar se a chave API está disponível
    if (!apiKey) {
      if (process.env.ANTHROPIC_API_KEY) {
        console.log('Usando chave Anthropic do ambiente como fallback');
        apiKey = process.env.ANTHROPIC_API_KEY;
      } else {
        throw new Error('Chave API Anthropic não disponível');
      }
    }
    
    // Inicializar cliente Anthropic
    const anthropic = new Anthropic({ apiKey });
    
    // Realizar a chamada à API
    const message = await anthropic.messages.create({
      model: modelName,
      max_tokens: 1000,
      temperature: 0.3, // Baixo para respostas mais precisas
      system: systemPrompt,
      messages: [
        { role: 'user', content: userMessage }
      ]
    });
    
    // Extrair texto da resposta da Anthropic
    let response = 'Não foi possível gerar uma resposta.';
    if (message.content[0] && typeof message.content[0] === 'object' && 'text' in message.content[0]) {
      response = message.content[0].text;
    }
    
    // Registrar o uso do LLM
    await logLlmUsage(
      modelName,
      'text',
      true,
      userId,
      widgetId,
      message.usage?.input_tokens || 0 + message.usage?.output_tokens || 0
    );
    
    return response;
  } catch (error: any) {
    console.error('Erro ao processar com Anthropic:', error);
    
    // Registrar o erro
    await logLlmUsage(
      modelName,
      'text',
      false,
      userId,
      widgetId,
      0,
      error.message
    );
    
    throw error;
  }
}

/**
 * Processa um chat regular sem documentos de treinamento
 */
async function processRegularChat(
  message: string,
  llmConfig: any,
  userId?: number,
  widgetId?: string
): Promise<string> {
  try {
    // Verificar qual provedor usar
    const provider = llmConfig.model_name.startsWith('gpt') ? 'openai' : 'anthropic';
    const modelName = llmConfig.model_name;
    const apiKey = llmConfig.api_key;
    
    // Prompt padrão para modo sem documentos
    const systemPrompt = `
    Você é um assistente especializado em manutenção de placas de circuito, com conhecimento em eletrônica.
    Responda às perguntas do usuário com base em seu conhecimento geral.
    `;
    
    // Usar o provedor apropriado
    if (provider === 'openai') {
      return await processWithOpenAI(
        systemPrompt,
        message,
        modelName,
        apiKey,
        userId,
        widgetId
      );
    } else {
      return await processWithAnthropic(
        systemPrompt,
        message,
        modelName,
        apiKey,
        userId,
        widgetId
      );
    }
  } catch (error: any) {
    console.error('Erro ao processar chat regular:', error);
    return `Ocorreu um erro ao processar sua mensagem: ${error.message}`;
  }
}