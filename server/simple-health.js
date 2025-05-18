// Servidor de saúde extremamente simplificado para o Replit
// Alterado para corrigir problemas de implantação

const http = require('http');

// Criar um servidor que responde apenas à rota raiz
const server = http.createServer((req, res) => {
  console.log(`Requisição recebida: ${req.method} ${req.url}`);
  
  // Responder com status 200 e texto "OK" para QUALQUER rota
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('OK');
});

// Porta 80 explicitamente
const PORT = 80;

// Iniciar o servidor em TODAS as interfaces
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor de health check rodando em 0.0.0.0:${PORT}`);
});

// Manter o processo vivo
process.stdin.resume();

// Nenhum manipulador de 'final' ou 'exit'
console.log('Servidor iniciado e mantido vivo');

// Log periódico para verificar o funcionamento
setInterval(() => {
  console.log('Servidor de health check ativo');
}, 30000);