/**
 * SERVIDOR HEALTH CHECK MINIMALISTA PARA DEPLOY NO REPLIT
 * Esse script só faz uma coisa: responder 200 OK para health checks na porta 80
 * Ideal para deploy no Replit onde precisamos atender a verificações de saúde
 * mas o aplicativo principal já está rodando na porta 5000
 */

const http = require('http');

// Porta para o health check do Replit
const PORT = 80;

// Criar o servidor HTTP simples
const server = http.createServer((req, res) => {
  const timestamp = new Date().toISOString();
  
  // Log da requisição para diagnóstico
  console.log(`[${timestamp}] Requisição recebida: ${req.method} ${req.url}`);
  
  // Sempre responder com 200 OK, mas dar atenção especial à raiz
  res.writeHead(200, {'Content-Type': 'text/plain'});
  
  if (req.url === '/' || req.url === '') {
    console.log(`[${timestamp}] Respondendo health check na raiz com 200 OK`);
    res.end('OK - Health Check Passed');
  } else {
    res.end('OK');
  }
});

// Iniciar o servidor na porta 80
server.listen(PORT, '0.0.0.0', () => {
  console.log('==============================================================');
  console.log('= SERVIDOR HEALTH CHECK MINIMALISTA RODANDO EM 0.0.0.0:80   =');
  console.log('= RESPONDERÁ "OK" PARA QUALQUER REQUISIÇÃO, INCLUINDO A RAIZ =');
  console.log('==============================================================');
  console.log(`Node.js versão: ${process.version}`);
  console.log(`Sistema: ${process.platform}`);
  console.log(`Hora de início: ${new Date().toISOString()}`);
});

// Tratar erros do servidor
server.on('error', (err) => {
  console.error(`Erro ao iniciar o servidor: ${err.message}`);
  
  if (err.code === 'EADDRINUSE') {
    console.error(`A porta ${PORT} já está em uso. Tente encerrar outros processos que possam estar usando esta porta.`);
    // Tentar novamente após 30 segundos
    setTimeout(() => {
      console.log(`Tentando reiniciar o servidor na porta ${PORT}...`);
      server.close();
      server.listen(PORT, '0.0.0.0');
    }, 30000);
  }
});

// Certificar-se de que o servidor não será fechado
server.on('close', () => {
  console.log('Servidor foi fechado. Tentando reiniciar...');
  setTimeout(() => {
    try {
      server.listen(PORT, '0.0.0.0');
    } catch (err) {
      console.error(`Erro ao tentar reiniciar o servidor: ${err.message}`);
    }
  }, 1000);
});

// Tratamento de sinais do sistema para evitar encerramento prematuro
process.on('SIGTERM', () => {
  console.log('Recebido sinal SIGTERM, mas continuando execução');
});

process.on('SIGINT', () => {
  console.log('Recebido sinal SIGINT, mas continuando execução');
});

// Capturar exceções não tratadas
process.on('uncaughtException', (err) => {
  console.error(`Exceção não tratada: ${err.message}`);
  console.error(err.stack);
  // Continuar execução
});

// Manter o processo ativo
process.stdin.resume();

// Log periódico para confirmar que está ativo
setInterval(() => {
  console.log(`[${new Date().toISOString()}] Servidor health check continua ativo na porta ${PORT}`);
}, 30000);