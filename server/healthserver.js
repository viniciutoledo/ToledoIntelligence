// Servidor de health check dedicado para Replit
// Este arquivo NÃO deve ter "main done" ou qualquer código que encerre o processo

const http = require('http');

// Servidor que apenas retorna OK em status 200
const server = http.createServer((req, res) => {
  console.log(`Recebida requisição health check: ${req.url}`);
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('OK');
});

// Porta 5000 fixamente configurada
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

// Iniciar o servidor com log
server.listen(PORT, HOST, () => {
  console.log(`Servidor de health check rodando em ${HOST}:${PORT}`);
});

// Manter o processo vivo
process.stdin.resume();

// Tratar exceções para evitar que o processo termine
process.on('uncaughtException', (err) => {
  console.error('Exceção não tratada:', err);
  // NÃO finalizar o processo
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Rejeição não tratada:', reason);
  // NÃO finalizar o processo
});

// Log periódico para mostrar que o servidor ainda está ativo
setInterval(() => {
  console.log('Health check server ativo');
}, 30000);