/**
 * SERVIDOR MÍNIMO PARA DEPLOY NO REPLIT
 * Diretamente focado em health checks
 */
const http = require('http');
const server = http.createServer((req, res) => {
  console.log(`Requisição recebida: ${req.method} ${req.url}`);
  
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('OK');
});

server.listen(80, '0.0.0.0', () => {
  console.log('Servidor rodando na porta 80');
});

// Evita que o processo termine
process.stdin.resume();

// Loop infinito para manter o processo vivo
setInterval(() => {
  console.log('Servidor ativo');
}, 60000);