/**
 * SERVIDOR NA PORTA 80 EXCLUSIVAMENTE PARA HEALTH CHECK
 * Versão final simplificada - 18/05/2025
 */

// Importar HTTP
const http = require('http');

// Criar servidor HTTP
const server = http.createServer((req, res) => {
  // Para toda e qualquer requisição, responder com OK
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OK');
});

// Iniciar servidor na porta 80 correta
server.listen(80, '0.0.0.0', () => {
  console.log('Servidor de health check rodando na porta 80');
});

// Manter o processo rodando
process.stdin.resume();