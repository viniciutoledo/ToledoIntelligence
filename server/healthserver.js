// Servidor minimalista dedicado ao health check para deploy no Replit
// Implementando exatamente o que o Replit recomenda para resolver problemas de deploy

// Importações necessárias
const express = require('express');
const app = express();

// Definir a porta 5000 explicitamente (sem usar variável de ambiente)
const PORT = 5000;

// Rota principal para health check - extremamente simplificada
app.get('/', (req, res) => {
  res.status(200).send('OK');
});

// Evitar interferência com outras rotas
app.use('*', (req, res) => {
  if (req.path !== '/') {
    res.redirect('/app');
  }
});

// Iniciar o servidor escutando em todas as interfaces
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor de health check rodando em 0.0.0.0:${PORT}`);
});

// Evitar que o processo termine
process.stdin.resume();

// Log para confirmar funcionamento
console.log('Health check server iniciado com sucesso');

// Heartbeat
setInterval(() => {
  console.log('Health check server heartbeat');
}, 30000);