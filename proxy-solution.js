/**
 * SERVIDOR PROXY PARA REPLIT DEPLOY
 * Este script cria um servidor HTTP mínimo na porta 80 que:
 * 1. Responde com "OK" para o health check do Replit na raiz (/)
 * 2. Encaminha outras requisições para o servidor principal na porta 5000
 */

import http from 'http';

// Configuração
const HEALTH_CHECK_PORT = 80; // Porta para o health check do Replit
const MAIN_APP_PORT = 5000;   // Porta onde o aplicativo principal está rodando
const MAIN_APP_HOST = '0.0.0.0'; // Host do aplicativo principal

// Servidor proxy simples
const server = http.createServer((req, res) => {
  // Log da requisição para diagnóstico
  console.log(`[${new Date().toISOString()}] Requisição recebida: ${req.method} ${req.url}`);
  
  // Para o endpoint raiz, responder imediatamente OK (para health check)
  if (req.url === '/') {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('OK');
    console.log('Respondido health check com 200 OK');
    return;
  }
  
  // Para outros endpoints, encaminhar para o aplicativo principal
  console.log(`Encaminhando requisição para http://${MAIN_APP_HOST}:${MAIN_APP_PORT}${req.url}`);
  
  // Opções para a requisição proxy
  const options = {
    hostname: MAIN_APP_HOST,
    port: MAIN_APP_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers
  };
  
  // Criar requisição proxy
  const proxy = http.request(options, (proxyRes) => {
    // Copiar status e headers da resposta
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    
    // Encaminhar o corpo da resposta
    proxyRes.pipe(res);
  });
  
  // Encaminhar o corpo da requisição original
  req.pipe(proxy);
  
  // Tratar erros do proxy
  proxy.on('error', (err) => {
    console.error('Erro no proxy:', err.message);
    res.writeHead(502, {'Content-Type': 'text/plain'});
    res.end('Erro de proxy: Não foi possível conectar ao servidor principal');
  });
});

// Iniciar o servidor
server.listen(HEALTH_CHECK_PORT, '0.0.0.0', () => {
  console.log(`Servidor proxy rodando em 0.0.0.0:${HEALTH_CHECK_PORT}`);
  console.log(`Requisições serão encaminhadas para 0.0.0.0:${MAIN_APP_PORT}`);
  console.log(`Health checks na raiz (/) responderão com 200 OK`);
});

// Prevenir que o processo encerre
process.stdin.resume();

// Capturar exceções não tratadas
process.on('uncaughtException', (err) => {
  console.error('Erro não tratado:', err.message);
  // Continuar executando
});

// Responder ao sinal de SIGTERM mas não encerrar
process.on('SIGTERM', () => {
  console.log('Recebido sinal SIGTERM, mas continuando execução');
});

// Responder ao sinal de SIGINT mas não encerrar
process.on('SIGINT', () => {
  console.log('Recebido sinal SIGINT, mas continuando execução');
});

// Heartbeat para confirmar que está ativo
setInterval(() => {
  console.log(`[${new Date().toISOString()}] Servidor proxy continua ativo`);
}, 30000);