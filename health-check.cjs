/**
 * SERVIDOR HEALTH CHECK PARA DEPLOY NO REPLIT
 * Este é um servidor HTTP simples que responde apenas na porta 80
 * Usado para passar no health check do Replit durante deploy
 */

// Módulo HTTP nativo - usando sintaxe CommonJS
const http = require('http');

// Responder "OK" para qualquer requisição
const server = http.createServer((req, res) => {
  console.log(`Requisição recebida: ${req.method} ${req.url}`);
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('OK');
});

// Iniciar o servidor na porta 80
server.listen(80, '0.0.0.0', () => {
  console.log('Servidor health check rodando em 0.0.0.0:80');
});

// Manter o processo ativo
process.stdin.resume();

// Lidar com exceções não tratadas
process.on('uncaughtException', (err) => {
  console.error('Erro capturado:', err.message);
});

// Tratar sinais do sistema
process.on('SIGTERM', () => {
  console.log('Sinal SIGTERM recebido, mas continuando execução');
});

process.on('SIGINT', () => {
  console.log('Sinal SIGINT recebido, mas continuando execução');
});

// Log periódico para confirmar que está ativo
setInterval(() => {
  console.log(`[${new Date().toISOString()}] Servidor health check continua ativo`);
}, 30000);