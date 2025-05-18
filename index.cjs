/**
 * SERVIDOR ULTRA SIMPLES PARA DEPLOY
 * Este código tem apenas uma função: responder "OK" na porta 80
 */

const http = require('http');

// Criar um servidor HTTP ultra simples
const server = http.createServer((req, res) => {
  // Sempre responder 200 OK
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Cache-Control': 'no-cache'
  });
  
  // Responder com texto visível
  res.end('OK - Health Check Passed');
  
  // Log simples
  console.log(`Request received: ${req.method} ${req.url || '/'}`);
});

// Iniciar o servidor APENAS na porta 80
server.listen(80, '0.0.0.0', () => {
  console.log('Health check server running on port 80');
});

// Evitar que o processo termine
process.stdin.resume();

// Evitar que exceções não tratadas fechem o servidor
process.on('uncaughtException', (err) => {
  console.error(`Caught exception: ${err.message}`);
});

// Ignorar sinais de término
process.on('SIGTERM', () => console.log('SIGTERM received but ignored'));
process.on('SIGINT', () => console.log('SIGINT received but ignored'));