/**
 * Servidor de healthcheck dedicado para o Replit
 * Implementado conforme sugestão específica do Replit
 */

const http = require('http');

// Criar servidor HTTP simples dedicado ao health check
const server = http.createServer((req, res) => {
  // Responder sempre com status 200 e OK
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

// Evitar que o processo termine
process.stdin.resume();