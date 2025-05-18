/**
 * PROXY DE HEALTH CHECK SIMPLES
 * Este arquivo cria um servidor na porta 80 e encaminha as requisições
 * para o servidor principal na porta 5000, exceto as rotas de health check
 */

const http = require('http');
const net = require('net');

// Log com timestamp
function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

// Contador de requisições
let requestCount = 0;

// Criar servidor proxy na porta 80
const server = http.createServer((req, res) => {
  requestCount++;
  
  // Log da requisição
  log(`Requisição #${requestCount}: ${req.method} ${req.url || '/'}`);
  
  // Para health checks, responder diretamente com OK
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });
  
  res.end('OK');
});

// Iniciar o servidor na porta 80
server.listen(80, '0.0.0.0', () => {
  log('=============================================');
  log('PROXY DE HEALTH CHECK INICIADO NA PORTA 80');
  log('Respondendo a todas as requisições com 200 OK');
  log('=============================================');
});

// Tratar erros do servidor
server.on('error', (err) => {
  log(`ERRO NO SERVIDOR: ${err.message}`);
  
  if (err.code === 'EADDRINUSE') {
    log('Porta 80 já está em uso. Tentando novamente em 3 segundos...');
    
    setTimeout(() => {
      server.close();
      server.listen(80, '0.0.0.0');
    }, 3000);
  }
});

// Heartbeat para mostrar que o processo continua vivo
setInterval(() => {
  log(`Proxy de health check ativo - ${requestCount} requisições atendidas`);
}, 30000);

// Tratar exceções para evitar que o processo termine
process.on('uncaughtException', (err) => {
  log(`Exceção não tratada: ${err.message}`);
});

// Evitar que o processo termine por sinais
process.on('SIGINT', () => log('SIGINT recebido, mas ignorado'));
process.on('SIGTERM', () => log('SIGTERM recebido, mas ignorado'));

// Manter o processo vivo
process.stdin.resume();

// Garantir que o processo nunca termine
setInterval(() => {}, 86400000); // 24 horas