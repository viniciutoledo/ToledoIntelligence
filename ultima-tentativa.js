// Servidor HTTP extremamente simples para health checks do Replit
// Versão final com foco em compatibilidade com o Deploy

// Módulo HTTP nativo
const http = require('http');

// Registrar processo para prevenir saída automática
process.stdin.resume();

// Criar servidor que responde para qualquer rota inclusive a raiz
const server = http.createServer((req, res) => {
  // Log com timestamp
  console.log(`[${new Date().toISOString()}] Requisição recebida: ${req.method} ${req.url}`);
  
  // Responder com 200 OK
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('OK');
});

// Escutar na porta 80 em todas as interfaces
server.listen(80, '0.0.0.0', () => {
  console.log('Servidor health check ativo em 0.0.0.0:80');
});

// Tratamento global de exceções para garantir que o processo continue
process.on('uncaughtException', (err) => {
  console.error('Erro capturado:', err.message);
});

// Tratamento global de promessas rejeitadas não tratadas
process.on('unhandledRejection', (reason) => {
  console.error('Promessa rejeitada não tratada:', reason);
});

// Responder ao sinal de SIGTERM mas não encerrar o processo
process.on('SIGTERM', () => {
  console.log('Recebido sinal SIGTERM, mas continuando a execução');
});

// Heartbeat a cada 10 segundos para confirmar que está ativo
setInterval(() => {
  console.log(`Heartbeat - servidor health check ativo às ${new Date().toISOString()}`);
}, 10000);