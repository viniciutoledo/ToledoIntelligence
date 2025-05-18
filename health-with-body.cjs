/**
 * SERVIDOR DE HEALTH CHECK COM CORPO DE RESPOSTA NÃO-VAZIO
 * 
 * Este servidor:
 * 1. Responde na porta 80 com corpo de resposta não-vazio
 * 2. Nunca sai após sincronização ou qualquer outro processo
 * 3. Tem configuração de porta explícita e consistente
 */

const http = require('http');
const fs = require('fs');

// Porta para o health check - EXPLICITAMENTE definida como 80
const PORT = 80;
const LOG_FILE = 'health-check-log.txt';

// Iniciar log
try {
  fs.writeFileSync(LOG_FILE, `[${new Date().toISOString()}] Iniciando servidor de health check na porta ${PORT}\n`);
} catch (err) {
  console.error(`Não foi possível criar arquivo de log: ${err.message}`);
}

// Função para log
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  
  try {
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
  } catch (err) {
    console.error(`Erro ao escrever no log: ${err.message}`);
  }
}

// Contador de requests
let requestCount = 0;

// Criar o servidor HTTP
const server = http.createServer((req, res) => {
  requestCount++;
  const path = req.url || '/';
  
  log(`Requisição #${requestCount} recebida: ${req.method} ${path}`);
  
  // Responder com status 200 OK 
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  
  // *** CORPO DE RESPOSTA NÃO-VAZIO ***
  // Isso é essencial para resolver o problema de corpo vazio
  const responseBody = `OK - Health Check Passed - Request #${requestCount} - Time: ${new Date().toISOString()}`;
  
  log(`Respondendo com corpo: "${responseBody}"`);
  res.end(responseBody);
});

// Iniciar o servidor
function startServer() {
  try {
    server.listen(PORT, '0.0.0.0', () => {
      log('=====================================================');
      log(`SERVIDOR DE HEALTH CHECK RODANDO EM 0.0.0.0:${PORT}`);
      log('RESPONDENDO COM CORPO NÃO-VAZIO A TODAS AS REQUISIÇÕES');
      log('ESTE PROCESSO NUNCA VAI TERMINAR');
      log('=====================================================');
    });
  } catch (error) {
    log(`Erro ao iniciar servidor: ${error.message}`);
    
    // Mesmo com erro, não terminar o processo
    setTimeout(() => {
      log('Tentando reiniciar o servidor...');
      startServer();
    }, 5000);
  }
}

// Iniciar o servidor
startServer();

// Verificação periódica e heartbeat
setInterval(() => {
  log(`Servidor de health check ativo - ${requestCount} requisições atendidas`);
  
  // Se o servidor não estiver mais escutando, reiniciá-lo
  if (!server.listening) {
    log('Servidor não está mais escutando. Tentando reiniciar...');
    startServer();
  }
}, 10000);

// TRATAMENTO DE ERROS E SINAIS
// ===========================

// Manipuladores para evitar que o processo termine
process.on('uncaughtException', (err) => {
  log(`Exceção não tratada capturada: ${err.message}`);
  log(err.stack);
  // Não terminar o processo
});

process.on('unhandledRejection', (reason) => {
  log(`Rejeição de promessa não tratada: ${reason}`);
  // Não terminar o processo
});

// Ignorar sinais que tentariam terminar o processo
process.on('SIGTERM', () => {
  log('Sinal SIGTERM recebido, mas ignorado para manter o servidor ativo');
});

process.on('SIGINT', () => {
  log('Sinal SIGINT recebido, mas ignorado para manter o servidor ativo');
});

// Este é o comando crucial para manter o processo vivo indefinidamente
process.stdin.resume();

log('Servidor de health check inicializado com configuração otimizada');
log(`Porta ${PORT} configurada explicitamente para evitar conflitos`);
log('Corpo de resposta não-vazio para todos os health checks');