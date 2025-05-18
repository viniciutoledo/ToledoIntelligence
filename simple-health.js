// Servidor ultra-minimalista para deploy no Replit
// Remova qualquer coisa que possa causar falha

const http = require('http');

// Servidor que responde OK para qualquer rota
http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('OK');
}).listen(5000, '0.0.0.0', () => {
  console.log('Servidor rodando na porta 5000');
});

// Manter o processo vivo
process.stdin.resume();

// Desabilitar encerramento por exceções
process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});

// Heartbeat simples
setInterval(() => {
  console.log('Servidor ativo');
}, 60000);