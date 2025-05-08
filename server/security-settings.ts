import { Request, Response } from "express";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { logAction } from "./audit";
import { isAuthenticated, checkRole } from "./auth";
import { storage } from "./storage";
import { Express } from "express";

// Tipos para configurações de segurança
export interface SecuritySettings {
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireSpecialChar: boolean;
    requireNumber: boolean;
    passwordExpiration: number;
  };
  sessionPolicy: {
    sessionTimeout: number;
    maxConcurrentSessions: number;
    enforceDeviceVerification: boolean;
  };
  securityFeatures: {
    requireAdminApproval: boolean;
    twoFactorForAll: boolean;
    twoFactorForAdmin: boolean;
    detectSuspiciousLogins: boolean;
    ipRestrictions: boolean;
  };
}

// Valores padrão para configurações de segurança
const defaultSecuritySettings: SecuritySettings = {
  passwordPolicy: {
    minLength: 6,
    requireUppercase: false,
    requireSpecialChar: false,
    requireNumber: false,
    passwordExpiration: 0,
  },
  sessionPolicy: {
    sessionTimeout: 30,
    maxConcurrentSessions: 2,
    enforceDeviceVerification: false,
  },
  securityFeatures: {
    requireAdminApproval: false,
    twoFactorForAll: false,
    twoFactorForAdmin: false,
    detectSuspiciousLogins: true,
    ipRestrictions: false,
  },
};

// Inicializar configurações de segurança no banco de dados
export async function initializeSecuritySettings() {
  try {
    console.log("Verificando/inicializando configurações de segurança...");
    
    // Verificar se já existem configurações de segurança
    const existingSettings = await db.execute(sql`
      SELECT value FROM system_settings WHERE key = 'security_settings'
    `);
    
    if (!existingSettings.rows || existingSettings.rows.length === 0) {
      // Adicionar configurações padrão
      await db.execute(sql`
        INSERT INTO system_settings (key, value, description, updated_at)
        VALUES ('security_settings', ${JSON.stringify(defaultSecuritySettings)}, 'Configurações avançadas de segurança', NOW())
      `);
      console.log("Configurações de segurança inicializadas com valores padrão");
    } else {
      console.log("Configurações de segurança já existem no banco de dados");
    }
  } catch (error) {
    console.error("Erro ao inicializar configurações de segurança:", error);
  }
}

// Obter configurações de segurança
export async function getSecuritySettings(): Promise<SecuritySettings> {
  try {
    const result = await db.execute(sql`
      SELECT value FROM system_settings WHERE key = 'security_settings'
    `);
    
    if (result.rows && result.rows.length > 0) {
      const valueStr = String(result.rows[0].value);
      return JSON.parse(valueStr);
    }
    
    return defaultSecuritySettings;
  } catch (error) {
    console.error("Erro ao obter configurações de segurança:", error);
    return defaultSecuritySettings;
  }
}

// Atualizar configurações de segurança
export async function updateSecuritySettings(settings: SecuritySettings, userId: number): Promise<boolean> {
  try {
    await db.execute(sql`
      UPDATE system_settings 
      SET value = ${JSON.stringify(settings)}, updated_by = ${userId}, updated_at = NOW()
      WHERE key = 'security_settings'
    `);
    
    return true;
  } catch (error) {
    console.error("Erro ao atualizar configurações de segurança:", error);
    return false;
  }
}

// Obter usuários bloqueados
export async function getBlockedUsers() {
  try {
    const result = await db.execute(sql`
      SELECT id, email, blocked_at, blocked_reason
      FROM users
      WHERE is_blocked = true
      ORDER BY blocked_at DESC
    `);
    
    return result.rows.map(row => ({
      id: row.id,
      email: row.email,
      blockedAt: row.blocked_at,
      reason: row.blocked_reason || "Motivo não especificado"
    }));
  } catch (error) {
    console.error("Erro ao obter usuários bloqueados:", error);
    return [];
  }
}

// Desbloquear um usuário
export async function unblockUser(userId: number, adminId: number): Promise<boolean> {
  try {
    // Desbloquear o usuário
    await db.execute(sql`
      UPDATE users
      SET is_blocked = false, blocked_at = NULL, blocked_reason = NULL
      WHERE id = ${userId}
    `);
    
    // Registrar ação
    await logAction({
      userId: adminId,
      action: "user_unblocked",
      details: { targetUserId: userId },
      ipAddress: "",
    });
    
    return true;
  } catch (error) {
    console.error("Erro ao desbloquear usuário:", error);
    return false;
  }
}

// Registrar endpoints relacionados a segurança
export function registerSecurityRoutes(app: Express) {
  // Endpoint para obter configurações de segurança
  app.get("/api/admin/security/settings", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const settings = await getSecuritySettings();
      res.json(settings);
    } catch (error) {
      console.error("Erro ao obter configurações de segurança:", error);
      res.status(500).json({ error: "Erro ao obter configurações de segurança" });
    }
  });
  
  // Endpoint para atualizar configurações de segurança
  app.post("/api/admin/security/settings", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const settings: SecuritySettings = req.body;
      const success = await updateSecuritySettings(settings, req.user!.id);
      
      if (success) {
        // Registrar ação
        await logAction({
          userId: req.user!.id,
          action: "security_settings_updated",
          details: { settings },
          ipAddress: req.ip
        });
        
        res.json({ success: true, message: "Configurações de segurança atualizadas com sucesso" });
      } else {
        res.status(500).json({ success: false, message: "Erro ao atualizar configurações de segurança" });
      }
    } catch (error) {
      console.error("Erro ao atualizar configurações de segurança:", error);
      res.status(500).json({ success: false, message: "Erro ao atualizar configurações de segurança" });
    }
  });
  
  // Endpoint para obter usuários bloqueados
  app.get("/api/admin/security/blocked-users", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const blockedUsers = await getBlockedUsers();
      res.json(blockedUsers);
    } catch (error) {
      console.error("Erro ao obter usuários bloqueados:", error);
      res.status(500).json({ error: "Erro ao obter usuários bloqueados" });
    }
  });
  
  // Endpoint para desbloquear um usuário
  app.post("/api/admin/security/unblock-user/:userId", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ success: false, message: "ID de usuário inválido" });
      }
      
      const success = await unblockUser(userId, req.user!.id);
      
      if (success) {
        res.json({ success: true, message: "Usuário desbloqueado com sucesso" });
      } else {
        res.status(500).json({ success: false, message: "Erro ao desbloquear usuário" });
      }
    } catch (error) {
      console.error("Erro ao desbloquear usuário:", error);
      res.status(500).json({ success: false, message: "Erro ao desbloquear usuário" });
    }
  });
}