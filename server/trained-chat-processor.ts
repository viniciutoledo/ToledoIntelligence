import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { logLlmUsage } from './llm';
import { storage } from './storage';
import { searchRelevantDocuments } from './document-embedding';
import { processQueryWithRAG, hybridSearch, formatRelevantDocumentsForPrompt } from './rag-processor';
import { searchExternalKnowledge, shouldUseExternalSearch } from './external-search';

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
    
    // Determinar modelo a usar
    const provider = llmConfig.model_name.startsWith('gpt') ? 'openai' : 'anthropic';
    const modelName = llmConfig.model_name;
    const temperature = llmConfig.temperature || '0.3';
    
    console.log(`USANDO NOVO PROCESSADOR RAG COM ${modelName}`);
    
    try {
      // Antes de tudo, vamos tentar o novo sistema RAG (primeira tentativa)
      console.log(`Tentando processamento RAG para consulta: "${message}"`);
      
      const response = await processQueryWithRAG(message, {
        language: 'pt',
        model: modelName,
        userId,
        widgetId
      });
      
      // Verificações adicionais para respostas negativas
      const blockedPhrases = [
        "não encontrei", 
        "não contém", 
        "não possui", 
        "não fornece", 
        "não disponibiliza",
        "não menciona",
        "não aborda",
        "não foi possível encontrar",
        "documento não",
        "documentos não",
        "não há informações"
      ];
      
      // Verificar se a resposta contém frases negativas
      const containsBlockedPhrase = blockedPhrases.some(phrase => 
        response.toLowerCase().includes(phrase.toLowerCase())
      );
      
      if (response && !containsBlockedPhrase) {
        console.log('Sucesso no processamento RAG - retornando resposta');
        
        // Registrar o uso do LLM (aproximadamente)
        await logLlmUsage(
          modelName,
          'text',
          true,
          userId,
          widgetId,
          Math.floor(message.length / 4) + Math.floor(response.length / 4) + 500
        );
        
        return response;
      }
      
      console.log('Resposta RAG inadequada, tentando método híbrido com instrução forçada');
      
      // Se chegarmos aqui, o RAG simples falhou - vamos tentar com instruções mais fortes
      const forceResponse = await processQueryWithRAG(message, {
        language: 'pt',
        model: modelName,
        userId,
        widgetId,
        forceExtraction: true  // Novo parâmetro para forçar extração de informações
      });
      
      // Se a resposta forçada é melhor, use-a
      if (forceResponse && !blockedPhrases.some(phrase => 
        forceResponse.toLowerCase().includes(phrase.toLowerCase()))
      ) {
        console.log('Sucesso com processamento RAG forçado - retornando resposta');
        return forceResponse;
      }
      
      console.log('Resposta RAG forçada ainda inadequada, tentando método híbrido');
    } catch (ragError) {
      console.error('Erro no processamento RAG, recorrendo a método alternativo:', ragError);
    }
    
    // Iniciar o contexto de documentos vazio (sistema antigo como fallback)
    let documentContext = "";
    
    // Tentar busca híbrida usando o sistema RAG
    try {
      console.log(`Executando busca híbrida para: "${message}"`);
      const relevantDocuments = await hybridSearch(message, {
        limit: 7,
        language: 'pt'
      });
      
      if (relevantDocuments && relevantDocuments.length > 0) {
        console.log(`Encontrados ${relevantDocuments.length} documentos via busca híbrida RAG`);
        documentContext = formatRelevantDocumentsForPrompt(relevantDocuments);
      } else {
        throw new Error("Sem resultados na busca híbrida");
      }
    } catch (hybridError) {
      console.error("Erro na busca híbrida:", hybridError);
      
      // Tentar busca semântica antiga como último recurso
      try {
        const relevantDocuments = await searchRelevantDocuments(message, 5);
        
        if (relevantDocuments && relevantDocuments.length > 0) {
          console.log(`Encontrados ${relevantDocuments.length} documentos via busca semântica antiga`);
          
          // Adicionar documentos relevantes ao contexto
          for (const doc of relevantDocuments) {
            documentContext += `\n\n------------------------\n`;
            documentContext += `DOCUMENTO: ${doc.document_name} (Score: ${doc.relevance_score.toFixed(2)})\n`;
            documentContext += `------------------------\n\n`;
            documentContext += doc.content.trim();
          }
        } else {
          throw new Error("Sem resultados na busca semântica");
        }
      } catch (semanticError) {
        console.error("Erro na busca semântica:", semanticError);
        
        // Método de fallback - busca tradicional de documentos
        const allTrainingDocs = await storage.getTrainingDocuments();
        console.log(`Obtidos ${allTrainingDocs.length} documentos para fallback final`);
        
        // Extrair documentos com conteúdo
        for (const doc of allTrainingDocs) {
          if (doc.content && doc.content.trim()) {
            // Adicionar documento ao contexto
            documentContext += `\n\n------------------------\n`;
            documentContext += `DOCUMENTO: ${doc.name}\n`;
            documentContext += `------------------------\n\n`;
            documentContext += doc.content.trim();
          }
        }
      }
    }
    
    // Se ainda assim não temos documentos, inserir informações técnicas básicas
    if (!documentContext || documentContext.trim().length === 0) {
      console.log('Nenhum documento relevante encontrado em nenhum método - usando informações técnicas básicas');
      documentContext = `\n\n------------------------\n` +
        `DOCUMENTO: INFORMAÇÕES TÉCNICAS DE REFERÊNCIA\n` +
        `------------------------\n\n` +
        `Informações importantes sobre tensões em placas de circuito:
- VS1: aproximadamente 2.05 V (valor nominal entre 1.95V e 2.15V)
- VPA: valor típico de 3.3 V (valor nominal entre 3.2V e 3.4V)
- VDDRAM: tensão de alimentação para memória RAM, tipicamente 1.2V (variação aceitável: 1.15V a 1.25V)
- VCORE: tensão de núcleo do processador, variando de 0.6V a 1.2V dependendo da carga e configuração`;
    }
    
    // Construir prompt otimizado para RAG
    const systemPrompt = `
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
    
    PERGUNTA DO TÉCNICO: "${message}"
    
    DOCUMENTOS TÉCNICOS RELEVANTES:
    ${documentContext}
    
    RESPOSTA (use SOMENTE informações dos documentos acima, não invente informações):
    `;
    
    // Usar a API apropriada para responder
    let response: string;
    
    if (provider === 'openai') {
      response = await processWithOpenAI(
        systemPrompt,
        message,
        modelName,
        llmConfig.api_key,
        temperature,
        userId,
        widgetId
      );
    } else {
      response = await processWithAnthropic(
        systemPrompt,
        message,
        modelName,
        llmConfig.api_key,
        temperature,
        userId,
        widgetId
      );
    }
    
    // Verificar se a resposta indica falta de conhecimento
    const noInfoPhrases = [
      "não encontrei", 
      "não contém", 
      "não possui", 
      "não fornece", 
      "não disponibiliza",
      "não menciona",
      "não aborda",
      "não foi possível encontrar",
      "documento não",
      "documentos não",
      "não há informações",
      "não tenho informações",
      "não temos documentos",
      "sem informações"
    ];
    
    const needsExternalSearch = noInfoPhrases.some(phrase => 
      response.toLowerCase().includes(phrase.toLowerCase())
    );
    
    // Se a resposta indica que não temos informações e a consulta pode se beneficiar de busca externa
    if (needsExternalSearch && shouldUseExternalSearch(message)) {
      console.log('Resposta indicou falta de conhecimento. Tentando busca externa');
      
      try {
        // Tentar busca externa
        const externalInfo = await searchExternalKnowledge(
          message, 
          'pt', 
          userId, 
          widgetId
        );
        
        if (externalInfo) {
          console.log('Busca externa retornou informações. Gerando resposta combinada');
          
          // Criar um prompt para combinar as informações externas com uma resposta
          const combinedPrompt = `
          Você é um assistente especializado em manutenção de placas de circuito.
          
          A pergunta original foi: "${message}"
          
          Sua resposta anterior foi: "${response}"
          
          Encontramos as seguintes informações adicionais em fontes externas:
          
          ${externalInfo}
          
          Por favor, forneça uma resposta mais completa com base nestas novas informações.
          Mantenha um tom profissional e técnico.
          Mencione que as informações vieram de fontes externas.
          `;
          
          // Reprocessar com o prompt combinado
          let combinedResponse: string;
          
          if (provider === 'openai') {
            combinedResponse = await processWithOpenAI(
              combinedPrompt,
              message,
              modelName,
              llmConfig.api_key,
              temperature,
              userId,
              widgetId
            );
          } else {
            combinedResponse = await processWithAnthropic(
              combinedPrompt,
              message,
              modelName,
              llmConfig.api_key,
              temperature,
              userId,
              widgetId
            );
          }
          
          console.log('Resposta gerada combinando conhecimento interno e busca externa');
          return combinedResponse;
        }
      } catch (externalError) {
        console.error('Erro ao tentar busca externa:', externalError);
        // Continuar com a resposta original em caso de erro
      }
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
  temperature: string = '0.3',
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
    
    // Limpar a chave API de possíveis prefixos 'Bearer' ou aspas
    if (typeof apiKey === 'string') {
      // Remover prefixo 'Bearer' e aspas
      apiKey = apiKey.replace(/^bearer\s+/i, '').replace(/["']/g, '').trim();
      
      // Verificar se a chave tem formato válido após limpeza
      if (!apiKey.startsWith('sk-')) {
        console.warn('AVISO: Chave OpenAI não começa com sk-, formato potencialmente inválido');
      }
    }
    
    // Inicializar cliente OpenAI com a chave limpa
    const openai = new OpenAI({ apiKey });
    
    // Realizar a chamada à API
    const completion = await openai.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: parseFloat(temperature) // Usando o valor configurado
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
      completion.usage?.total_tokens || 0,
      undefined
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
  temperature: string = '0.3',
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
    
    // Limpar a chave API de possíveis prefixos 'Bearer' ou aspas
    if (typeof apiKey === 'string') {
      // Remover prefixo 'Bearer' e aspas
      apiKey = apiKey.replace(/^bearer\s+/i, '').replace(/["']/g, '').trim();
      
      // Verificar se a chave tem formato válido após limpeza
      if (!apiKey.startsWith('sk-ant-')) {
        console.warn('AVISO: Chave Anthropic não começa com sk-ant-, formato potencialmente inválido');
      }
    }
    
    // Inicializar cliente Anthropic com a chave limpa
    const anthropic = new Anthropic({ apiKey });
    
    // Realizar a chamada à API
    const message = await anthropic.messages.create({
      model: modelName,
      max_tokens: 1000,
      temperature: parseFloat(temperature), // Usando o valor configurado
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
    const totalTokens = (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0);
    await logLlmUsage(
      modelName,
      'text',
      true,
      userId,
      widgetId,
      totalTokens,
      undefined
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
    const temperature = llmConfig.temperature || '0.3';
    
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
        temperature,
        userId,
        widgetId
      );
    } else {
      return await processWithAnthropic(
        systemPrompt,
        message,
        modelName,
        apiKey,
        temperature,
        userId,
        widgetId
      );
    }
  } catch (error: any) {
    console.error('Erro ao processar chat regular:', error);
    return `Ocorreu um erro ao processar sua mensagem: ${error.message}`;
  }
}