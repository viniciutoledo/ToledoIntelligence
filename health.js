// Servidor HTTP básico exclusivamente para health check no Replit
// Arquivo simplificado para resolver problemas de deploy

// Módulo HTTP nativo
const http = require('http');

// Servidor que responde a TODAS requisições com 200 OK
const server = http.createServer(function(req, res) {
  // Registrar cada requisição para debug
  console.log(`Recebida requisição: ${req.method} ${req.url}`);
  
  // Responder 200 OK para qualquer rota, incluindo a raiz
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('OK');
});

// Escutar na porta definida pelo ambiente ou 80 como fallback
// Importante: Em produção o Replit usa a variável PORT
const PORT = process.env.PORT || 80;

// Escutar em todas as interfaces de rede (importante para Replit)
server.listen(PORT, '0.0.0.0', function() {
  console.log(`Servidor rodando em 0.0.0.0:${PORT}`);
  console.log(`Versão do Node: ${process.version}`);
  console.log(`Ambiente: ${process.env.NODE_ENV || 'production'}`);
  console.log(`Variável PORT: ${process.env.PORT || 'não definida, usando 80'}`);
});

// Manter o processo vivo
process.stdin.resume();

// Handler para erros inesperados
process.on('uncaughtException', function(err) {
  console.error('Erro não tratado:', err);
  // NÃO encerrar o processo
});

// Log periódico para verificar funcionamento
setInterval(function() {
  console.log(`[${new Date().toISOString()}] Servidor continua ativo na porta ${PORT}`);
}, 30000);