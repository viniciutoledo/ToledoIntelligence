// Servidor extremamente simples que apenas mantém o processo vivo
// e responde "OK" na rota raiz, sem depender de nenhum outro módulo

// Usar apenas o módulo HTTP nativo
const http = require('http');

// Criar um servidor básico
const server = http.createServer((req, res) => {
  // Responder à rota raiz
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('OK');
});

// Usar a porta 5000 explicitamente
const PORT = 5000;

// Iniciar o servidor e manter em execução
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor simples ativo na porta ${PORT}`);
});

// Manter o processo em execução
setInterval(() => {
  console.log('Mantendo o servidor ativo...');
}, 30000);

// Impedir que o processo termine
process.stdin.resume();

// Evitar que exceções não tratadas terminem o processo
process.on('uncaughtException', (err) => {
  console.error('Erro capturado (processo continuará em execução):', err);
});