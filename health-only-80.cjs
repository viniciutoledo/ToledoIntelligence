/**
 * SERVIDOR DEDICADO AO HEALTH CHECK NA PORTA 80
 * Este servidor não tenta iniciar qualquer outro processo
 */

// Módulo HTTP nativo
const http = require('http');

// Contador para estatísticas
let requestCount = 0;

// Criar servidor de health check na porta 80
const server = http.createServer((req, res) => {
  requestCount++;
  
  // Log da requisição
  console.log(`Health Check #${requestCount}: ${req.method} ${req.url || '/'}`);
  
  // Responder com status 200 e corpo não-vazio
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  
  // Corpo da resposta não-vazio
  res.end(`OK - Health Check Passed - Request: ${requestCount}`);
});

// Iniciar o servidor na porta 80
server.listen(80, '0.0.0.0', () => {
  console.log('-----------------------------------------');
  console.log(' HEALTH CHECK SERVER RUNNING ON PORT 80');
  console.log(' HANDLING ALL REQUESTS, INCLUDING ROOT (/)');
  console.log('-----------------------------------------');
});

// Tratar erros do servidor
server.on('error', (err) => {
  console.error(`Erro no servidor de health check: ${err.message}`);
  
  if (err.code === 'EADDRINUSE') {
    console.log('A porta 80 já está em uso. Tentando novamente em 10 segundos...');
    setTimeout(() => {
      try {
        server.close();
        server.listen(80, '0.0.0.0');
      } catch (e) {
        console.error(`Erro ao reiniciar: ${e.message}`);
      }
    }, 10000);
  }
});

// Manter o processo ativo
setInterval(() => {
  console.log(`Health check server active - ${requestCount} requests handled`);
}, 30000);

// Tratar exceções para evitar término
process.on('uncaughtException', (err) => {
  console.error(`Exceção capturada: ${err.message}`);
});

process.on('unhandledRejection', (reason) => {
  console.error(`Rejeição não tratada: ${reason}`);
});

// Impedir que sinais terminem o processo
process.on('SIGTERM', () => console.log('SIGTERM recebido, mas ignorado'));
process.on('SIGINT', () => console.log('SIGINT recebido, mas ignorado'));

// Manter o processo vivo
process.stdin.resume();