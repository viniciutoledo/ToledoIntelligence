/**
 * SERVIDOR ESPECIALIZADO PARA DEPLOY NO REPLIT
 * Versão final otimizada - 18/05/2025
 */

const http = require('http');

// Criar servidor mínimo
const server = http.createServer((req, res) => {
  // Responder com OK para qualquer rota, incluindo /
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('OK');
});

// Iniciar na porta 80
server.listen(80, '0.0.0.0', () => {
  console.log('Health check server running on port 80');
});

// Manter o processo vivo
setInterval(() => {
  console.log('Health check server still running');
}, 60000);

// Prevenir que o processo termine por erros
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err.message);
});

// Ignorar sinais de término
process.on('SIGINT', () => {});
process.on('SIGTERM', () => {});

// Manter o processo rodando
process.stdin.resume();