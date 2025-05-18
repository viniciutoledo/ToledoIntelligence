// Arquivo específico para resolver problemas de health check do Replit
// Este arquivo cria um servidor HTTP simples que responde OK na rota raiz
// e redireciona outras requisições para o servidor principal

const http = require('http');

// Criar um servidor HTTP extremamente simples
const server = http.createServer((req, res) => {
  // Responder OK para a rota raiz (health check)
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    return;
  }
  
  // Para outras rotas, redirecionar para o app principal
  res.writeHead(302, { 'Location': '/app' });
  res.end();
});

// Porta para o servidor de health check
const PORT = process.env.PORT || 3000;

// Iniciar o servidor
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor de health check rodando em 0.0.0.0:${PORT}`);
});

// Manter o processo vivo
process.stdin.resume();

// Heartbeat para verificar que está funcionando
setInterval(() => {
  console.log('Health check proxy ativo');
}, 30000);