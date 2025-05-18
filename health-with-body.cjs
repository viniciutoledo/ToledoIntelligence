/**
 * SERVIDOR DE HEALTH CHECK ESPECIALIZADO
 * Versão com corpo de resposta "OK" e status 200
 */

// Servidor HTTP simples
const http = require('http');

// Criar servidor que responde OK para todas as requisições
const server = http.createServer((req, res) => {
  // Log da requisição
  console.log(`${new Date().toISOString()} - Requisição recebida: ${req.method} ${req.url}`);
  
  // Responder com status 200 "OK"
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Cache-Control': 'no-cache',
    'Connection': 'close'
  });
  
  // Corpo da resposta
  res.end('OK');
});

// Iniciar o servidor na porta 80
server.listen(80, '0.0.0.0', () => {
  console.log(`${new Date().toISOString()} - Servidor de health check ativo na porta 80`);
});

// Tratar erros
server.on('error', (error) => {
  console.error(`${new Date().toISOString()} - Erro: ${error.message}`);
});

// Manter o processo ativo
process.stdin.resume();

// Prevenir término do processo
process.on('uncaughtException', (err) => {
  console.error(`${new Date().toISOString()} - Exceção: ${err.message}`);
});