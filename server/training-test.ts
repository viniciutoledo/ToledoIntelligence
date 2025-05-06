import { getActiveLlmInfo } from "./llm";
import { storage } from "./storage";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

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
              content = await fs.promises.readFile(pathToTry, 'utf8');
              console.log(`Arquivo lido com sucesso de: ${pathToTry}`);
              fileRead = true;
              break; // Sai do loop se conseguir ler
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
    
    INSTRUÇÕES:
    1. Use APENAS as informações contidas no documento para responder.
    2. Seja preciso e detalhado em sua resposta, citando partes relevantes do documento.
    3. Se o documento contiver a informação solicitada, mesmo que parcialmente, forneça essa informação.
    4. Se a pergunta for sobre "pinos", "conexões", "CC", "USB" ou outros termos técnicos, busque essas palavras-chave no documento.
    5. Não invente informações ou use seu conhecimento prévio para complementar a resposta.
    6. Somente se o documento não contiver NENHUMA informação relacionada à pergunta, responda: "O documento não contém informações sobre isso".
    
    DOCUMENTO:
    ${content}
    
    PERGUNTA: ${query}
    
    RESPOSTA BASEADA EXCLUSIVAMENTE NO DOCUMENTO:
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
      "não possui informações suficientes",
      "não foi possível encontrar", 
      "não tenho informações",
      "não há informações específicas",
      "não contém detalhes",
      "não é mencionado",
      "o documento não fornece"
    ];
    
    // Verificar extrato do documento
    let keywordsFromQuery = query.toLowerCase().split(' ')
      .filter(w => w.length > 3) // Palavras significativas
      .filter(w => !['como', 'qual', 'quais', 'quando', 'onde', 'para', 'porque', 'isso', 'esse', 'esta', 'este'].includes(w));
    
    // Verifica se a resposta contém palavras-chave da pergunta e não contém mensagens negativas
    const hasQueryKeywords = keywordsFromQuery.some(keyword => response.toLowerCase().includes(keyword));
    const hasNegativePattern = negativePatterns.some(pattern => response.toLowerCase().includes(pattern));
    
    // Considera que usou o documento se tem palavras-chave da consulta e não tem padrões negativos
    const usedDocument = hasQueryKeywords && !hasNegativePattern;
    
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
