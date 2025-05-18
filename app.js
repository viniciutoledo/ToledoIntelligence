// Servidor exclusivamente para health check
// Esse é um arquivo standalone, sem qualquer dependência

// Módulo HTTP nativo
const http = require('http');

// Responde OK para qualquer rota
const server = http.createServer((req, res) => {
  console.log(`Requisição recebida: ${req.url}`);
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('OK');
});

// Porta 80 é a padrão para HTTP (o Replit espera essa porta)
server.listen(80, '0.0.0.0', () => {
  console.log('Servidor health check ativo na porta 80');
});

// Prevenir que o processo encerre por qualquer motivo
process.stdin.resume();

// Tratamento para erros não capturados
process.on('uncaughtException', (err) => {
  console.error('Erro capturado (servidor continua em execução):', err);
  // Não encerrar o servidor
});

process.on('unhandledRejection', (reason) => {
  console.error('Promessa rejeitada (servidor continua em execução):', reason);
  // Não encerrar o servidor
});

// Log a cada minuto para confirmar que está em execução
setInterval(() => {
  console.log(`Servidor health check continua ativo em ${new Date().toISOString()}`);
}, 60000);