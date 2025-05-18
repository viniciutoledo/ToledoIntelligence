/**
 * SERVIDOR HTTP PARA DEPLOY NO REPLIT
 * Versão ultra simplificada para health checks
 */

// Criar servidor HTTP simples para responder ao health check
require('http')
  .createServer((req, res) => {
    // Log da requisição
    console.log(`Requisição: ${req.method} ${req.url}`);
    
    // Responder sempre com status 200 e OK
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('OK');
  })
  .listen(80, () => {
    console.log('Servidor rodando na porta 80');
  });

// Manter o processo rodando indefinidamente
setInterval(() => {
  console.log('Servidor ativo');
}, 60000);

// Tratar erros para que o processo não termine
process.on('uncaughtException', (err) => {
  console.log(`Erro: ${err.message}`);
});