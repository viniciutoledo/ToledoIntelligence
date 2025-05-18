// Arquivo index.js mínimo para deploy no Replit
// Colocado na raiz para garantir que o Replit o encontre

const http = require('http');

// Servidor ultra-básico que só responde OK na rota raiz
http.createServer(function(req, res) {
  // Responder OK para qualquer rota
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('OK');
}).listen(5000, '0.0.0.0', function() {
  console.log('Servidor rodando em 0.0.0.0:5000');
});

// Forçar o processo a continuar rodando
process.stdin.resume();