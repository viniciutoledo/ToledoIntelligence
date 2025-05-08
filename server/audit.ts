import { storage } from "./storage";
import { InsertAuditLog } from "@shared/schema";

interface AuditLogParams {
  userId?: number;
  action: string;
  details?: Record<string, any>;
  ipAddress?: string;
}

// Log an action to the audit log
export async function logAction(params: AuditLogParams): Promise<void> {
  try {
    const logData: InsertAuditLog = {
      user_id: params.userId,
      action: params.action,
      details: params.details || {},
      ip_address: params.ipAddress
    };
    
    await storage.createAuditLog(logData);
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
}

// Get audit log entry text based on action and language
export function getAuditLogText(action: string, details: Record<string, any>, language: string): string {
  switch (action) {
    case "document_auto_recovery":
      return language === "pt"
        ? `Documento recuperado automaticamente: ${details.documentName} (ID: ${details.documentId}), progresso: ${details.progress || 0}%`
        : `Document auto-recovered: ${details.documentName} (ID: ${details.documentId}), progress: ${details.progress || 0}%`;
    
    case "user_registered":
      return language === "pt"
        ? `Usuário registrado: ${details.email}`
        : `User registered: ${details.email}`;
        
    case "user_login":
      return language === "pt"
        ? `Login de usuário bem-sucedido`
        : `User login successful`;
        
    case "user_logout":
      return language === "pt"
        ? `Logout de usuário`
        : `User logout`;
        
    case "account_blocked":
      return language === "pt"
        ? `Conta bloqueada: ${details.reason === "multiple_sessions" ? "múltiplas sessões" : details.reason}`
        : `Account blocked: ${details.reason === "multiple_sessions" ? "multiple sessions" : details.reason}`;
        
    case "user_unblocked":
      return language === "pt"
        ? `Usuário desbloqueado: ${details.email || ''}`
        : `User unblocked: ${details.email || ''}`;
        
    case "2fa_enabled":
      return language === "pt"
        ? `Autenticação de dois fatores ativada`
        : `Two-factor authentication enabled`;
        
    case "2fa_disabled":
      return language === "pt"
        ? `Autenticação de dois fatores desativada`
        : `Two-factor authentication disabled`;
        
    case "language_changed":
      return language === "pt"
        ? `Idioma alterado para: ${details.language === "pt" ? "Português" : "Inglês"}`
        : `Language changed to: ${details.language === "pt" ? "Portuguese" : "English"}`;
        
    case "llm_config_created":
      return language === "pt"
        ? `Configuração LLM criada: ${details.model}`
        : `LLM configuration created: ${details.model}`;
        
    case "llm_config_activated":
      return language === "pt"
        ? `Configuração LLM ativada: ${details.model}`
        : `LLM configuration activated: ${details.model}`;
        
    case "avatar_created":
      return language === "pt"
        ? `Avatar criado: ${details.name}`
        : `Avatar created: ${details.name}`;
        
    case "avatar_updated":
      return language === "pt"
        ? `Avatar atualizado: ${details.name}`
        : `Avatar updated: ${details.name}`;
        
    case "avatar_activated":
      return language === "pt"
        ? `Avatar ativado: ${details.name}`
        : `Avatar activated: ${details.name}`;
        
    case "avatar_reset":
      return language === "pt"
        ? `Avatar redefinido para o padrão`
        : `Avatar reset to default`;
        
    default:
      return language === "pt"
        ? `Ação: ${action}`
        : `Action: ${action}`;
  }
}
