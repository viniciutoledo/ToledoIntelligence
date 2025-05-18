// Servidor minimalista para responder apenas ao health check
// Este é um arquivo especial para resolver os problemas de deploy no Replit

// Importar apenas o necessário para um servidor HTTP
const http = require('http');

// Criar um servidor HTTP extremamente simples
const server = http.createServer((req, res) => {
  // Verificar se a rota é a raiz (/)
  if (req.url === '/') {
    // Configurar os cabeçalhos de resposta
    res.writeHead(200, {
      'Content-Type': 'text/plain',
      'Content-Length': 2
    });
    
    // Enviar a resposta "OK"
    res.end('OK');
  } else {
    // Para outras rotas, responder com redirecionamento
    res.writeHead(302, {
      'Location': '/app'
    });
    res.end();
  }
});

// Usar a porta 5000 explicitamente, sem depender de variáveis de ambiente
const PORT = 5000;

// Iniciar o servidor na porta especificada e em todas as interfaces de rede
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor de health check rodando em 0.0.0.0:${PORT}`);
});

// Manter o processo vivo
process.stdin.resume();

// Evitar que exceções não tratadas terminem o processo
process.on('uncaughtException', (err) => {
  console.error('Erro não tratado no servidor de health check:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Promessa rejeitada não tratada no servidor de health check:', reason);
});

// Log periódico para mostrar que o servidor está ativo
setInterval(() => {
  console.log('Servidor de health check ativo');
}, 30000);