/**
 * SOLUÇÃO FINAL PARA HEALTH CHECK DO REPLIT
 */

const http = require('http');

// Criar servidor de health check
http.createServer((req, res) => {
  // Log da requisição
  console.log(`Requisição recebida: ${req.method} ${req.url}`);
  
  // Responder com 200 OK para qualquer requisição
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Cache-Control': 'no-cache'
  });
  
  res.end('OK');
}).listen(80, '0.0.0.0', () => {
  console.log('Servidor escutando na porta 80');
});

// Manter o processo rodando
process.stdin.resume();