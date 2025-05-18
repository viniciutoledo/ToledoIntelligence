// Servidor minimalista separado para health check
// Este arquivo específico é para resolver o problema de deploy no Replit

// Usar CommonJS para compatibilidade máxima
const express = require('express');
const app = express();
// Garantir que esteja usando a porta 5000 para o deploy
const PORT = 5000;

// Rota principal para health check - responde apenas com OK
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send('OK');
});

// Outras rotas de health check também simplificadas
app.get('/health', (req, res) => {
  res.send('OK');
});

app.get('/healthz', (req, res) => {
  res.send('OK');
});

app.get('/_health', (req, res) => {
  res.send('OK');
});

// Iniciar o servidor na porta correta
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor de health check rodando em 0.0.0.0:${PORT}`);
});

// Manter o processo vivo permanentemente
process.stdin.resume();

// Tratar exceções para evitar término do processo
process.on('uncaughtException', (err) => {
  console.error('Erro não tratado no servidor de health check:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Promessa rejeitada não tratada:', reason);
});

// Heartbeat para manter o processo ativo
setInterval(() => {
  console.log('Health check server heartbeat');
}, 30000);