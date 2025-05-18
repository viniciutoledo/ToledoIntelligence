// Arquivo para resolver problemas de deploy no Replit
// Este arquivo deve ser colocado na raiz do projeto, exatamente como recomendado pelo assistente

// Usar o módulo HTTP nativo
const http = require('http');

// Criar um servidor super simples para health checks
const server = http.createServer((req, res) => {
  // Responder a qualquer rota com OK
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('OK');
});

// Usar a porta 5000 explicitamente, sem variáveis de ambiente
const PORT = 5000;

// Iniciar o servidor
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor de health check rodando em 0.0.0.0:${PORT}`);
});

// Evitar que o processo termine
console.log('Mantendo o processo vivo...');
process.stdin.resume();

// Evitar que erros encerrem o processo
process.on('uncaughtException', (err) => {
  console.error('Erro capturado:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promessa rejeitada não tratada:', reason);
});

// Verificação periódica para confirmar que está funcionando
setInterval(() => {
  console.log('Health check server ainda ativo');
}, 30000);