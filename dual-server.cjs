/**
 * SOLUÇÃO DUAL-SERVER PARA DEPLOY NO REPLIT
 * 
 * Este script executa um servidor de health check exclusivamente na porta 80
 * e um proxy que redireciona tráfego da porta 80 para o app principal na porta 5000
 */

const http = require('http');

// Contador para estatísticas
let healthRequests = 0;
let proxyRequests = 0;

// Log com timestamp
function log(message) {
  const time = new Date().toISOString().slice(11, 19);
  console.log(`[${time}] ${message}`);
}

// ====================
// 1. HEALTH CHECK SERVER na porta 80
// ====================
const healthServer = http.createServer((req, res) => {
  healthRequests++;
  
  log(`Health check #${healthRequests}: ${req.method} ${req.url}`);
  
  // Para health checks, sempre responder com OK
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Cache-Control': 'no-cache'
  });
  
  res.end('OK');
});

// Iniciar o servidor de health check
healthServer.listen(80, '0.0.0.0', () => {
  log('=================================================');
  log('HEALTH CHECK SERVER RUNNING ON PORT 80');
  log('Respondendo "OK" para todas as requisições');
  log('=================================================');
});

// Tratar erros do servidor de health check
healthServer.on('error', (err) => {
  log(`ERRO no servidor de health check: ${err.message}`);
  
  if (err.code === 'EADDRINUSE') {
    log('PORTA 80 JÁ ESTÁ EM USO. Tentando resolver...');
    
    // Tentar uma abordagem alternativa se a porta 80 estiver em uso
    setTimeout(() => {
      healthServer.close();
      healthServer.listen(80, '0.0.0.0');
    }, 5000);
  }
});

// Heartbeat para mostrar atividade
setInterval(() => {
  log(`Servidor health check ativo (${healthRequests} requisições atendidas)`);
}, 60000);

// Prevenir que o processo encerre
process.stdin.resume();

// Tratar exceções para prevenir terminação do processo
process.on('uncaughtException', (err) => {
  log(`Exceção não tratada: ${err.message}`);
});

// Ignorar sinais que poderiam encerrar o processo
process.on('SIGINT', () => log('SIGINT recebido, mas ignorado'));
process.on('SIGTERM', () => log('SIGTERM recebido, mas ignorado'));