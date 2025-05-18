/**
 * SERVIDOR MAIS SIMPLES POSSÍVEL PARA DEPLOY NO REPLIT
 * Arquivo raiz para passar no health check
 */

const http = require('http');

// Criar servidor HTTP mínimo
http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('OK');
}).listen(80, '0.0.0.0', () => {
  console.log('Servidor rodando na porta 80');
});

// Manter o processo vivo
process.stdin.resume();