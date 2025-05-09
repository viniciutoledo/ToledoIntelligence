import { Express } from "express";
import { isAuthenticated, checkRole } from "./auth";
import { extractQueryTopics, processQueryWithRAG } from "./rag-processor";
import { storage } from "./storage";
import { logAction } from "./audit";

// Registra as rotas específicas para administradores
export function registerAdminRoutes(app: Express) {
  
  // Endpoint para testar o sistema RAG
  app.post("/api/admin/test-rag", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const { query } = req.body;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ message: "Consulta inválida" });
      }
      
      console.log(`[Admin RAG Test] Testando RAG com consulta: "${query}"`);
      
      // Extrair tópicos da consulta
      const topics = await extractQueryTopics(query);
      console.log(`[Admin RAG Test] Tópicos extraídos: ${topics.join(', ')}`);
      
      // Buscar documentos pelos tópicos
      const documents = await storage.getDocumentsByTopics(topics);
      console.log(`[Admin RAG Test] Encontrados ${documents.length} documentos relevantes`);
      
      // Gerar resposta utilizando o processador RAG
      const response = await processQueryWithRAG(query, {
        language: 'pt',
        userId: req.user!.id
      });
      
      // Registrar a ação de teste do RAG
      await logAction({
        userId: req.user!.id,
        action: "test_rag_system",
        details: { 
          query,
          topicsFound: topics.length,
          documentsFound: documents.length
        },
        ipAddress: req.ip
      });
      
      // Retornar resultado completo
      res.json({
        query,
        topics,
        documents,
        response
      });
    } catch (error) {
      console.error("Erro ao testar sistema RAG:", error);
      res.status(500).json({ 
        message: "Erro ao testar sistema RAG",
        error: error instanceof Error ? error.message : "Erro desconhecido" 
      });
    }
  });
}