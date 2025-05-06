import { storage } from "./storage";
import fs from "fs";
import path from "path";
import { db } from "./db";
import { chatMessages, chatSessions } from "@shared/schema";
import { eq, and, gte } from "drizzle-orm";

// Função auxiliar para buscar mensagens de uma sessão de chat
export async function fetchChatMessages(sessionId: number) {
  try {
    // Usar a instância do db diretamente para fazer a consulta
    const messages = await db.select()
      .from(chatMessages)
      .where(eq(chatMessages.session_id, sessionId))
      .orderBy(chatMessages.created_at);
    
    return messages;
  } catch (error: any) {
    console.error(`Erro ao buscar mensagens para sessão ${sessionId}:`, error);
    return [];
  }
}

// Função auxiliar para buscar sessões recentes
export async function fetchRecentSessions(cutoffDate: Date) {
  try {
    // Usar a instância do db diretamente para fazer a consulta
    const sessions = await db.select()
      .from(chatSessions)
      .where(gte(chatSessions.started_at, cutoffDate))
      .orderBy(chatSessions.started_at);
    
    return sessions;
  } catch (error: any) {
    console.error('Erro ao buscar sessões recentes:', error);
    return [];
  }
}

interface UserInteractionData {
  sessionId: number;
  messages: Array<{
    content: string;
    role: "user" | "assistant";
    timestamp: Date;
  }>;
  metadata: {
    userId?: number;
    userAgent?: string;
    deviceType?: string;
    source: "chat" | "widget" | "api";
    createdAt: Date;
  };
}

// Função para extrair interações de uma sessão de chat
export async function extractInteractionData(sessionId: number): Promise<UserInteractionData | null> {
  try {
    // Buscar sessão de chat
    const session = await storage.getChatSession(sessionId);
    if (!session) {
      console.error(`Sessão de chat ${sessionId} não encontrada`);
      return null;
    }
    
    // Buscar mensagens da sessão usando a função auxiliar
    const messages = await fetchChatMessages(sessionId);
    if (!messages || messages.length === 0) {
      console.log(`Nenhuma mensagem encontrada para a sessão ${sessionId}`);
      return null;
    }
    
    // Formatar os dados da interação
    const interactionData: UserInteractionData = {
      sessionId,
      messages: messages.map((msg: any) => ({
        content: msg.content || "",
        role: msg.is_user ? "user" : "assistant",
        timestamp: msg.created_at
      })),
      metadata: {
        userId: session.user_id,
        source: "chat", // Valor padrão
        createdAt: session.started_at // Usar started_at em vez de created_at
      }
    };
    
    return interactionData;
  } catch (error: any) {
    console.error(`Erro ao extrair dados de interação para sessão ${sessionId}:`, error);
    return null;
  }
}

// Função para salvar interações como documentos de treinamento
export async function saveInteractionAsTrainingDocument(
  interactionData: UserInteractionData, 
  categoryId?: number
): Promise<boolean> {
  try {
    // Verificar se há dados suficientes para criar um documento
    if (!interactionData.messages || interactionData.messages.length < 2) {
      console.log("Interação não tem mensagens suficientes para criar um documento de treinamento");
      return false;
    }
    
    // Formatar o conteúdo do documento
    const documentContent = formatInteractionContent(interactionData);
    const sessionDate = new Date(interactionData.metadata.createdAt).toISOString().split('T')[0];
    
    // Criar nome e descrição para o documento
    const documentName = `Interação de Chat (${sessionDate}) - ID ${interactionData.sessionId}`;
    const documentDescription = `Documento gerado automaticamente a partir da sessão de chat ${interactionData.sessionId}`;
    
    // Criar documento de treinamento
    const document = await storage.createTrainingDocument({
      name: documentName,
      description: documentDescription,
      document_type: "text",
      content: documentContent,
      created_by: interactionData.metadata.userId || 1 // ID 1 para administrador do sistema
    });
    
    console.log(`Documento de treinamento criado com ID ${document.id} a partir da sessão ${interactionData.sessionId}`);
    
    // Adicionar à categoria, se especificada
    if (categoryId) {
      await storage.addDocumentToCategory(document.id, categoryId);
      console.log(`Documento adicionado à categoria ${categoryId}`);
    }
    
    return true;
  } catch (error: any) {
    console.error("Erro ao salvar interação como documento de treinamento:", error);
    return false;
  }
}

