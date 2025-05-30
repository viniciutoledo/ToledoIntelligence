import { getActiveLlmInfo } from "./llm";
import { storage } from "./storage";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { processDocumentContent } from "./document-processors";

// Função para determinar se o arquivo é de texto ou binário
function isTextFile(filePath: string): boolean {
  const textExtensions = [
    '.txt', '.md', '.csv', '.json', '.xml', '.html', '.htm', '.js', '.ts', '.css',
    '.scss', '.c', '.cpp', '.h', '.py', '.rb', '.pl', '.php', '.sh', '.bat', '.ps1',
    '.sql', '.yaml', '.yml', '.conf', '.ini', '.cfg', '.properties', '.log'
  ];
  const ext = path.extname(filePath).toLowerCase();
  return textExtensions.includes(ext);
}

// Função para processar arquivos binários (ex: PDF)
async function processBinaryFile(filePath: string): Promise<string> {
  try {
    console.log(`Processando arquivo binário: ${filePath}`);
    const fileData = await fs.promises.readFile(filePath);
    
    // Se for um PDF, retornamos um marcador especial
    if (filePath.toLowerCase().endsWith('.pdf')) {
      console.log(`Arquivo PDF detectado, retornando dados simplificados (tamanho: ${fileData.length} bytes)`);
      return `[Conteúdo do arquivo PDF ${path.basename(filePath)} - disponível para consulta]`;
    }
    
    // Para outros tipos de arquivo binário
    return `[Conteúdo binário de ${path.basename(filePath)} - ${fileData.length} bytes]`;
  } catch (error: any) {
    console.error(`Erro ao processar arquivo binário ${filePath}:`, error.message);
    return `Erro ao processar arquivo binário: ${error.message}`;
  }
}

