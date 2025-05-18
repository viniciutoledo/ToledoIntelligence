// Arquivo de health check ultra-simplificado para deploy no Replit
// Localizado na raiz como index.js, respondendo na porta 80

const http = require('http');

// Criar um servidor que responde apenas na porta 80
http.createServer((req, res) => {
  // Responder OK para qualquer requisição
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('OK');
}).listen(80, '0.0.0.0', () => {
  console.log('Servidor rodando na porta 80');
});

// Manter o processo vivo e prevenir encerramentos
process.stdin.resume();
process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});