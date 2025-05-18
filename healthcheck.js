// Healthcheck.js - Arquivo simplificado para health check
// Colocado na raiz do projeto para fácil acesso pelo Replit

const http = require('http');

// Criar um servidor super simples que responde apenas na porta 5000
const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] Requisição recebida: ${req.method} ${req.url}`);
  
  // Responder a qualquer rota com OK
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('OK');
});

// Usar PORT do ambiente ou 5000 como fallback
const PORT = process.env.PORT || 5000;

// Iniciar o servidor em todas as interfaces
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor de health check rodando em 0.0.0.0:${PORT}`);
  console.log(`Ambiente: ${process.env.NODE_ENV || 'production'}`);
  console.log(`PORT configurado como: ${PORT}`);
});

// Certificar-se de que o processo continues rodando
process.stdin.resume();

// Log contínuo para verificar o funcionamento
setInterval(() => {
  console.log(`[${new Date().toISOString()}] Servidor de health check continua ativo na porta ${PORT}`);
}, 30000);

// Tratamento abrangente de exceções
process.on('uncaughtException', (err) => {
  console.error('Erro não tratado capturado:', err);
  // NÃO encerrar o processo
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promessa rejeitada não tratada:', reason);
  // NÃO encerrar o processo
});