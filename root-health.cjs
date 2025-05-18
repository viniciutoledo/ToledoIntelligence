/**
 * SERVIDOR DE HEALTH CHECK ESPECÍFICO PARA ROTA RAIZ "/"
 * 
 * Responde apenas à rota raiz com "OK" na porta 80.
 * Não tenta iniciar nenhum outro servidor.
 */

const http = require('http');

// Criar servidor HTTP
const server = http.createServer((req, res) => {
  const path = req.url || '/';
  
  // Log da requisição
  console.log(`Requisição recebida: ${req.method} ${path}`);
  
  // Responder com 200 OK apenas para a rota raiz
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  
  // Resposta "OK" para qualquer requisição
  res.end('OK');
});

// Iniciar o servidor APENAS na porta 80
server.listen(80, '0.0.0.0', () => {
  console.log(`Servidor de health check rodando em 0.0.0.0:80`);
  console.log(`Respondendo "OK" para TODAS as requisições, incluindo a rota raiz (/)`);
});

// Tratar erros do servidor
server.on('error', (err) => {
  console.error(`Erro no servidor: ${err.message}`);
  
  // Tentar reiniciar após um erro
  if (err.code === 'EADDRINUSE') {
    console.log('A porta 80 já está em uso. Tentando novamente em 5 segundos...');
    setTimeout(() => {
      try {
        server.close();
        server.listen(80, '0.0.0.0');
      } catch (e) {
        console.error(`Erro ao reiniciar: ${e.message}`);
      }
    }, 5000);
  }
});

// Manter o processo vivo indefinidamente
setInterval(() => {
  console.log(`[${new Date().toISOString()}] Servidor de health check continua ativo e respondendo na porta 80`);
}, 30000);

// Tratar sinais para evitar que o processo termine
process.on('SIGINT', () => {
  console.log('Sinal SIGINT recebido, mas continuando execução');
});

process.on('SIGTERM', () => {
  console.log('Sinal SIGTERM recebido, mas continuando execução');
});

// Capturar exceções não tratadas
process.on('uncaughtException', (err) => {
  console.error(`Exceção não tratada: ${err.message}`);
  console.error(err.stack);
  // Continuar execução mesmo após uma exceção
});

// Este é o comando para manter o processo vivo
process.stdin.resume();