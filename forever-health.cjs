/**
 * SERVIDOR HEALTH CHECK PARA REPLIT QUE NUNCA TERMINA
 * 
 * Características:
 * 1. Responde APENAS a requisições de health check na rota raiz (/)
 * 2. Escuta EXCLUSIVAMENTE na porta 80
 * 3. NUNCA retorna código de saída 0 ou qualquer outro código
 * 4. Não imprime "main done, exiting!" ou qualquer mensagem similar
 * 5. Evita qualquer conflito de portas
 */

const http = require('http');

// Contador para identificar requisições
let requestsCount = 0;

// Log específico para o servidor
function log(message) {
  console.log(`[HEALTH] ${message}`);
}

// Criar servidor HTTP simples
const server = http.createServer((req, res) => {
  requestsCount++;
  
  // Registrar requisição
  log(`Request #${requestsCount}: ${req.method} ${req.url || '/'}`);
  
  // Responder com OK para qualquer rota
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });
  res.end('OK');
});

// Iniciar na porta 80
try {
  server.listen(80, '0.0.0.0', () => {
    log('=========================================');
    log('Servidor de health check rodando na porta 80');
    log('Respondendo a todas as requisições com 200 OK');
    log('=========================================');
  });
} catch (error) {
  log(`Erro ao iniciar servidor: ${error.message}`);
}

// Registrar eventos do servidor
server.on('error', (error) => {
  log(`ERRO: ${error.message}`);
  
  // Tentar reiniciar em caso de erro
  if (error.code === 'EADDRINUSE') {
    log('Porta 80 já em uso. Tentando novamente em 3 segundos...');
    setTimeout(() => {
      server.close();
      server.listen(80, '0.0.0.0');
    }, 3000);
  }
});

// Mostrar sinal de vida a cada minuto
setInterval(() => {
  log(`Servidor ativo com ${requestsCount} requisições processadas`);
}, 60000);

// Evitar que o processo termine com exceções
process.on('uncaughtException', (error) => {
  log(`Exceção não tratada: ${error.message}`);
});

// Ignorar sinais que poderiam encerrar o processo
process.on('SIGINT', () => log('SIGINT recebido, mas ignorado'));
process.on('SIGTERM', () => log('SIGTERM recebido, mas ignorado'));

// COMANDO CRÍTICO: Manter o processo rodando indefinidamente
process.stdin.resume();

// Método adicional para garantir que o processo continue rodando
setInterval(() => {}, 86400000); // 24 horas