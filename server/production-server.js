// Servidor minimalista para ambiente de produção do Replit
// Este arquivo é usado apenas no ambiente de produção para garantir os health checks

const express = require('express');
const http = require('http');

// Criar o aplicativo Express
const app = express();
const PORT = process.env.PORT || 3000;

// Health check minimalista - responde 'OK' na rota raiz
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send('OK');
});

// Outras rotas de health check
app.get('/health', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send('OK');
});

app.get('/healthz', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send('OK');
});

app.get('/_health', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send('OK');
});

// Redirecionar todas as outras rotas para a aplicação principal
app.use((req, res) => {
  res.redirect('/app');
});

// Criar e iniciar o servidor HTTP
const server = http.createServer(app);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor de produção rodando na porta ${PORT}`);
});

// Manter o processo vivo
process.stdin.resume();

// Tratamento de erros
process.on('uncaughtException', (err) => {
  console.error('Erro não tratado:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Rejeição não tratada:', reason);
});

// Heartbeat para manter o servidor vivo
setInterval(() => {
  console.log('Heartbeat - servidor de produção ativo');
}, 30000);