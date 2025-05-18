// Servidor minimalista para o Replit Deployment - Não use para desenvolvimento

const http = require('http');

http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('OK');
}).listen(80, '0.0.0.0', () => {
  console.log('Servidor health check rodando na porta 80');
});

// Impedir que o servidor encerre
process.stdin.resume();