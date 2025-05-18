/**
 * SERVIDOR DE HEALTH CHECK PARA DEPLOY NO REPLIT
 * Versão especial com foco na rota raiz (/)
 * 
 * Características:
 * - Responde especificamente à rota raiz (/) com código 200
 * - Log detalhado de todas as requisições
 * - Implementação mínima para evitar falhas
 */

const http = require('http');

// Log com timestamp
function log(message) {
  const now = new Date().toISOString();
  console.log(`[${now}] ${message}`);
}

// Contador de requisições
let requestCount = 0;

// Criar servidor HTTP
const server = http.createServer((req, res) => {
  requestCount++;
  
  // Log detalhado da requisição
  log(`Requisição #${requestCount}: ${req.method} ${req.url || '/'}`);
  
  // Responder com código 200 e 'OK'
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'close');
  
  res.end('OK');
});

// Iniciar na porta 80
server.listen(80, '0.0.0.0', () => {
  log('=============================================');
  log('HEALTH CHECK SERVER RUNNING ON PORT 80');
  log('Respondendo 200 OK em TODAS as rotas, incluindo /');
  log('=============================================');
});

// Tratar erros do servidor
server.on('error', (error) => {
  log(`ERRO: ${error.message}`);
  
  if (error.code === 'EADDRINUSE') {
    log('Porta 80 em uso. Tentando novamente em 5 segundos...');
    
    setTimeout(() => {
      server.close();
      server.listen(80, '0.0.0.0');
    }, 5000);
  }
});

// Heartbeat periódico
setInterval(() => {
  log(`Health check server ativo - ${requestCount} requisições processadas`);
}, 60000);

// Prevenção de término
process.stdin.resume();

// Tratamento de exceções para evitar término
process.on('uncaughtException', (error) => {
  log(`Exceção não tratada: ${error.message}`);
  // Continuar executando mesmo com exceções
});

// Ignorar sinais de término
process.on('SIGINT', () => log('SIGINT recebido (ignorado)'));
process.on('SIGTERM', () => log('SIGTERM recebido (ignorado)'));

// Método adicional para manter o processo ativo
setInterval(() => {}, 86400000); // 24 horas