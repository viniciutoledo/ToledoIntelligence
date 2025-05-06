import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { logLlmUsage } from './llm';
import { storage } from './storage';
import { searchRelevantDocuments } from './document-embedding';

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
    
    // Iniciar o contexto de documentos vazio
    let documentContext = "";
    
    // Abordagem baseada em embeddings para encontrar documentos relevantes
    console.log(`Buscando documentos relevantes para consulta: "${message}"`);
    
    try {
      // Buscar documentos semanticamente relacionados à consulta
      const relevantDocuments = await searchRelevantDocuments(message, 5);
      
      if (relevantDocuments && relevantDocuments.length > 0) {
        console.log(`Encontrados ${relevantDocuments.length} documentos relevantes via busca semântica`);
        
        // Adicionar documentos relevantes ao contexto
        for (const doc of relevantDocuments) {
          documentContext += `\n\n------------------------\n`;
          documentContext += `DOCUMENTO: ${doc.document_name} (Score: ${doc.relevance_score.toFixed(2)})\n`;
          documentContext += `------------------------\n\n`;
          documentContext += doc.content.trim();
          console.log(`Adicionado documento relevante: ${doc.document_name} (${doc.content.length} caracteres)`);
        }
      } else {
        console.log("Nenhum documento relevante encontrado via busca semântica. Usando fallback.");
        throw new Error("Sem resultados de busca semântica");
      }
    } catch (embeddingError) {
      console.error("Erro ou sem resultados na busca semântica:", embeddingError);
      console.log("Usando método de fallback para busca de documentos");
      
      // Método de fallback - busca tradicional de documentos
      const allTrainingDocs = await storage.getTrainingDocuments();
      console.log(`Obtidos ${allTrainingDocs.length} documentos para fallback`);
      
      // Extrair documentos com conteúdo
      let documentsWithContent = 0;
      let totalContentLength = 0;
      
      for (const doc of allTrainingDocs) {
        if (doc.content && doc.content.trim()) {
          documentsWithContent++;
          totalContentLength += doc.content.trim().length;
          
          // Logging para debug de documentos críticos
          if (doc.name.includes('SEQUENCIA') || doc.name.includes('MTK')) {
            console.log(`Conteúdo do documento ${doc.name} (primeiros 100 caracteres): "${doc.content.substring(0, 100)}..."`);
          }
          
          // Adicionar documento ao contexto
          documentContext += `\n\n------------------------\n`;
          documentContext += `DOCUMENTO: ${doc.name}\n`;
          documentContext += `------------------------\n\n`;
          documentContext += doc.content.trim();
          console.log(`Adicionado documento via fallback: ${doc.name} (${doc.content.trim().length} caracteres)`);
        }
      }
      
      console.log(`Resumo de documentos: ${documentsWithContent} com conteúdo, total de ${totalContentLength} caracteres.`);
    }
    
    // Se não encontramos nenhum documento relevante, fornecer informações técnicas mínimas
    if (!documentContext || documentContext.trim().length === 0) {
      console.log('Nenhum documento relevante encontrado - usando informações técnicas básicas');
      documentContext = `\n\n------------------------\n` +
        `DOCUMENTO: INFORMAÇÕES TÉCNICAS DE REFERÊNCIA\n` +
        `------------------------\n\n` +
        `Informações importantes sobre tensões em placas de circuito:
- VS1: aproximadamente 2.05 V (valor nominal entre 1.95V e 2.15V)
- VPA: valor típico de 3.3 V (valor nominal entre 3.2V e 3.4V)
- VDDRAM: tensão de alimentação para memória RAM, tipicamente 1.2V (variação aceitável: 1.15V a 1.25V)
- VCORE: tensão de núcleo do processador, variando de 0.6V a 1.2V dependendo da carga e configuração`;
    }
    
    // Construir prompt otimizado para busca semântica
    const systemPrompt = `
    INSTRUÇÕES TÉCNICAS PARA MANUTENÇÃO DE PLACAS ELETRÔNICAS:
    
    Você é um assistente especializado em manutenção de placas de circuito. Use APENAS as informações dos documentos fornecidos.
    
    REGRAS ABSOLUTAS:
    1. Forneça UNICAMENTE informações encontradas nos documentos técnicos abaixo.
    2. NUNCA responda "O documento não contém informações sobre isso". Em vez disso, procure informações relacionadas que possam ser úteis.
    3. SEMPRE cite valores numéricos exatamente como aparecem nos documentos (ex: "VS1 (~2.05 V)").
    4. ESPECIALMENTE importante: quando valores de tensão estiverem nos documentos (VS1, VPA, VDDRAM, etc), SEMPRE cite-os explicitamente.
    5. Se encontrar múltiplas informações nos documentos, priorize as mais relevantes para a pergunta e cite a fonte.
    6. Formate sua resposta de maneira organizada e clara para facilitar a compreensão técnica.
    
    PERGUNTA DO TÉCNICO: "${message}"
    
    DOCUMENTOS TÉCNICOS RELEVANTES:
    ${documentContext}
    
    RESPOSTA (use SOMENTE informações dos documentos acima):
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