/**
 * SERVIDOR HTTP SIMPLES NA PORTA 80
 * 
 * Este script cria um servidor HTTP na porta 80 que
 * responde a todas as requisições com "OK"
 */

const http = require('http');

// Criar servidor na porta 80
http.createServer((req, res) => {
  console.log(`Requisição recebida: ${req.method} ${req.url || '/'}`);
  
  // Sempre responder com status 200 e corpo 'OK'
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Cache-Control': 'no-cache'
  });
  
  res.end('OK');
}).listen(80, '0.0.0.0', () => {
  console.log('---------------------------------');
  console.log('Servidor rodando na porta 80');
  console.log('Respondendo OK a todas requisições');
  console.log('---------------------------------');
});

// Manter o processo ativo
setInterval(() => {
  console.log('Servidor continua ativo');
}, 60000);

// Prevenir término do processo
process.stdin.resume();