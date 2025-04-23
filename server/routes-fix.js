// Este arquivo contém apenas rotas temporárias para diagnóstico e correção

const express = require('express');
const router = express.Router();

// Importar as dependências necessárias
const { storage } = require('./storage');
const { db } = require('./db');
const { eq } = require('drizzle-orm');
const { users, user_active_sessions } = require('../shared/schema');
const { logAction } = require('./audit');

// Rota para visualizar usuários
router.get('/users-check', async (req, res) => {
  try {
    const allUsers = await db.select().from(users);
    const simplifiedUsers = allUsers.map(user => ({
      id: user.id,
      email: user.email,
      role: user.role,
      is_blocked: user.is_blocked
    }));
    res.json({ users: simplifiedUsers });
  } catch (error) {
    console.error("Erro ao listar usuários:", error);
    res.status(500).json({ message: "Erro ao listar usuários" });
  }
});

// Rota para visualizar sessões ativas
router.get('/active-sessions', async (req, res) => {
  try {
    const activeSessions = await db.select().from(user_active_sessions);
    res.json({ activeSessions });
  } catch (error) {
    console.error("Erro ao listar sessões ativas:", error);
    res.status(500).json({ message: "Erro ao listar sessões ativas" });
  }
});

// Rota para atualizar o papel de um usuário
router.post('/fix-user-role', async (req, res) => {
  try {
    const { email, role: newRole } = req.body;
    
    if (!email || !newRole || (newRole !== "technician" && newRole !== "admin")) {
      return res.status(400).json({ message: "Email e papel válido (technician ou admin) são obrigatórios" });
    }
    
    const user = await storage.getUserByEmail(email);
    
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }
    
    // Limpar sessões ativas do usuário
    try {
      await db.delete(user_active_sessions).where(eq(user_active_sessions.user_id, user.id)).execute();
      console.log(`Sessões ativas do usuário ${user.email} (ID: ${user.id}) foram limpas durante a alteração de papel`);
    } catch (sessionError) {
      console.error("Erro ao limpar sessão ativa:", sessionError);
    }
    
    // Atualiza o papel do usuário
    await db.update(users)
      .set({ role: newRole })
      .where(eq(users.email, email))
      .execute();
    
    // Buscar o usuário atualizado
    const updatedUser = await storage.getUserByEmail(email);
    
    // Log da ação
    await logAction({
      action: "user_role_updated_diagnostic",
      details: { userId: user.id, email: user.email, oldRole: user.role, newRole },
      ipAddress: req.ip
    });
    
    res.json({ 
      message: `Papel do usuário ${email} atualizado para ${newRole}`,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role
      }
    });
  } catch (error) {
    console.error("Erro ao atualizar papel do usuário:", error);
    res.status(500).json({ message: "Erro ao atualizar papel do usuário" });
  }
});

// Rota para limpar a sessão ativa de um usuário específico
router.post('/clear-sessions', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email é obrigatório' });
    }
    
    // Buscar o usuário pelo email
    const user = await storage.getUserByEmail(email);
    
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }
    
    // Remover a sessão ativa do storage
    try {
      await storage.removeUserActiveSession(user.id);
    } catch (storageError) {
      console.error('Erro ao limpar sessão no storage:', storageError);
    }
    
    // Também limpar a sessão do banco de dados diretamente (garantia adicional)
    try {
      await db.delete(user_active_sessions)
        .where(eq(user_active_sessions.user_id, user.id))
        .execute();
    } catch (dbError) {
      console.error('Erro ao limpar sessão no banco:', dbError);
    }
    
    // Log da ação
    await logAction({
      action: "user_session_cleared_diagnostic",
      details: { userId: user.id, email: user.email },
      ipAddress: req.ip
    });
    
    return res.json({ 
      message: `Sessões ativas do usuário ${email} foram limpas com sucesso!`,
      userId: user.id
    });
  } catch (error) {
    console.error('Erro ao limpar sessão ativa:', error);
    return res.status(500).json({ 
      message: 'Erro ao limpar sessão ativa', 
      error: error.message 
    });
  }
});

module.exports = router;