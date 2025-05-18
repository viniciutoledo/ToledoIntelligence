/**
 * SERVIDOR ULTRA SIMPLIFICADO PARA HEALTH CHECK
 * Este arquivo só tem um objetivo: responder OK na porta 80
 */

const http = require('http');

// Criar servidor HTTP simples
const server = http.createServer((req, res) => {
  res.writeHead(200, { 
    'Content-Type': 'text/plain',
    'Cache-Control': 'no-cache'
  });
  res.end('OK');
});

// Iniciar na porta 80
server.listen(80, '0.0.0.0', () => {
  console.log('Servidor de health check rodando na porta 80');
});

// Manter o processo rodando
process.stdin.resume();

// Evitar que o processo termine por erros ou sinais
process.on('uncaughtException', (err) => console.error(err));
process.on('unhandledRejection', (err) => console.error(err));
process.on('SIGINT', () => {});
process.on('SIGTERM', () => {});