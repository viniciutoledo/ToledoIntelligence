// Arquivo healthcheck.js dedicado para manter o servidor rodando
// Este arquivo foi criado seguindo as instruções específicas do assistente Replit

// Usar módulo HTTP nativo do Node.js
const http = require('http');

// Configurar o servidor
const server = http.createServer((req, res) => {
  // Registrar cada requisição recebida para diagnosticar problemas
  console.log(`[${new Date().toISOString()}] Recebida requisição ${req.method} para ${req.url}`);
  
  // Responder com status 200 OK para qualquer requisição
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('OK');
});

// Definir porta fixamente para 5000 (sem usar variáveis de ambiente)
const PORT = 5000;

// Iniciar o servidor escutando em todas interfaces
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor healthcheck iniciado em 0.0.0.0:${PORT}`);
});

// Garantir que o processo não encerre
process.stdin.resume();

// Tratar exceções para impedir encerramento
process.on('uncaughtException', (err) => {
  console.error('Erro capturado (não encerrando):', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Rejeição não tratada (não encerrando):', reason);
});

// Emitir mensagem periódica para verificar funcionamento
setInterval(() => {
  console.log(`Health check server continua ativo na porta ${PORT}`);
}, 30000);