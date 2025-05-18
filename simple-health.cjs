/**
 * SERVIDOR SIMPLIFICADO DE HEALTH CHECK PARA REPLIT
 * Este servidor faz APENAS uma coisa: responder "OK" na porta 80
 */

const http = require('http');

// Criar o servidor HTTP mais simples possível
const server = http.createServer((req, res) => {
  // Definir os cabeçalhos para evitar caching
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  
  // Sempre responder com "OK"
  res.end('OK');
  
  // Log para console
  console.log(`[${new Date().toISOString()}] Health check respondido com "OK"`);
});

// Iniciar o servidor na porta 80
server.listen(80, '0.0.0.0', () => {
  console.log(`[${new Date().toISOString()}] Servidor de health check rodando na porta 80`);
});

// Manter o processo rodando indefinidamente
process.stdin.resume();

// Tratar sinais de encerramento para manter o processo vivo
process.on('SIGINT', () => {
  console.log('Sinal SIGINT recebido, mas ignorado para manter o servidor ativo');
});

process.on('SIGTERM', () => {
  console.log('Sinal SIGTERM recebido, mas ignorado para manter o servidor ativo');
});

// Lidar com exceções não tratadas
process.on('uncaughtException', (err) => {
  console.error(`Exceção não tratada: ${err.message}`);
  // Continuar execução mesmo após um erro
});