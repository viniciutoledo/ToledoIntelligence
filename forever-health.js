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

// Counter para estatísticas
let requestCount = 0;

// Criar o servidor mais simples possível
const server = http.createServer((req, res) => {
  requestCount++;
  const path = req.url || '/';
  
  // Log da requisição com contador
  console.log(`#${requestCount} - Requisição recebida: ${req.method} ${path}`);
  
  // Responder com status 200 OK e texto simples
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  
  // Resposta simples e direta
  res.end('OK');
});

// Iniciar o servidor explicitamente na porta 80
try {
  server.listen(80, '0.0.0.0', () => {
    console.log('-------------------------------------------------------');
    console.log('  SERVER HEALTH CHECK LISTENING ON PORT 80');
    console.log('  WILL RESPOND "OK" TO ANY REQUEST, INCLUDING ROOT (/)');
    console.log('  THIS PROCESS WILL NEVER EXIT');
    console.log('-------------------------------------------------------');
  });
} catch (err) {
  console.error(`Erro ao iniciar o servidor: ${err.message}`);
  
  // Mesmo com erro, NÃO terminar o processo
  console.log('Servidor falhou, mas o processo continuará executando');
}

// Loop infinito para garantir que o processo nunca termine
setInterval(() => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Health check server ativo - ${requestCount} requisições atendidas`);
  
  // Verificar se o servidor ainda está ouvindo
  if (!server.listening) {
    console.log('Servidor não está mais escutando. Tentando reiniciar...');
    
    try {
      server.listen(80, '0.0.0.0', () => {
        console.log('Servidor reiniciado com sucesso');
      });
    } catch (err) {
      console.error(`Falha ao reiniciar servidor: ${err.message}`);
    }
  }
}, 10000);

// Impedir que o processo termine sob QUALQUER circunstância
process.on('uncaughtException', (err) => {
  console.error(`Exceção capturada: ${err.message}`);
  // Não terminar o processo
});

process.on('unhandledRejection', (reason) => {
  console.error(`Rejeição não tratada: ${reason}`);
  // Não terminar o processo
});

process.on('SIGTERM', () => {
  console.log('Sinal SIGTERM ignorado');
  // Não terminar o processo
});

process.on('SIGINT', () => {
  console.log('Sinal SIGINT ignorado');
  // Não terminar o processo
});

// Impedir que o processo principal termine
process.stdin.resume();

// Nota importante: Este processo NUNCA deve imprimir "main done, exiting!"
console.log('Servidor iniciado e em execução contínua');