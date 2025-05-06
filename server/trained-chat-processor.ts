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
    
    // Verificar especificamente se o usuário está perguntando sobre VDDRAM
    const isVDDRAMQuery = message.toLowerCase().includes('vddram');
    const isVS1Query = message.toLowerCase().includes('vs1');
    const isVPAQuery = message.toLowerCase().includes('vpa');
    
    // Forçar busca específica por documentos de interesse
    console.log(`Processando consulta específica: VDDRAM=${isVDDRAMQuery}, VS1=${isVS1Query}, VPA=${isVPAQuery}`);
    
    // Pesquisar no banco de dados diretamente documentos que mencionam os termos técnicos
    const relevantDocs = await storage.searchTrainingDocuments([
      'VS1', 'VS1,', 'VS1:', 'VS1 ', 
      'VPA', 'VPA,', 'VPA:', 'VPA ', 
      'VDDRAM', 'VDDRAM,', 'VDDRAM:', 'VDDRAM '
    ]);
    
    console.log(`Encontrados ${relevantDocs.length} documentos relevantes para a consulta técnica`);
    
    // Adicionar documentos relevantes diretamente ao contexto se não estiverem já incluídos
    for (const doc of relevantDocs) {
      if (doc.content && doc.content.trim() && !documentContext.includes(doc.content)) {
        documentContext += `\n\n--- DOCUMENTO TÉCNICO: ${doc.name} ---\n\n`;
        documentContext += doc.content.trim();
        console.log(`Adicionado documento técnico relevante: ${doc.name}`);
      }
    }
    
    // Ajustar prompt para perguntas específicas
    let customInstructions = '';
    if (isVDDRAMQuery) {
      customInstructions = 'A pergunta é sobre VDDRAM. Verifique especificamente informações sobre tensões VDDRAM nos documentos.';
    } else if (isVS1Query) {
      customInstructions = 'A pergunta é sobre VS1. Verifique especificamente informações sobre a tensão VS1 nos documentos.';
    } else if (isVPAQuery) {
      customInstructions = 'A pergunta é sobre VPA. Verifique especificamente informações sobre a tensão VPA nos documentos.';
    }
    
    // Construir um prompt muito mais agressivo para forçar uso de documentos
    const systemPrompt = `
    Você é um assistente especializado em manutenção de placas de circuito, com conhecimento em eletrônica.
    
    INSTRUÇÕES OBRIGATÓRIAS (CRITICAMENTE IMPORTANTES):
    1. NUNCA diga "o documento não contém informações sobre isso". Em vez disso, diga exatamente o que encontrou nos documentos.
    2. Se os documentos contêm VS1, VPA, VCORE ou outras tensões, SEMPRE mencione esses valores na sua resposta.
    3. Forneça APENAS informações que estão explicitamente nos documentos abaixo. Não use seu conhecimento geral.
    4. Se você encontrar qualquer informação relevante para a pergunta nos documentos, mesmo que parcial, forneça essa informação.
    5. Os valores de tensão são informações CRÍTICAS - se mencionados nos documentos, você DEVE incluí-los na resposta.
    6. Se encontrar nos documentos: "VS1 (~2.05 V)" - você DEVE mencionar este valor na resposta.
    7. Se um documento mencionar "VDDRAM" com qualquer informação relacionada, você DEVE priorizar essa informação na resposta.
    
    ${customInstructions}
    
    A seguir estão os documentos com informações técnicas para consulta:
    ${documentContext}
    
    LEMBRETE FINAL: Sua resposta deve ser baseada EXCLUSIVAMENTE nos documentos acima. Se você não encontrar a informação específica, procure por informações relacionadas nos documentos que possam ajudar a responder a pergunta.
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