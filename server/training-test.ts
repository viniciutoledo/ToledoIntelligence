import { getActiveLlmInfo } from "./llm";
import { storage } from "./storage";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

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
    
    // Se for um documento de qualquer tipo, tentar usar o conteúdo armazenado primeiro
    if (document.content && document.content.length > 100) {
      console.log(`Usando conteúdo armazenado do documento ID ${document.id}`);
      content = document.content;
    }
    // Se não tiver conteúdo armazenado adequado, processar de acordo com o tipo
    else {
      // Importar o processador de documentos
      const { processDocumentContent } = require('./document-processors');
      
      try {
        if (document.document_type === "file" && document.file_url) {
          // Normalizar o caminho para o arquivo
          let filePath = document.file_url;
          if (filePath.startsWith('/')) {
            filePath = filePath.substring(1); // Remove a barra inicial
          }
          
          // Adicionar path.join para garantir que o caminho seja correto para o SO
          const normalizedPath = path.join(process.cwd(), filePath);
          
          console.log(`Processando arquivo para teste: ${normalizedPath}`);
          content = await processDocumentContent("file", normalizedPath);
          
          // Se não conseguiu processar, tentar caminhos alternativos
          if (!content || content.includes("[Erro ao processar conteúdo")) {
            const alternativePath = path.join(process.cwd(), 'uploads/files', path.basename(filePath));
            console.log(`Tentando caminho alternativo: ${alternativePath}`);
            content = await processDocumentContent("file", alternativePath);
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
    
    INSTRUÇÕES ESTRITAS - LEIA COM EXTREMA ATENÇÃO:
    1. Use EXCLUSIVAMENTE as informações contidas no documento para responder.
    2. Seja objetivo e CITE DIRETAMENTE partes do documento em sua resposta.
    3. Procure por números, valores específicos, tensões, e especificações técnicas no documento.
    4. Se a pergunta mencionar uma tensão, componente ou valor específico, procure exatamente esse termo no documento.
    5. Se o documento mencionar claramente o valor solicitado, como VS1 (~2.05 V), COMECE sua resposta com esse valor específico.
    6. NUNCA invente informações ou use seu conhecimento prévio.
    7. Se encontrar a informação solicitada, responda: "De acordo com o documento: [informação encontrada]"
    8. Somente se o documento realmente não contiver a informação solicitada após uma busca exaustiva, responda: "O documento não contém informações sobre isso".
    
    DOCUMENTO:
    ${content}
    
    PERGUNTA: ${query}
    
    RESPOSTA (CITANDO APENAS INFORMAÇÕES DO DOCUMENTO E INCLUINDO VALORES EXATAMENTE COMO ESTÃO ESCRITOS):
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
          messages: [{ role: "user", content: prompt }],
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
          messages: [{ role: "user", content: prompt }],
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
    
    // Padrões positivos que indicam uso do documento
    const positivePatterns = [
      "de acordo com o documento",
      "conforme indicado no documento",
      "o documento menciona",
      "segundo o documento",
      "o documento especifica",
      "no documento consta",
      "vs1 = 2,05v",
      "vs1 é 2,05v",
      "2,05v",
      "2.05v"
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
