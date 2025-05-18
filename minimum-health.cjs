/**
 * SERVIDOR HEALTH CHECK ABSOLUTAMENTE MÍNIMO
 * Sem frills, sem nada além do essencial
 */

// Servidor HTTP básico
require('http')
  .createServer((req, res) => {
    // Log simples
    console.log(`Req: ${req.method} ${req.url}`);
    
    // Status 200 e resposta simples
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('OK');
  })
  .listen(80, '0.0.0.0', () => {
    console.log('Health check server: port 80');
  });

// Manter processo vivo
process.stdin.resume();

// Ignorar exceções para evitar término prematuro
process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});
process.on('SIGTERM', () => {});
process.on('SIGINT', () => {});