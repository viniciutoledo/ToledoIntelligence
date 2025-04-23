// Este arquivo contém apenas rotas temporárias para diagnóstico e correção

const express = require('express');
const router = express.Router();

// Importar as dependências necessárias
const { storage } = require('./storage');
const { db } = require('./db');
const { eq } = require('drizzle-orm');
const { users } = require('../shared/schema');

// Rota para limpar a sessão ativa de um usuário específico
router.post('/clear-active-session', async (req, res) => {
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
    
    // Remover a sessão ativa
    await storage.removeUserActiveSession(user.id);
    
    // Também limpar a sessão do banco de dados diretamente (backup)
    try {
      await db.execute(`
        DELETE FROM user_active_sessions 
        WHERE user_id = $1
      `, [user.id]);
    } catch (dbError) {
      console.error('Erro ao limpar sessão no banco:', dbError);
    }
    
    // Atualizar o usuário para ter certeza que está com o papel correto
    await db.update(users)
      .set({ role: 'technician' })
      .where(eq(users.email, email))
      .execute();
    
    return res.json({ 
      message: `Sessão ativa do usuário ${email} foi limpa com sucesso!`,
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