// Esta função será usada para testar se o LLM está usando documentos de treinamento específicos
export async function testDocumentKnowledge(query: string, documentId: number) {
  try {
    // Buscar o documento pelo ID
    const document = await storage.getTrainingDocument(documentId);
    
    if (!document) {
      throw new Error(`Documento com ID ${documentId} não encontrado`);
    }
    
    // Obter configurações atuais do LLM
    const llmConfig = await getActiveLlmInfo();
    
    // Verificar se o uso de documentos de treinamento está ativado
    if (!llmConfig.shouldUseTrained) {
      return {
        response: "O uso de documentos de treinamento está desativado nas configurações do LLM. Ative-o para testar o conhecimento.",
        usedDocument: false,
        documentName: document.name,
      };
    }

    // Obter o conteúdo do documento
    let content = document.content;
    
    // Verificar se o documento foi indexado
    if (document.status === "indexed") {
      console.log(`Documento ID ${document.id} está indexado. Usando embeddings para teste.`);
      
      // Buscar chunks armazenados para este documento na knowledge_base
      const knowledgeEntries = await storage.getKnowledgeEntriesBySource("document", document.id);
      
      if (knowledgeEntries && knowledgeEntries.length > 0) {
        // Combinar o conteúdo de todos os chunks
        content = knowledgeEntries.map(entry => entry.content).join("\n\n");
        console.log(`Reconstruído conteúdo do documento a partir de ${knowledgeEntries.length} chunks de conhecimento`);
      } else {
        console.log(`Nenhum chunk de conhecimento encontrado para o documento indexado ID ${document.id}`);
      }
    }
    
    // Se não encontrou conteúdo nos chunks ou o documento não está indexado, usar o conteúdo armazenado
    if ((!content || content.length < 100) && document.content && document.content.length > 100) {
      console.log(`Usando conteúdo armazenado do documento ID ${document.id}`);
      content = document.content;
    }
    // Se não tiver conteúdo armazenado adequado, processar de acordo com o tipo
    else {
      // Usar o processador de documentos importado no topo do arquivo
      try {
        if (document.document_type === "file" && document.file_url) {
          // Normalizar o caminho para o arquivo
          let filePath = document.file_url;
          if (filePath.startsWith('/')) {
            filePath = filePath.substring(1); // Remove a barra inicial
          }
          
          // Detectar se o caminho já inclui /files/ ou não
          if (!filePath.includes('/files/') && !filePath.includes('\\files\\')) {
            // Se não inclui, vamos tentar primeiro o caminho com /files/
            const baseFileName = path.basename(filePath);
            const filesPath = path.join(process.cwd(), 'uploads/files', baseFileName);
            
            console.log(`Processando arquivo para teste (caminho com /files/): ${filesPath}`);
            content = await processDocumentContent("file", filesPath);
            
            // Se não conseguiu com /files/, tenta o caminho original
            if (!content || content.includes("[Erro ao processar conteúdo") || content.includes("[Arquivo não encontrado")) {
              // Adicionar path.join para garantir que o caminho seja correto para o SO
              const normalizedPath = path.join(process.cwd(), filePath);
              
              console.log(`Tentando caminho original: ${normalizedPath}`);
              content = await processDocumentContent("file", normalizedPath);
            }
          } else {
            // Se já inclui /files/, usar o caminho normalizado
            const normalizedPath = path.join(process.cwd(), filePath);
            
            console.log(`Processando arquivo para teste: ${normalizedPath}`);
            content = await processDocumentContent("file", normalizedPath);
          }
          
          // Se ainda não conseguiu processar, tentar outras alternativas
          if (!content || content.includes("[Erro ao processar conteúdo") || content.includes("[Arquivo não encontrado")) {
            // Tenta caminhos alternativos
            const alternativePaths = [
              path.join(process.cwd(), 'uploads', path.basename(filePath)),
              path.join(process.cwd(), 'uploads/files', path.basename(filePath))
            ];
            
            for (const altPath of alternativePaths) {
              console.log(`Tentando caminho alternativo: ${altPath}`);
              try {
                if (fs.existsSync(altPath)) {
                  content = await processDocumentContent("file", altPath);
                  if (content && !content.includes("[Erro") && !content.includes("[Arquivo não encontrado")) {
                    console.log(`Sucesso ao processar com caminho alternativo: ${altPath}`);
                    break;
                  }
                }
              } catch (err) {
                console.error(`Erro ao tentar caminho alternativo ${altPath}:`, err);
              }
            }
          }
        }
        else if (document.document_type === "website" && document.website_url) {
          console.log(`Processando website para teste: ${document.website_url}`);
          content = await processDocumentContent("website", undefined, document.website_url);
        }
        else if (document.document_type === "text") {
          // Para documentos de texto, o conteúdo já está armazenado no banco
          content = document.content || "Conteúdo do documento de texto não disponível";
        }
        
        // Se ainda não tiver conteúdo após todas as tentativas
        if (!content) {
          console.log(`Não foi possível obter conteúdo para o documento ID ${document.id}`);
          content = "Não foi possível acessar o conteúdo deste documento. Ele pode ter sido movido ou excluído.";
        }
      } catch (error: any) {
        console.error('Erro ao processar documento para teste:', error.message);
        content = "Erro ao processar o conteúdo do documento: " + error.message;
      }
    }
    
    if (!content) {
      return {
        response: `O documento '${document.name}' não possui conteúdo disponível para teste.`,
        usedDocument: false,
        documentName: document.name,
      };
    }
    
    // Construir um prompt que força o uso do conteúdo do documento
    // Pré-processar a pergunta para identificar termos técnicos
    const lowerQuery = query.toLowerCase();
    const technicalTerms = [
      { term: "vs1", aliases: ["vs1", "vs 1", "tensão vs1", "valor vs1"] },
      { term: "vpa", aliases: ["vpa", "vp a", "tensão vpa", "valor vpa"] },
      { term: "vcore", aliases: ["vcore", "v core", "tensão vcore"] },
      { term: "vproc", aliases: ["vproc", "v proc", "tensão vproc"] },
      { term: "bobina", aliases: ["bobina", "bobinas", "linhas"] },
      { term: "high", aliases: ["high", "ldo", "high ldo"] },
      { term: "mtk", aliases: ["mtk", "mediatek", "mt", "pmic"] }
    ];
    
    // Identificar termos técnicos relevantes na pergunta
    const relevantTerms = technicalTerms.filter(term => 
      term.aliases.some(alias => lowerQuery.includes(alias))
    );
    
    let technicalContext = "";
    if (relevantTerms.length > 0) {
      technicalContext = `
      OBSERVAÇÃO IMPORTANTE: A pergunta contém os seguintes termos técnicos específicos: ${relevantTerms.map(t => t.term.toUpperCase()).join(', ')}
      
      Para cada um desses termos técnicos, você DEVE:
      1. Procurar diretamente por esses termos no documento (mesmo que estejam em diferentes formatações como VS1, Vs1, vs1)
      2. Identificar valores numéricos ou especificações associadas a esses termos (ex: VS1 ~2.05V, VS1 = 2,05V, VS1 [-2.05V], etc.)
      3. Se encontrar um valor, SEMPRE comece sua resposta com este valor específico e depois forneça o contexto.
      `;
    }
    
    // Extrair padrões de valor específicos da pergunta
    const isValueQuestion = lowerQuery.includes("valor") || 
                          lowerQuery.includes("tensão") || 
                          lowerQuery.includes("voltagem") || 
                          lowerQuery.includes("volts") || 
                          lowerQuery.includes("v");
    
    let valueContext = "";
    if (isValueQuestion) {
      valueContext = `
      ATENÇÃO: A pergunta solicita um VALOR ou TENSÃO específica. 
      
      Você DEVE:
      1. Procurar por quaisquer valores numéricos, especialmente aqueles seguidos de V, v, Volts ou volts
      2. Se o documento mencionar valores como 2.05V, ~2.05V, 2,05V, [-2.05 V], ou variações semelhantes, SEMPRE cite o valor exato conforme mostrado no documento
      3. Preste especial atenção a números com casas decimais (como 0.6, 1.2, 2.05, 2.0)
      `;
    }
    
    const prompt = `
    Você é um assistente especializado em manutenção de placas de circuito, com conhecimento profundo em eletrônica.
    
    TAREFA: Analise METICULOSAMENTE o DOCUMENTO fornecido abaixo e responda à PERGUNTA do usuário.
    
    ${technicalContext}
    ${valueContext}
    
    INSTRUÇÕES CRÍTICAS COM PRIORIDADE MÁXIMA:
    1. Use EXCLUSIVAMENTE as informações contidas no documento para responder.
    2. PROIBIDO RESPONDER "O documento não contém informações sobre isso" ou frases similares sem antes fazer uma análise exaustiva de todo o conteúdo.
    3. Seja objetivo e CITE DIRETAMENTE partes do documento em sua resposta, usando citações exatas.
    4. ANTES DE RESPONDER, realize uma BUSCA EXTREMAMENTE DETALHADA no documento por:
       - Qualquer menção do termo técnico específico (VS1, VPA, VCORE, 1,2V, 2,05V, etc.)
       - Valores de tensão ou corrente relacionados à pergunta
       - Termos técnicos, mesmo em formatos variados (VS1, Vs1, vs1, V.S.1, 1.2V, 1,2V etc.)
       - Números precisos seguidos de 'V', 'mA', 'Ω', 'Hz' etc.
       - Procedimentos, sequências, ou instruções técnicas
    5. MESMO QUE PRECISE ANALISAR O DOCUMENTO PALAVRA POR PALAVRA, você DEVE encontrar qualquer informação relevante.
    6. Se você encontrar QUALQUER menção ao termo buscado, mesmo que em contexto diferente, SEMPRE cite essa parte do documento.
    7. Se o documento mencionar claramente um valor técnico, como "1,2 V" ou "confirmando se há 1,2 V de saída", COMECE sua resposta com esses valores específicos.
    8. NUNCA invente informações ou use seu conhecimento prévio.
    9. TÉCNICA DE BUSCA OBRIGATÓRIA:
       a. Primeiro, leia o documento inteiro para entender o contexto
       b. Depois, procure palavra por palavra por termos técnicos específicos
       c. Busque por valores numéricos seguidos de unidades (V, mA, etc.)
       d. Procure por procedimentos de teste ou verificação
       e. Identifique relações entre componentes, mesmo que não sejam explícitas
    
    LEMBRE-SE: Documentos técnicos frequentemente contêm informações críticas em formatos não óbvios, como notas de rodapé, comentários entre parênteses, ou menções breves. É VITAL que você analise cada palavra e número do documento com extrema atenção.
    
    ALERTA: Se você responder que "o documento não contém informações" sobre algo que de fato está presente no documento, isso será considerado um ERRO GRAVE. É melhor extrair informação parcialmente relacionada do que declarar ausência de informação.
    
    DOCUMENTO:
    ${content}
    
    PERGUNTA: ${query}
    
    INSTRUÇÕES FINAIS OBRIGATÓRIAS:
    - Se você encontrar QUALQUER menção a tensões (como "1,2 V", "~1,2V", etc.) no documento, você DEVE citá-las EXATAMENTE como aparecem.
    - Se encontrar procedimentos técnicos, cite-os em formato de lista numerada.
    - Não omita informações técnicas importantes, mesmo que pareçam indiretas.
    - Procure especialmente por termos similares a: IC, pinos, esferas, CPU, tensão, linha, feedback, resistores, LDO, telefone
    
    RESPOSTA (CITE APENAS INFORMAÇÕES DO DOCUMENTO, INCLUINDO VALORES EXATAMENTE COMO ESTÃO ESCRITOS):
    `;
    
    // Chamar o LLM com o prompt personalizado
    const { provider, modelName } = llmConfig;
    
    // Aqui você usaria a API do LLM para obter a resposta
    // Por exemplo, usando a OpenAI:
    let response;
    
    if (provider === "openai") {
      try {
        // Use diretamente a chave do ambiente
        let apiKeyToUse = process.env.OPENAI_API_KEY;
        if (apiKeyToUse) {
          console.log("Usando chave do ambiente para teste de OpenAI");
        } else {
          console.error("Chave OpenAI do ambiente não está configurada");
          return {
            response: "Erro de configuração: não foi possível acessar uma chave válida para OpenAI. Verifique as variáveis de ambiente.",
            usedDocument: false,
            documentName: document.name,
          };
        }
        
        console.log(`Testando documento com modelo OpenAI: ${modelName}`);
        
        // Criar cliente com chave do ambiente
        const openai = new OpenAI({
          apiKey: apiKeyToUse
        });
        
        // Fazer chamada API
        const completion = await openai.chat.completions.create({
          model: modelName,
          messages: [
            { 
              role: "system", 
              content: "Você é um assistente focado em extrair conhecimento de documentos técnicos. " +
                       "Seu trabalho é encontrar informações ESPECÍFICAS relacionadas à consulta do usuário, mesmo que não sejam óbvias. " +
                       "NUNCA responda que o documento não possui informações sem antes fazer uma análise completa. " +
                       "Procure por termos relacionados, siglas, códigos ou referências indiretas. " +
                       "Se encontrar QUALQUER informação relevante, por mais indireta que seja, cite-a explicitamente."
            },
            { role: "user", content: prompt }
          ],
          temperature: 0.1 // Temperatura menor para ser mais focado e preciso
        });
        
        response = completion.choices[0]?.message?.content || "Não foi possível gerar uma resposta.";  
      } catch (apiError: any) {
        console.error("Erro na chamada da API OpenAI:", apiError.message);
        response = `Erro ao consultar API OpenAI: ${apiError.message || 'Erro desconhecido'}`;
      }
    } else if (provider === "anthropic") {
      try {
        // Use diretamente a chave do ambiente
        let apiKeyToUse = process.env.ANTHROPIC_API_KEY;
        if (apiKeyToUse) {
          console.log("Usando chave do ambiente para teste de Anthropic");
        } else {
          console.error("Chave Anthropic do ambiente não está configurada");
          return {
            response: "Erro de configuração: não foi possível acessar uma chave válida para Anthropic. Verifique as variáveis de ambiente.",
            usedDocument: false,
            documentName: document.name,
          };
        }
        
        console.log(`Testando documento com modelo Anthropic: ${modelName}`);
        
        // Criar cliente com chave do ambiente
        const anthropic = new Anthropic({
          apiKey: apiKeyToUse
        });
        
        // Fazer chamada API
        const message = await anthropic.messages.create({
          model: modelName,
          max_tokens: 1000,
          system: "Você é um assistente focado em extrair conhecimento de documentos técnicos. " +
                 "Seu trabalho é encontrar informações ESPECÍFICAS relacionadas à consulta do usuário, mesmo que não sejam óbvias. " +
                 "NUNCA responda que o documento não possui informações sem antes fazer uma análise completa. " +
                 "Procure por termos relacionados, siglas, códigos ou referências indiretas. " +
                 "Se encontrar QUALQUER informação relevante, por mais indireta que seja, cite-a explicitamente.",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1, // Temperatura menor para ser mais focado e preciso
        });
        
        // Extrair texto da resposta da Anthropic
        if (message.content[0] && typeof message.content[0] === 'object' && 'text' in message.content[0]) {
          response = message.content[0].text;
        } else {
          response = "Erro ao processar resposta da Anthropic";
        }
      } catch (apiError: any) {
        console.error("Erro na chamada da API Anthropic:", apiError.message);
        response = `Erro ao consultar API Anthropic: ${apiError.message || 'Erro desconhecido'}`;
      }
    } else {
      // Implementar outros provedores conforme necessário
      response = "Teste de documento não implementado para este provedor de LLM.";
    }
    
    // Verificar se a resposta contém informações do documento
    // Esta é uma heurística mais sofisticada para detectar uso real do documento
    const negativePatterns = [
      "não possui informações",
      "não foi possível encontrar", 
      "não tenho informações",
      "não há informações",
      "não contém informações",
      "não é mencionado",
      "o documento não fornece",
      "o documento não contém"
    ];
    
    // Log do conteúdo para depuração
    console.log("CONTEÚDO EXTRAÍDO (primeiros 1000 caracteres):");
    console.log(content.substring(0, 1000));
    
    // Padrões positivos que indicam uso do documento
    const positivePatterns = [
      "de acordo com o documento",
      "conforme indicado no documento",
      "o documento menciona",
      "segundo o documento",
      "o documento especifica",
      "no documento consta",
      "vs1",
      "2,05", 
      "2.05",
      "~2.05",
      "~2,05",
      "2,05v",
      "2.05v",
      "high ldo",
      "vpa",
      "vcore",
      "vproc"
    ];
    
    // Verificar extrato do documento
    let keywordsFromQuery = query.toLowerCase().split(' ')
      .filter(w => w.length > 3) // Palavras significativas
      .filter(w => !['como', 'qual', 'quais', 'quando', 'onde', 'para', 'porque', 'isso', 'esse', 'esta', 'este'].includes(w));
    
    // Verifica se a resposta contém padrões positivos específicos ou palavras-chave da pergunta
    const hasPositivePattern = positivePatterns.some(pattern => 
      response.toLowerCase().includes(pattern.toLowerCase()));
    const hasQueryKeywords = keywordsFromQuery.some(keyword => 
      response.toLowerCase().includes(keyword));
    const hasNegativePattern = negativePatterns.some(pattern => 
      response.toLowerCase().includes(pattern.toLowerCase()));
    
    // Considera que usou o documento se tem padrões positivos ou tem palavras-chave sem padrões negativos
    const usedDocument = hasPositivePattern || (hasQueryKeywords && !hasNegativePattern);
    
    return {
      response,
      usedDocument,
      documentName: document.name,
    };
    
  } catch (error: any) {
    console.error("Erro ao testar conhecimento do documento:", error);
    return {
      response: `Erro ao testar o conhecimento: ${error.message || 'Erro desconhecido'}`,
      usedDocument: false,
    };
  }
}
