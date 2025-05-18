/**
 * SOLUÇÃO DE PORT FORWARDING PARA REPLIT
 * 
 * Este script cria um proxy HTTP na porta 80 que:
 * 1. Responde a health checks diretamente
 * 2. Encaminha outras requisições para o servidor principal na porta 5000
 */

const http = require('http');

// Função para encaminhar requisições para o servidor principal
function forwardRequest(req, res) {
  const options = {
    hostname: 'localhost',
    port: 5000,
    path: req.url,
    method: req.method,
    headers: req.headers
  };

  // Log da requisição que está sendo encaminhada
  console.log(`Encaminhando ${req.method} ${req.url} para a porta 5000`);

  // Criar requisição para o servidor principal
  const proxyReq = http.request(options, (proxyRes) => {
    // Copiar cabeçalhos da resposta
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    
    // Encaminhar corpo da resposta
    proxyRes.pipe(res);
  });

  // Encaminhar corpo da requisição original
  req.pipe(proxyReq);

  // Tratar erros de conexão com o servidor principal
  proxyReq.on('error', (err) => {
    console.error(`Erro ao encaminhar para porta 5000: ${err.message}`);
    
    // Se não conseguir encaminhar, responder com erro
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Erro de proxy: Não foi possível conectar ao servidor principal');
  });
}

// Criar servidor proxy na porta 80
const server = http.createServer((req, res) => {
  // Se for o health check do Replit (geralmente na raiz /)
  if (req.url === '/' || req.url === '/health') {
    console.log(`Health check recebido: ${req.method} ${req.url}`);
    
    // Responder diretamente com 200 OK
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    return;
  }
  
  // Para outras requisições, encaminhar para o servidor principal
  forwardRequest(req, res);
});

// Iniciar o servidor proxy na porta 80
server.listen(80, '0.0.0.0', () => {
  console.log('Proxy iniciado na porta 80');
  console.log('Respondendo health checks na rota / e /health');
  console.log('Encaminhando outras requisições para a porta 5000');
});

// Tratar erros do servidor
server.on('error', (err) => {
  console.error(`Erro no servidor proxy: ${err.message}`);
  
  if (err.code === 'EADDRINUSE') {
    console.log('Porta 80 já está em uso. Tentando novamente em 5 segundos...');
    
    setTimeout(() => {
      server.close();
      server.listen(80, '0.0.0.0');
    }, 5000);
  }
});

// Manter o processo vivo
process.stdin.resume();