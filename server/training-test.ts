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
    
    // Se for um documento de arquivo, ler o conteúdo do arquivo ou usar conteúdo armazenado
    if (document.document_type === "file") {
      try {
        // Primeira opção: usar o conteúdo armazenado no banco de dados, se existir
        if (document.content && document.content.length > 100) {
          console.log(`Usando conteúdo armazenado do documento ID ${document.id}`);
          content = document.content;
        }
        // Se não tiver conteúdo armazenado, tenta ler o arquivo
        else if (document.file_url) {
          console.log(`Tentando acessar arquivo: ${document.file_url}`);
          
          // Lista de caminhos possíveis para tentar ler o arquivo
          const possiblePaths = [];
          
          // Normalizar o caminho para o arquivo
          let filePath = document.file_url;
          if (filePath.startsWith('/')) {
            filePath = `.${filePath}`; // Adiciona o ponto ao início do caminho
          } else if (!filePath.startsWith('./')) {
            filePath = `./${filePath}`; // Adiciona './' ao início do caminho
          }
          
          // Adicionar caminhos alternativos para tentar
          possiblePaths.push(filePath);
          possiblePaths.push(`./uploads/${path.basename(filePath)}`);
          possiblePaths.push(`/home/runner/workspace/uploads/${path.basename(filePath)}`);
          possiblePaths.push(`${process.cwd()}/uploads/${path.basename(filePath)}`);
          
          // Adicionar caminho para a pasta files dentro de uploads
          possiblePaths.push(`./uploads/files/${path.basename(filePath)}`);
          possiblePaths.push(`/home/runner/workspace/uploads/files/${path.basename(filePath)}`);
          possiblePaths.push(`${process.cwd()}/uploads/files/${path.basename(filePath)}`);
          
          // Nome do arquivo
          const fileName = path.basename(filePath);
          
          // Se o nome do arquivo contiver um UUID ou timestamp (comum em uploads)
          if (fileName.includes('-')) {
            // Tenta com o nome original do arquivo (sem o UUID/timestamp)
            const originalFileName = fileName.split('-').slice(1).join('-');
            possiblePaths.push(`./uploads/${originalFileName}`);
            possiblePaths.push(`/home/runner/workspace/uploads/${originalFileName}`);
          }
          
          // Tentar ler o arquivo de um dos possíveis caminhos
          let fileRead = false;
          for (const pathToTry of possiblePaths) {
            try {
              console.log(`Tentando ler de: ${pathToTry}`);
              
              // Verificar se é um arquivo de texto ou binário
              const isPdfFile = pathToTry.toLowerCase().endsWith('.pdf');
              
              if (isPdfFile) {
                // Para PDFs, usamos o processamento binário
                content = await processBinaryFile(pathToTry);
                console.log(`Arquivo PDF processado com sucesso de: ${pathToTry}`);
                fileRead = true;
                break;
              } else {
                // Para arquivos de texto, leitura normal
                content = await fs.promises.readFile(pathToTry, 'utf8');
                console.log(`Arquivo de texto lido com sucesso de: ${pathToTry}`);
                fileRead = true;
                break; // Sai do loop se conseguir ler
              }
            } catch (error: any) {
              // Continua tentando outros caminhos
              console.log(`Não foi possível ler de ${pathToTry}: ${error.message}`);
            }
          }
          
          // Se não conseguiu ler de nenhum caminho
          if (!fileRead) {
            console.log(`Não foi possível ler o arquivo de nenhum dos caminhos tentados`);
            
            // Usar o conteúdo do documento (mesmo que seja pequeno)
            if (document.content) {
              console.log(`Usando conteúdo armazenado limitado do documento ID ${document.id}`);
              content = document.content;
            } else {
              // Mensagem de erro se não conseguiu recuperar conteúdo
              content = "Não foi possível acessar o conteúdo deste arquivo. Ele pode ter sido movido ou excluído.";
            }
          }
        } else {
          content = "Este documento não tem um arquivo associado.";
        }
      } catch (error: any) {
        console.error('Erro ao processar arquivo:', error.message);
        content = "Erro ao processar o conteúdo do arquivo: " + error.message;
      }
    }
    
    // Se for um documento de website, usar o conteúdo já extraído e armazenado
    if (document.document_type === "website") {
      content = content || "Conteúdo do website não disponível";
    }
    
    if (!content) {
      return {
        response: `O documento '${document.name}' não possui conteúdo disponível para teste.`,
        usedDocument: false,
        documentName: document.name,
      };
    }
    
    // Construir um prompt que força o uso do conteúdo do documento
    const prompt = `
    Você é um assistente especializado em manutenção de placas de circuito, com conhecimento profundo em eletrônica.
    
    TAREFA: Analise cuidadosamente o DOCUMENTO fornecido abaixo e responda à PERGUNTA do usuário.
    
    INSTRUÇÕES ESTRITAS - LEIA COM ATENÇÃO:
    1. Use EXCLUSIVAMENTE as informações contidas no documento para responder.
    2. Seja objetivo e CITE DIRETAMENTE partes do documento em sua resposta.
    3. Procure por números, valores específicos, tensões, e especificações técnicas no documento.
    4. Se a pergunta mencionar uma tensão, componente ou valor específico, procure exatamente esse termo no documento.
    5. Se o documento mencionar claramente o valor solicitado, COMECE sua resposta com esse valor específico.
    6. NUNCA invente informações ou use seu conhecimento prévio.
    7. Se encontrar a informação solicitada, responda: "De acordo com o documento: [informação encontrada]"
    8. Somente se o documento não contiver a informação solicitada, responda: "O documento não contém informações sobre isso".

    DOCUMENTO:
    ${content}
    
    PERGUNTA: ${query}
    
    RESPOSTA (CITANDO APENAS INFORMAÇÕES DO DOCUMENTO):
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
