/**
 * SERVIDOR DE HEALTH CHECK ULTRA-SIMPLES PARA O REPLIT
 * Faz apenas uma coisa: responder "OK" na porta 80
 */

const http = require('http');

// Criar servidor HTTP
http.createServer((req, res) => {
  // Log simples
  console.log(`[${new Date().toISOString()}] Health check recebido: ${req.method} ${req.url}`);
  
  // Sempre responder com 200 OK
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Cache-Control': 'no-cache'
  });
  
  res.end('OK');
}).listen(80, '0.0.0.0', () => {
  console.log(`[${new Date().toISOString()}] Servidor de health check rodando em 0.0.0.0:80`);
});

// Manter o processo vivo
setInterval(() => {
  console.log(`[${new Date().toISOString()}] Servidor de health check continua ativo`);
}, 30000);

// Impedir finalização do processo
process.stdin.resume();

// Tratar sinais para que o processo não seja encerrado
process.on('SIGINT', () => console.log('Sinal SIGINT ignorado'));
process.on('SIGTERM', () => console.log('Sinal SIGTERM ignorado'));
process.on('uncaughtException', (err) => console.log(`Exceção ignorada: ${err.message}`));