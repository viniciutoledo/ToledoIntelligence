/**
 * SERVIDOR DE HEALTH CHECK PARA DEPLOY NO REPLIT
 * 
 * Características:
 * - Exclusivamente para o health check do Replit
 * - Isolado do restante da aplicação
 * - Extremamente simples e confiável
 */

// Importar apenas o estritamente necessário
const http = require('http');

// Contador de requisições
let requestCount = 0;

// Função de log com timestamp
const log = (message) => {
  const now = new Date().toLocaleTimeString();
  console.log(`[${now}] ${message}`);
};

// Criar servidor HTTP
const server = http.createServer((req, res) => {
  // Incrementar contador
  requestCount++;
  
  // Registrar no log
  log(`Request #${requestCount}: ${req.method} ${req.url}`);
  
  // Responder sempre com OK
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });
  
  // Resposta simples
  res.end('OK');
});

// Iniciar na porta 80 em todas as interfaces
try {
  server.listen(80, '0.0.0.0', () => {
    log('-----------------------------------');
    log('HEALTH CHECK SERVER RUNNING ON PORT 80');
    log('Responde "OK" para todas as requisições');
    log('-----------------------------------');
  });
} catch (error) {
  log(`Erro ao iniciar na porta 80: ${error.message}`);
  
  // Tentar porta alternativa
  server.listen(8080, '0.0.0.0', () => {
    log('Health check rodando na porta 8080 (alternativa)');
  });
}

// Tratar erros do servidor
server.on('error', (error) => {
  log(`Erro no servidor: ${error.message}`);
});

// Log periódico para mostrar que o processo continua rodando
setInterval(() => {
  log(`Health check server ativo - ${requestCount} requisições atendidas`);
}, 30000);

// Capturar exceções não tratadas
process.on('uncaughtException', (error) => {
  log(`Exceção capturada: ${error.message}`);
});

// Ignorar sinais para evitar término
process.on('SIGINT', () => log('SIGINT recebido - ignorado'));
process.on('SIGTERM', () => log('SIGTERM recebido - ignorado'));

// Manter o processo rodando
process.stdin.resume();

// Método adicional para garantir que o processo não termine
setInterval(() => {}, 3600000);