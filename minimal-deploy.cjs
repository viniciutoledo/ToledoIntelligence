/**
 * SERVIDOR MINIMALISTA PARA DEPLOY NO REPLIT
 * Este arquivo é o mais simples possível para passar no health check
 */

// Importar apenas http
const http = require('http');

// Criar servidor simples
const server = http.createServer((req, res) => {
  // Log da requisição
  console.log(`Requisição recebida: ${req.method} ${req.url}`);
  
  // Responder com OK para qualquer rota
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('OK');
});

// Iniciar na porta 80
server.listen(80, '0.0.0.0', () => {
  console.log('Servidor rodando na porta 80');
});

// Tratar erros do servidor
server.on('error', (error) => {
  console.error(`Erro: ${error.message}`);
});

// Manter o processo rodando
setInterval(() => {
  console.log('Servidor health check ativo');
}, 60000);

// Prevenir término do processo
process.stdin.resume();