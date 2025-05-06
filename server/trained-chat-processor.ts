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
    
    // Vamos garantir que todos os documentos sejam analisados para qualquer tipo de consulta
    console.log(`Processando consulta de forma abrangente, garantindo uso completo dos documentos de treinamento`);
    
    // Extrair palavras-chave técnicas da mensagem do usuário para priorização (opcional)
    const userMessageWords = message.split(/\s+/).filter(word => word.length > 2);
    
    // Extrair todos os documentos de treinamento disponíveis no sistema
    const allTrainingDocs = await storage.getTrainingDocuments();
    
    console.log(`Carregando todos os ${allTrainingDocs.length} documentos de treinamento disponíveis`);
    
    // Garantir que todos os documentos estejam incluídos no contexto
    for (const doc of allTrainingDocs) {
      if (doc.content && doc.content.trim()) {
        // Adicionar clara separação com marcador e nome do documento para melhor contexto
        documentContext += `\n\n------------------------\n`;
        documentContext += `DOCUMENTO: ${doc.name}\n`;
        documentContext += `------------------------\n\n`;
        documentContext += doc.content.trim();
        console.log(`Adicionado documento completo: ${doc.name}`);
      }
    }
    
    // Construir um prompt muito mais efetivo para garantir aprendizado completo dos documentos
    const systemPrompt = `
    Você é um assistente especializado em manutenção de placas de circuito, com conhecimento em eletrônica.
    
    INSTRUÇÕES OBRIGATÓRIAS (CRITICAMENTE IMPORTANTES):
    1. Você DEVE responder com informações APENAS dos documentos de treinamento fornecidos abaixo.
    2. Quando um documento contiver informações técnicas (como valores de tensão, resistências, etc.), você DEVE citar esses valores exatamente, sem arredondar ou modificar.
    3. SEMPRE localize e mencione valores numéricos encontrados nos documentos, como "VS1 (~2.05 V)", "VCORE (0.6 V a 1.2 V)", etc.
    4. Quando encontrar qualquer tabela, lista ou dados estruturados nos documentos, mantenha a estrutura na sua resposta.
    5. Cite explicitamente o documento ou documentos de onde você extraiu a informação em sua resposta.
    6. Se não encontrar a resposta exata nos documentos, diga: "Com base nos documentos fornecidos, posso dizer que..." e compartilhe as informações relevantes que encontrou.
    7. NÃO invente informações que não estejam nos documentos. NÃO use seu conhecimento geral sobre placas de circuito ou eletrônica.
    
    MENSAGEM DO USUÁRIO: "${message}"
    
    A seguir estão TODOS os documentos de treinamento com informações técnicas para consulta:
    ${documentContext}
    
    LEMBRETE FINAL: Você está sendo avaliado pela sua precisão em usar EXCLUSIVAMENTE as informações dos documentos acima. Sua resposta deve conter uma citação direta dos documentos sempre que possível.
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