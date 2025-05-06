import { getActiveLlmInfo } from "./llm";
import { storage } from "./storage";
import fs from "fs";
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
        const filePath = `.${document.file_url}`; // Remover o primeiro "/" do caminho
        content = await fs.promises.readFile(filePath, 'utf8');
      } catch (error) {
        console.error('Erro ao ler arquivo:', error);
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
    const { provider, modelName, apiKey } = llmConfig;
    
    // Aqui você usaria a API do LLM para obter a resposta
    // Por exemplo, usando a OpenAI:
    let response;
    
    if (provider === "openai") {
      const openai = new OpenAI({
        apiKey: apiKey,
      });
      
      const completion = await openai.chat.completions.create({
        model: modelName,
        messages: [{ role: "user", content: prompt }],
      });
      
      response = completion.choices[0]?.message?.content || "Não foi possível gerar uma resposta.";
    } else if (provider === "anthropic") {
      const anthropic = new Anthropic({
        apiKey: apiKey,
      });
      
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
