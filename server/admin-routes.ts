import { Express } from "express";
import { isAuthenticated, checkRole } from "./auth";
import { extractQueryTopics, processQueryWithRAG } from "./rag-processor";
import { storage } from "./storage";
import { logAction } from "./audit";
import { systemMaintenanceService } from "./system-maintenance";

// Registra as rotas específicas para administradores
export function registerAdminRoutes(app: Express) {

  // Rotas para manutenção do sistema
  app.post("/api/admin/system-maintenance/verifyIntegrity", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const result = await systemMaintenanceService.verifyDatabaseIntegrity();
      
      // Registrar ação de administração
      await logAction({
        userId: req.user!.id,
        action: "system_maintenance",
        details: { operation: "verify_integrity", success: result.success },
        ipAddress: req.ip
      });
      
      res.json(result);
    } catch (error) {
      console.error("Erro ao verificar integridade do banco de dados:", error);
      res.status(500).json({
        success: false,
        message: `Erro ao verificar integridade: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });

  app.post("/api/admin/system-maintenance/optimizeIndexes", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const result = await systemMaintenanceService.optimizeIndexes();
      
      await logAction({
        userId: req.user!.id,
        action: "system_maintenance",
        details: { operation: "optimize_indexes", success: result.success },
        ipAddress: req.ip
      });
      
      res.json(result);
    } catch (error) {
      console.error("Erro ao otimizar índices:", error);
      res.status(500).json({
        success: false,
        message: `Erro ao otimizar índices: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });

  app.post("/api/admin/system-maintenance/rebuildIndexes", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const result = await systemMaintenanceService.rebuildIndexes();
      
      await logAction({
        userId: req.user!.id,
        action: "system_maintenance",
        details: { operation: "rebuild_indexes", success: result.success },
        ipAddress: req.ip
      });
      
      res.json(result);
    } catch (error) {
      console.error("Erro ao reconstruir índices:", error);
      res.status(500).json({
        success: false,
        message: `Erro ao reconstruir índices: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });

  app.post("/api/admin/system-maintenance/updateStatistics", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const result = await systemMaintenanceService.updateStatistics();
      
      await logAction({
        userId: req.user!.id,
        action: "system_maintenance",
        details: { operation: "update_statistics", success: result.success },
        ipAddress: req.ip
      });
      
      res.json(result);
    } catch (error) {
      console.error("Erro ao atualizar estatísticas:", error);
      res.status(500).json({
        success: false,
        message: `Erro ao atualizar estatísticas: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });

  app.post("/api/admin/system-maintenance/vacuumDatabase", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const result = await systemMaintenanceService.vacuumDatabase();
      
      await logAction({
        userId: req.user!.id,
        action: "system_maintenance",
        details: { operation: "vacuum_database", success: result.success },
        ipAddress: req.ip
      });
      
      res.json(result);
    } catch (error) {
      console.error("Erro ao executar vacuum no banco de dados:", error);
      res.status(500).json({
        success: false,
        message: `Erro ao executar vacuum: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });

  app.post("/api/admin/system-maintenance/clearCache", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const result = await systemMaintenanceService.clearCache();
      
      await logAction({
        userId: req.user!.id,
        action: "system_maintenance",
        details: { operation: "clear_cache", success: result.success },
        ipAddress: req.ip
      });
      
      res.json(result);
    } catch (error) {
      console.error("Erro ao limpar cache:", error);
      res.status(500).json({
        success: false,
        message: `Erro ao limpar cache: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });

  app.post("/api/admin/system-maintenance/backupDatabase", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const result = await systemMaintenanceService.backupDatabase();
      
      await logAction({
        userId: req.user!.id,
        action: "system_maintenance",
        details: { operation: "backup_database", success: result.success },
        ipAddress: req.ip
      });
      
      res.json(result);
    } catch (error) {
      console.error("Erro ao criar backup do banco de dados:", error);
      res.status(500).json({
        success: false,
        message: `Erro ao criar backup: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });

  app.post("/api/admin/system-maintenance/restoreDatabase", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const result = await systemMaintenanceService.restoreDatabase();
      
      await logAction({
        userId: req.user!.id,
        action: "system_maintenance",
        details: { operation: "restore_database", success: result.success },
        ipAddress: req.ip
      });
      
      res.json(result);
    } catch (error) {
      console.error("Erro ao restaurar banco de dados:", error);
      res.status(500).json({
        success: false,
        message: `Erro ao restaurar banco de dados: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  });
  
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