// Formatar a interação como conteúdo de documento de treinamento
function formatInteractionContent(interactionData: UserInteractionData): string {
  // Formatar como um arquivo de texto estruturado
  let content = `# Interação de Chat - Sessão ${interactionData.sessionId}\n\n`;
  content += `Data: ${new Date(interactionData.metadata.createdAt).toISOString()}\n`;
  content += `Origem: ${interactionData.metadata.source}\n\n`;
  content += `## Mensagens\n\n`;
  
  // Adicionar todas as mensagens, formatadas claramente
  for (const message of interactionData.messages) {
    const roleLabel = message.role === "user" ? "Usuário" : "Assistente";
    const timestamp = new Date(message.timestamp).toISOString();
    
    content += `**${roleLabel}** (${timestamp}):\n${message.content}\n\n`;
  }
  
  // Adicionar metadata útil como conteúdo
  content += `## Informações Adicionais\n\n`;
  content += `- ID da Sessão: ${interactionData.sessionId}\n`;
  if (interactionData.metadata.userId) {
    content += `- ID do Usuário: ${interactionData.metadata.userId}\n`;
  }
  content += `- Tipo de Origem: ${interactionData.metadata.source}\n`;
  
  return content;
}

// Função para processar interações recentes e convertê-las para documentos de treinamento
export async function processRecentInteractions(
  daysAgo: number = 7,
  maxInteractions: number = 50,
  categoryId?: number
): Promise<number> {
  try {
    // Calcular a data limite (X dias atrás)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
    
    // Buscar sessões recentes usando a função auxiliar
    const recentSessions = await fetchRecentSessions(cutoffDate);
    
    if (!recentSessions || recentSessions.length === 0) {
      console.log(`Nenhuma sessão encontrada nos últimos ${daysAgo} dias`);
      return 0;
    }
    
    console.log(`Encontradas ${recentSessions.length} sessões nos últimos ${daysAgo} dias`);
    
    // Limitar ao número máximo de interações
    const sessionsToProcess = recentSessions.slice(0, maxInteractions);
    let processedCount = 0;
    
    // Processar cada sessão e criar documento de treinamento
    for (const session of sessionsToProcess) {
      const interactionData = await extractInteractionData(session.id);
      
      if (interactionData) {
        const success = await saveInteractionAsTrainingDocument(interactionData, categoryId);
        if (success) {
          processedCount++;
        }
      }
    }
    
    console.log(`Processadas ${processedCount} interações com sucesso`);
    return processedCount;
  } catch (error: any) {
    console.error("Erro ao processar interações recentes:", error);
    return 0;
  }
}

// Função para criar automaticamente uma categoria para dados de interação
export async function createInteractionCategory(adminUserId: number): Promise<number | null> {
  try {
    // Verificar se a categoria já existe
    const existingCategories = await storage.getTrainingCategories();
    const interactionCategory = existingCategories.find(cat => 
      cat.name === "Interações de Usuários" || cat.name === "User Interactions");
    
    if (interactionCategory) {
      console.log(`Categoria de interações já existe com ID ${interactionCategory.id}`);
      return interactionCategory.id;
    }
    
    // Criar nova categoria
    const category = await storage.createTrainingCategory({
      name: "Interações de Usuários",
      description: "Documentos gerados automaticamente a partir de interações dos usuários",
      created_by: adminUserId
    });
    
    console.log(`Categoria de interações criada com ID ${category.id}`);
    return category.id;
  } catch (error: any) {
    console.error("Erro ao criar categoria para interações:", error);
    return null;
  }
}