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
    
    // Se for um documento de arquivo, ler o conteúdo do arquivo
    if (document.document_type === "file" && document.file_url) {
      try {
        console.log(`Tentando acessar arquivo: ${document.file_url}`);
        
        // Normalizar o caminho para o arquivo
        let filePath = document.file_url;
        if (filePath.startsWith('/')) {
          filePath = `.${filePath}`; // Adiciona o ponto ao início do caminho
        } else if (!filePath.startsWith('./')) {
          filePath = `./${filePath}`; // Adiciona './' ao início do caminho
        }
        
        // Tenta ler o conteúdo do arquivo diretamente primeiro
        try {
          content = await fs.promises.readFile(filePath, 'utf8');
          console.log(`Arquivo lido com sucesso: ${filePath}`);
        } catch (error: any) {
          console.log(`Erro ao ler arquivo direto: ${error.message}`);
          
          // Se não conseguir, tenta extrair o nome do arquivo e busca-lo em ./uploads
          const fileName = filePath.split('/').pop() || '';
          const uploadsPath = './uploads/' + fileName;
          
          try {
            content = await fs.promises.readFile(uploadsPath, 'utf8');
            console.log(`Arquivo lido de caminho alternativo: ${uploadsPath}`);
          } catch (error: any) {
            console.log(`Erro ao ler do diretório de uploads: ${error.message}`);
            content = "Conteúdo do arquivo não disponível. Verifique se o arquivo ainda existe no sistema.";
          }
        }
      } catch (error) {
        console.error('Erro ao processar arquivo:', error);
        content = "Conteúdo do arquivo não disponível";
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
    Você é um assistente especializado em manutenção de placas de circuito.
    
    Responda à seguinte pergunta usando APENAS as informações do documento abaixo.
    Se as informações no documento não forem suficientes para responder à pergunta, diga que não possui informações suficientes no documento.
    
    DOCUMENTO:
    ${content}
    
    PERGUNTA: ${query}
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
    // Esta é uma heurística simples - idealmente, você usaria um método mais robusto
    const usedDocument = !response.includes("não possui informações suficientes") && 
                         !response.includes("não foi possível encontrar") &&
                         !response.includes("não tenho informações");
    
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
