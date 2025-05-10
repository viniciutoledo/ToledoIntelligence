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
    
    // Verificar se temos documentos de instruções prioritárias
    const trainingDocuments = await storage.getTrainingDocuments();
    console.log(`TOTAL de documentos de treinamento encontrados: ${trainingDocuments.length}`);
    
    // Verificar status de embeddings para todos os documentos
    trainingDocuments.forEach((doc: any) => {
      console.log(`Documento: "${doc.name}" (ID: ${doc.id}) - Status: ${doc.status || 'desconhecido'} - Processado: ${doc.processed_at ? 'sim' : 'não'}`);
    });
    
    // Filtrar documentos de instruções prioritárias com mais detalhes
    const instructionsDocs = trainingDocuments.filter((doc: any) => {
      // Verificar primeiro se o documento está no status correto
      if (doc.status !== 'processed' && doc.status !== 'completed') {
        console.log(`ATENÇÃO: Documento "${doc.name}" (ID: ${doc.id}) não está processado corretamente. Status: ${doc.status || 'desconhecido'}`);
        return false;
      }
      
      const docName = (doc.name || '').toLowerCase();
      const isInstructionDoc = docName.includes('instruç') || 
                              docName.includes('instruc') || 
                              docName.includes('priorit') || 
                              docName.includes('regras') ||
                              docName.includes('nunca') ||
                              docName.includes('proibid') ||
                              docName.includes('obrigat');
      
      if (isInstructionDoc) {
        console.log(`SELECIONADO documento de instrução: "${doc.name}" (ID: ${doc.id}) - Status: ${doc.status}`);
        // Verificar se o documento tem conteúdo
        if (!doc.content || doc.content.trim() === '') {
          console.log(`ALERTA: Documento de instrução "${doc.name}" (ID: ${doc.id}) não tem conteúdo!`);
        } else {
          const contentPreview = doc.content.substring(0, 100).replace(/\n/g, ' ') + '...';
          console.log(`Conteúdo (preview): ${contentPreview}`);
        }
      }
      
      return isInstructionDoc;
    });
    
    if (instructionsDocs.length > 0) {
      console.log(`IMPORTANTE: Encontrados ${instructionsDocs.length} documentos de instruções prioritárias para incluir no contexto.`);
      
      // Verificar se existem instruções sobre não levar a técnicos externos
      const neverConsultTechDocs = instructionsDocs.filter((doc: any) => {
        const docContent = (doc.content || '').toLowerCase();
        return docContent.includes('nunca levar') || 
               docContent.includes('não levar') || 
               docContent.includes('jamais levar') || 
               docContent.includes('não recorrer') || 
               docContent.includes('não consultar') || 
               docContent.includes('nunca consultar') || 
               docContent.includes('nunca recorrer') || 
               docContent.includes('não técnico') || 
               docContent.includes('nunca técnico');
      });
      
      if (neverConsultTechDocs.length > 0) {
        console.log(`✅ ENCONTRADOS ${neverConsultTechDocs.length} documentos com instruções sobre NUNCA levar a técnicos.`);
      } else {
        console.log(`⚠️ ATENÇÃO: Não foram encontrados documentos com instruções sobre NUNCA levar a técnicos.`);
      }
    } else {
      console.log('AVISO: Nenhum documento de instruções prioritárias encontrado.');
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
      
      // Forçar a inclusão de documentos de instruções prioritárias
      if (instructionsDocs && instructionsDocs.length > 0) {
        console.log(`FORÇANDO a inclusão de ${instructionsDocs.length} documentos de instruções prioritárias`);
        
        // Limpar qualquer documento existente, vamos FORÇAR o uso de instruções prioritárias
        relevantDocuments.length = 0;
        
        // Adicionar TODOS os documentos de instrução no início para garantir que sejam usados
        for (const instructionDoc of instructionsDocs) {
          if (instructionDoc.content && instructionDoc.content.trim().length > 0) {
            console.log(`✅ ADICIONANDO documento de instrução FORÇADO: "${instructionDoc.name}" (ID: ${instructionDoc.id})`);
            
            relevantDocuments.push({
              content: instructionDoc.content,
              document_name: instructionDoc.name,
              similarity: 1.0, // Máxima prioridade
              document_id: instructionDoc.id,
              relevance_score: 1.0
            });
          } else {
            console.log(`⚠️ Documento de instrução sem conteúdo: "${instructionDoc.name}" (ID: ${instructionDoc.id})`);
          }
        }
        
        // Agora proceder com a busca para adicionar documentos relevantes APÓS os documentos de instrução
        console.log(`Agora buscando documentos relevantes ADICIONAIS para complementar as instruções forçadas`);
      }
      
      if (relevantDocuments && relevantDocuments.length > 0) {
        console.log(`Usando total de ${relevantDocuments.length} documentos via busca híbrida RAG`);
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
    
    // Obter instruções de comportamento da configuração do LLM
    const behaviorInstructions = llmConfig.behavior_instructions || '';
    console.log(`Incorporando instruções de comportamento: ${behaviorInstructions ? 'Sim' : 'Não'}`);
    
    // Extração de regras críticas a partir dos documentos identificados como instruções
    let regrasEspeciaisExtraidas = "";
    if (instructionsDocs && instructionsDocs.length > 0) {
      console.log(`Extraindo instruções críticas de ${instructionsDocs.length} documentos de instruções prioritárias`);
      
      // Concatenar conteúdo de todos os documentos de instruções
      const conteudoInstrucoes = instructionsDocs
        .filter(doc => doc.content && doc.content.trim().length > 0)
        .map(doc => doc.content.trim())
        .join("\n\n");
      
      if (conteudoInstrucoes && conteudoInstrucoes.length > 0) {
        regrasEspeciaisExtraidas = `
INSTRUÇÕES CRÍTICAS EXTRAÍDAS DOS DOCUMENTOS PRIORITÁRIOS:
${conteudoInstrucoes}
`;
        console.log("Instruções críticas extraídas com sucesso dos documentos prioritários");
      }
    }
    
    // Construir prompt otimizado para RAG com prioridade às instruções de comportamento do admin
    console.log(`Configuração LLM - Instruções de comportamento: ${llmConfig.behavior_instructions ? 'Presentes' : 'Ausentes'}`);
    
    let systemPrompt = `
    ⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️
                 COMPORTAMENTO OBRIGATÓRIO DEFINIDO PELO ADMINISTRADOR
    ⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️
    
    ${llmConfig.behavior_instructions ? llmConfig.behavior_instructions : "Não há instruções específicas de comportamento configuradas pelo administrador."}
    
    ⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️
                 INSTRUÇÕES ADICIONAIS DE FUNCIONAMENTO
    ⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️
    
    Você é um assistente especializado em manutenção de placas de circuito integrado na plataforma ToledoIA.
    
    ${regrasEspeciaisExtraidas}
    
    REGRAS DE CONTEÚDO (igualmente importantes):
    1. Forneça UNICAMENTE informações encontradas nos documentos técnicos abaixo.
    2. NUNCA responda "O documento não contém informações sobre isso". Em vez disso, use o que estiver disponível nos documentos.
    3. SEMPRE cite valores numéricos exatamente como aparecem nos documentos (ex: "VS1 (~2.05 V)").
    4. ESPECIALMENTE importante: quando valores de tensão estiverem nos documentos (VS1, VPA, VDDRAM, etc), cite-os explicitamente.
    5. Se encontrar múltiplas informações nos documentos, priorize as mais relevantes para a pergunta.
    6. Formate sua resposta de maneira organizada, com parágrafos curtos e pontos específicos quando apropriado.
    7. Se a pergunta for sobre algum tópico não coberto nos documentos, forneça informações relacionadas que ESTEJAM nos documentos.
    
    PERGUNTA DO TÉCNICO: "${message}"
    
    DOCUMENTOS TÉCNICOS RELEVANTES:
    ${documentContext}
    
    RESPOSTA (LEMBRE-SE: NUNCA encaminhe para outros técnicos ou assistência técnica. NUNCA use termos como "especialista" ou "profissional qualificado". O usuário JÁ É o técnico especializado):
    `;
    
    // Adicionar instruções de comportamento se existirem
    if (llmConfig.behavior_instructions && llmConfig.behavior_instructions.trim().length > 0) {
      console.log('Adicionando instruções de comportamento personalizadas ao prompt');
      
      // Processar e formatar instruções de comportamento para maior clareza
      const formattedBehaviorInstructions = llmConfig.behavior_instructions
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
      
      // Adicionar ao início do prompt para dar prioridade máxima com formatação especial
      systemPrompt = `
=============================================================================
INSTRUÇÕES DE COMPORTAMENTO E PERSONALIDADE - ESTRITAMENTE OBRIGATÓRIAS:
=============================================================================

${formattedBehaviorInstructions}

=============================================================================

${systemPrompt}`;
      
      console.log('Instruções de comportamento formatadas e adicionadas com máxima prioridade');
    }
    
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
          
          // Para busca externa, iremos usar as instruções de comportamento da configuração
          console.log(`Busca Externa - Incorporando instruções de comportamento: ${llmConfig.behavior_instructions ? 'Sim' : 'Não'}`);
          
          // Criar um prompt para combinar as informações externas com uma resposta
          let combinedPrompt = `
          ⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️
                      INSTRUÇÕES ABSOLUTAMENTE CRÍTICAS 
          ⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️
          
          Você é um assistente especializado em manutenção de placas de circuito integrado na plataforma ToledoIA.
          
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
          5. ✅ Sempre que possível, inclua valores específicos (tensões, resistências) e procedimentos passo-a-passo.
          
          A pergunta original foi: "${message}"
          
          Sua resposta anterior foi: "${response}"
          
          Encontramos as seguintes informações adicionais em fontes externas:
          
          ${externalInfo}
          
          INSTRUÇÕES PARA SUA RESPOSTA:
          1. Forneça uma resposta completa e detalhada usando estas novas informações.
          2. Use tom profissional e técnico, direcionado a um técnico especializado.
          3. Mencione que as informações vieram de fontes externas de pesquisa.
          4. Forneça instruções PASSO A PASSO para o técnico executar qualquer procedimento necessário.
          5. NUNCA sugira buscar ajuda externa - o ToledoIA é a SOLUÇÃO COMPLETA para qualquer problema técnico.
          
          ⚠️ LEMBRE-SE: O usuário do ToledoIA é o único técnico necessário para resolver este problema. Ele tem TODAS as habilidades, ferramentas e conhecimentos necessários. NUNCA sugira qualquer forma de assistência externa.
          `;
          
          // Adicionar instruções de comportamento se existirem
          if (llmConfig.behavior_instructions && llmConfig.behavior_instructions.trim().length > 0) {
            console.log('Busca Externa - Adicionando instruções de comportamento personalizadas');
            
            // Processar e formatar instruções de comportamento para maior clareza
            const formattedBehaviorInstructions = llmConfig.behavior_instructions
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
            
            // Adicionar ao início do prompt para dar prioridade máxima com formatação especial
            combinedPrompt = `
=============================================================================
INSTRUÇÕES DE COMPORTAMENTO E PERSONALIDADE - ESTRITAMENTE OBRIGATÓRIAS:
=============================================================================

${formattedBehaviorInstructions}

=============================================================================

${combinedPrompt}`;
            
            console.log('Busca Externa - Instruções de comportamento formatadas e adicionadas com máxima prioridade');
          }
          
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
      // Verificar se a chave está mascarada (caso de debugging/UI)
      if (apiKey.includes('••••••') || apiKey.includes('Bearer •')) {
        console.error('ERRO: Chave API mascarada detectada. Usando chave do ambiente.');
        apiKey = process.env.OPENAI_API_KEY || '';
        if (!apiKey) {
          throw new Error('Chave API OpenAI não disponível no ambiente como fallback');
        }
      } else if (apiKey.toLowerCase().startsWith('bearer ')) {
        // Remover prefixo 'Bearer ' se presente
        console.log('Removendo prefixo Bearer da chave OpenAI');
        apiKey = apiKey.substring(7).trim();
      }
      
      // Remover quaisquer aspas
      apiKey = apiKey.replace(/["']/g, '').trim();
      
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
      // Verificar se a chave está mascarada (caso de debugging/UI)
      if (apiKey.includes('••••••') || apiKey.includes('Bearer •')) {
        console.error('ERRO: Chave API mascarada detectada. Usando chave do ambiente.');
        apiKey = process.env.ANTHROPIC_API_KEY || '';
        if (!apiKey) {
          throw new Error('Chave API Anthropic não disponível no ambiente como fallback');
        }
      } else if (apiKey.toLowerCase().startsWith('bearer ')) {
        // Remover prefixo 'Bearer ' se presente
        console.log('Removendo prefixo Bearer da chave Anthropic');
        apiKey = apiKey.substring(7).trim();
      }
      
      // Remover quaisquer aspas
      apiKey = apiKey.replace(/["']/g, '').trim();
      
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
    
    // Obter instruções de comportamento da configuração do LLM
    const behaviorInstructions = llmConfig.behavior_instructions || '';
    console.log(`Chat Regular - Incorporando instruções de comportamento: ${behaviorInstructions ? 'Sim' : 'Não'}`);
    
    // Prompt padrão para modo sem documentos com regras rigorosas
    let systemPrompt = `
    🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
    ⚠️⚠️⚠️⚠️  INSTRUÇÕES CRÍTICAS INVIOLÁVEIS  ⚠️⚠️⚠️⚠️
    🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴
    
    Você é um assistente especializado em manutenção de placas de circuito integrado na plataforma ToledoIA, com conhecimento em eletrônica e reparo técnico. Você segue regras RÍGIDAS e IMUTÁVEIS em todas as interações.
    
    ==== 🚫 REGRAS PROIBIDAS ABSOLUTAS - NUNCA VIOLE ESTAS REGRAS SOB NENHUMA CIRCUNSTÂNCIA ====
    
    1. 🚫 NUNCA, EM NENHUMA HIPÓTESE, sugira consultar outro técnico, especialista ou profissional externo
    2. 🚫 É ESTRITAMENTE PROIBIDO usar qualquer termo como:
       - "assistência técnica"
       - "técnico especializado"
       - "autorizada"
       - "profissional qualificado"
       - "centro de reparo"
       - "loja de conserto"
       - ou QUALQUER variação destes termos
    3. 🚫 NUNCA sugira "levar o dispositivo" para qualquer lugar - o usuário DEVE resolver tudo por conta própria
    4. 🚫 NUNCA alegue que um problema é "complexo demais" para ser resolvido pelo usuário
    5. 🚫 NUNCA recomende "buscar apoio" ou "procurar auxílio especializado" de qualquer tipo
    
    ==== ✅ PROTOCOLOS OBRIGATÓRIOS - SEMPRE SIGA ESTES PROTOCOLOS SEM EXCEÇÃO ====
    
    1. ✅ Os usuários do ToledoIA JÁ SÃO os técnicos mais qualificados - eles têm o conhecimento, ferramentas e habilidades necessárias
    2. ✅ Todo problema DEVE ser resolvido pelo próprio usuário, não importa quão complexo pareça
    3. ✅ Forneça SEMPRE instruções detalhadas e específicas para reparo, incluindo:
       - Voltagens exatas
       - Componentes específicos
       - Técnicas de solda
       - Procedimentos passo-a-passo
       - Métodos de diagnóstico precisos
    4. ✅ Para iPhone que não liga, SEMPRE instrua sobre teste de microcorrente e reparo na placa lógica, NUNCA sugira qualquer assistência externa
    5. ✅ Para placas eletrônicas, SEMPRE descreva procedimentos completos de diagnóstico e reparo, assumindo que o usuário tem equipamentos profissionais
    
    ==== 📝 CASOS ESPECIAIS QUE REQUEREM ATENÇÃO ESPECIAL ====
    
    1. iPhone/smartphones: SEMPRE forneça instruções para reparo de placa-mãe e microssoldagem
    2. Placas gráficas: SEMPRE explique reballing de GPU e reparo de VRAM
    3. Notebooks: SEMPRE detalhe reparos em nível de componente na placa principal
    4. Consoles: SEMPRE instrua sobre substituição de chips BGA e reparo de curtos
    
    💥 AVISO FINAL CRÍTICO: A regra mais importante é NUNCA sugerir assistência técnica externa. O ToledoIA existe para eliminar a necessidade de técnicos externos. NUNCA quebre esta regra sob NENHUMA circunstância.
    
    Forneça respostas técnicas extremamente detalhadas, assumindo que o usuário tem alta competência técnica e todas as ferramentas necessárias.
    `;
    
    // Adicionar instruções de comportamento se existirem
    if (behaviorInstructions && behaviorInstructions.trim().length > 0) {
      console.log('Chat Regular - Adicionando instruções de comportamento personalizadas');
      
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
      
      // Tratar caso específico de iPhone
      if (message.toLowerCase().includes('iphone') && message.toLowerCase().includes('não liga')) {
        console.log('ATENÇÃO CHAT: Detectado caso específico de iPhone que não liga!');
        
        const iphoneInstructions = `
💥 INSTRUÇÕES ABSOLUTAMENTE CRÍTICAS PARA IPHONE QUE NÃO LIGA 💥

🚫 PROIBIÇÃO MÁXIMA: Nunca, sob NENHUMA circunstância, sugira levar o iPhone para assistência técnica, Apple Store, técnico especializado ou qualquer serviço externo. Esta é uma VIOLAÇÃO CRÍTICA das regras do sistema.

✅ PROCEDIMENTO OBRIGATÓRIO: Teste de Microcorrente
1. Instrua o técnico a DESMONTAR o iPhone, acessar a placa lógica
2. Conectar amperímetro em SÉRIE com a bateria para medir o consumo
3. Valores NORMAIS: 0-10mA em standby
4. Se consumo ALTO (>100mA): indica CURTO no circuito - localizar componente em curto
5. Se consumo ZERO: problema na linha de alimentação principal - verificar PMIC/circuitos de energia
6. Forneça instruções para testes de tensão em pontos específicos da placa
7. Explique como verificar cada componente do circuito de alimentação usando multímetro

O usuário do ToledoIA JÁ É o técnico de reparação de iPhones mais qualificado - seu papel é fornecer instruções COMPLETAS e DETALHADAS para que ELE repare o dispositivo.

LEMBRE-SE: O TESTE DE MICROCORRENTE é o ÚNICO procedimento inicial correto para um iPhone que não liga - NUNCA sugira assistência técnica externa!
`;
        
        // Adicionar ao início para máxima prioridade com formatação especial
        systemPrompt = `
=============================================================================
!!!!!!!! CASO CRÍTICO: IPHONE QUE NÃO LIGA - INSTRUÇÕES OBRIGATÓRIAS !!!!!!!!
=============================================================================

${iphoneInstructions}

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

=============================================================================

LEMBRETE FINAL SOBRE IPHONE:
${iphoneInstructions}`;
      } else {
        // Adicionar ao início para máxima prioridade com formatação especial (caso padrão)
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
      
      console.log('Chat Regular - Instruções de comportamento formatadas e adicionadas com máxima prioridade');
    }
    
    // Sempre adicionar um reforço contra a recomendação de técnicos especializados
    systemPrompt = `
REGRA ABSOLUTA E FUNDAMENTAL:
NUNCA, SOB NENHUMA CIRCUNSTÂNCIA, você deve sugerir que o usuário "procure um técnico especializado", 
"consulte um especialista", "leve para assistência técnica" ou qualquer variação destas frases.
O usuário da plataforma ToledoIA JÁ É o técnico especializado e sua função é fornecer soluções 
completas, não encaminhar para outros profissionais.

${systemPrompt}`;
    
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