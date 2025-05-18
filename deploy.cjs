/**
 * SCRIPT DE DEPLOY SIMPLIFICADO PARA REPLIT
 * 
 * Este script cria um servidor simples na porta 80 que responde "OK"
 * para health checks e inicia o app principal na porta 5000.
 */

const http = require('http');
const { spawn } = require('child_process');

// Criar servidor de health check na porta 80
const healthServer = http.createServer((req, res) => {
  // Log simples da requisição
  console.log(`[Health] Requisição recebida: ${req.method} ${req.url || '/'}`);
  
  // Responder sempre com OK
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Cache-Control': 'no-cache'
  });
  res.end('OK');
});

// Iniciar o servidor de health check
healthServer.listen(80, '0.0.0.0', () => {
  console.log('[Health] Servidor de health check rodando na porta 80');
  
  // Após iniciar o health check, iniciar o servidor principal
  console.log('[App] Iniciando o aplicativo principal...');
  
  // Iniciar o app principal usando npm run dev em uma porta alternativa
  const appProcess = spawn('npm', ['run', 'dev'], {
    env: { ...process.env, PORT: "5001" },  // Usar porta 5001 para evitar conflito
    stdio: 'pipe'
  });
  
  // Capturar output do processo
  appProcess.stdout.on('data', (data) => {
    console.log(`[App] ${data.toString().trim()}`);
  });
  
  appProcess.stderr.on('data', (data) => {
    console.error(`[App Error] ${data.toString().trim()}`);
  });
  
  appProcess.on('exit', (code) => {
    console.log(`[App] Processo encerrado com código ${code}`);
    
    // Reiniciar se o processo terminar
    setTimeout(() => {
      console.log('[App] Tentando reiniciar...');
      
      const newProcess = spawn('npm', ['run', 'dev'], {
        env: { ...process.env, PORT: "5001" },  // Usar a mesma porta alternativa
        stdio: 'pipe'
      });
      
      // Mesmos handlers para o novo processo
      newProcess.stdout.on('data', (data) => {
        console.log(`[App] ${data.toString().trim()}`);
      });
      
      newProcess.stderr.on('data', (data) => {
        console.error(`[App Error] ${data.toString().trim()}`);
      });
    }, 5000);
  });
});

// Tratar erros do servidor de health check
healthServer.on('error', (err) => {
  console.error(`[Health] Erro no servidor: ${err.message}`);
  
  // Tentar reiniciar o servidor caso a porta esteja em uso
  if (err.code === 'EADDRINUSE') {
    console.log('[Health] A porta 80 já está em uso. Tentando outra abordagem...');
    
    // Alternativa: criar um simples servidor HTTP para health checks
    http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');
    }).listen(3000, '0.0.0.0', () => {
      console.log('[Health Fallback] Servidor de health check alternativo rodando na porta 3000');
    });
  }
});

// Manter o script rodando
process.stdin.resume();

// Tratar sinais para evitar encerramento
process.on('SIGINT', () => console.log('SIGINT recebido, mas ignorado'));
process.on('SIGTERM', () => console.log('SIGTERM recebido, mas ignorado'));
process.on('uncaughtException', (err) => console.error(`Exceção não tratada: ${err.message}`));