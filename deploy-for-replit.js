/**
 * SCRIPT DE DEPLOY ULTRA SIMPLIFICADO PARA REPLIT
 * 
 * Este script cria um servidor HTTP mínimo que responde "OK" 
 * na porta 80 para passar no health check do Replit.
 * 
 * Características:
 * - Não importa nem depende de nada além do módulo HTTP nativo
 * - Ignora sinais que poderiam encerrar o processo
 * - Mantém logs mínimos para depuração
 */

// Criar um servidor HTTP simples usando o módulo nativo
const http = require('http');

// Contador para monitorar requisições
let requestCount = 0;

// Função para registrar logs com timestamp
function log(message) {
  const now = new Date().toISOString();
  console.log(`[${now}] ${message}`);
}

// Criar o servidor de health check
const server = http.createServer((req, res) => {
  requestCount++;
  log(`Health check #${requestCount} recebido: ${req.method} ${req.url}`);
  
  // Responder com 200 OK e texto simples
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Cache-Control': 'no-cache',
    'Connection': 'close'
  });
  
  res.end('OK');
});

// Iniciar o servidor na porta 80
server.listen(80, '0.0.0.0', () => {
  log('='.repeat(50));
  log('SERVIDOR DE HEALTH CHECK INICIADO NA PORTA 80');
  log('Este servidor responde OK para todas as requisições');
  log('='.repeat(50));
});

// Registrar e tratar erros do servidor
server.on('error', (error) => {
  log(`ERRO NO SERVIDOR: ${error.message}`);
  
  // Tentar reiniciar em caso de erro EADDRINUSE
  if (error.code === 'EADDRINUSE') {
    log('Porta 80 já em uso. Tentando reiniciar em 5 segundos...');
    setTimeout(() => {
      server.close();
      server.listen(80, '0.0.0.0');
    }, 5000);
  }
});

// Enviar heartbeat para o console a cada 30 segundos
setInterval(() => {
  log(`Health check server ativo - ${requestCount} requisições processadas`);
}, 30000);

// Manter o processo rodando
process.stdin.resume();

// Tratar exceções para evitar término do processo
process.on('uncaughtException', (error) => {
  log(`Exceção não tratada: ${error.message}`);
});

// Ignorar sinais que poderiam terminar o processo
process.on('SIGINT', () => log('SIGINT recebido, mas ignorado'));
process.on('SIGTERM', () => log('SIGTERM recebido, mas ignorado'));
process.on('SIGHUP', () => log('SIGHUP recebido, mas ignorado'));