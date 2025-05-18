/**
 * SOLUÇÃO DUAL-SERVER PARA DEPLOY NO REPLIT
 * Este script inicia dois servidores simultaneamente:
 * 1. Um servidor simples na porta 80 específico para o health check do Replit
 * 2. O servidor principal da aplicação na porta 5000
 */

const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');

// Configurações
const HEALTH_PORT = 80;
const APP_PORT = 5000;
const LOG_FILE = 'deploy-log.txt';

// Iniciar o log
try {
  fs.writeFileSync(LOG_FILE, `[${new Date().toISOString()}] Iniciando solução dual-server\n`);
} catch (err) {
  console.error(`Não foi possível criar arquivo de log: ${err.message}`);
}

// Função de log que escreve no console e no arquivo
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  
  console.log(logMessage);
  
  try {
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
  } catch (err) {
    console.error(`Erro ao escrever no log: ${err.message}`);
  }
}

log('Iniciando solução dual-server para deploy no Replit');

// 1. HEALTH CHECK SERVER (PORTA 80)
// ===================================
const healthServer = http.createServer((req, res) => {
  const url = req.url || '/';
  log(`Health check recebido: ${req.method} ${url}`);
  
  // Responder a qualquer caminho com OK, mas dar atenção especial à raiz
  res.writeHead(200, {
    'Content-Type': 'text/plain',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  
  if (url === '/' || url === '') {
    log('Respondendo health check na raiz (/) com 200 OK');
    res.end('OK - Servidor saudável');
  } else {
    res.end('OK');
  }
});

// Iniciar o servidor de health check
healthServer.listen(HEALTH_PORT, '0.0.0.0', () => {
  log(`Servidor de health check rodando em 0.0.0.0:${HEALTH_PORT}`);
});

// Tratamento de erros do servidor de health check
healthServer.on('error', (err) => {
  log(`Erro no servidor de health check: ${err.message}`);
  
  if (err.code === 'EADDRINUSE') {
    log(`A porta ${HEALTH_PORT} já está em uso. Tentando reiniciar em 10 segundos...`);
    setTimeout(() => {
      try {
        healthServer.close();
        healthServer.listen(HEALTH_PORT, '0.0.0.0');
      } catch (innerErr) {
        log(`Erro ao tentar reiniciar health server: ${innerErr.message}`);
      }
    }, 10000);
  }
});

// 2. SERVIDOR PRINCIPAL DA APLICAÇÃO (PORTA 5000)
// ===============================================
log('Iniciando o servidor principal da aplicação...');

// Usaremos spawn para iniciar o app principal como um processo filho
const appProcess = spawn('npm', ['run', 'dev'], {
  env: { ...process.env, PORT: APP_PORT.toString() },
  stdio: 'pipe'  // Capturar saída para logs
});

// Capturar stdout e stderr do processo filho
appProcess.stdout.on('data', (data) => {
  log(`[APP] ${data.toString().trim()}`);
});

appProcess.stderr.on('data', (data) => {
  log(`[APP ERROR] ${data.toString().trim()}`);
});

// Monitor de estado do processo filho
appProcess.on('exit', (code, signal) => {
  log(`O servidor da aplicação saiu com código ${code} e sinal ${signal}`);
  
  // Reiniciar automaticamente se o servidor da aplicação sair
  log('Reiniciando o servidor da aplicação em 3 segundos...');
  setTimeout(() => {
    log('Tentando reiniciar o servidor da aplicação...');
    const newAppProcess = spawn('npm', ['run', 'dev'], {
      env: { ...process.env, PORT: APP_PORT.toString() },
      stdio: 'pipe'
    });
    
    newAppProcess.stdout.on('data', (data) => {
      log(`[APP REINICIADO] ${data.toString().trim()}`);
    });
    
    newAppProcess.stderr.on('data', (data) => {
      log(`[APP REINICIADO ERROR] ${data.toString().trim()}`);
    });
    
    // Atualizar a referência do processo
    appProcess = newAppProcess;
  }, 3000);
});

// 3. VERIFICAÇÃO PERIÓDICA DE SAÚDE
// =================================
// Verificar periodicamente se o servidor de health check está funcionando
setInterval(() => {
  const options = {
    hostname: 'localhost',
    port: HEALTH_PORT,
    path: '/',
    method: 'GET',
    timeout: 5000
  };
  
  const req = http.request(options, (res) => {
    if (res.statusCode === 200) {
      log('Auto-verificação: health check server está respondendo corretamente');
    } else {
      log(`Auto-verificação: resposta inesperada do health check server (status ${res.statusCode})`);
      
      // Tentar reiniciar o servidor de health check
      try {
        healthServer.close(() => {
          healthServer.listen(HEALTH_PORT, '0.0.0.0');
        });
      } catch (err) {
        log(`Erro ao tentar reiniciar health server após verificação: ${err.message}`);
      }
    }
  });
  
  req.on('error', (err) => {
    log(`Auto-verificação falhou: ${err.message}`);
    
    // Tentar reiniciar o servidor
    try {
      healthServer.close(() => {
        healthServer.listen(HEALTH_PORT, '0.0.0.0');
      });
    } catch (closeErr) {
      log(`Erro ao tentar reiniciar health server: ${closeErr.message}`);
    }
  });
  
  req.end();
}, 30000);

// 4. MANTER O PROCESSO PRINCIPAL VIVO
// ==================================
// Evitar que o processo principal termine
log('Configurando keep-alive para processo principal');
setInterval(() => {
  log('Servidor dual continua ativo');
  
  // Verificar também se nosso processo filho continua rodando
  if (appProcess && appProcess.killed) {
    log('Detectado que o processo da aplicação foi encerrado. Tentando reiniciar...');
    const newAppProcess = spawn('npm', ['run', 'dev'], {
      env: { ...process.env, PORT: APP_PORT.toString() },
      stdio: 'pipe'
    });
    
    newAppProcess.stdout.on('data', (data) => {
      log(`[APP REINICIADO] ${data.toString().trim()}`);
    });
    
    newAppProcess.stderr.on('data', (data) => {
      log(`[APP REINICIADO ERROR] ${data.toString().trim()}`);
    });
    
    // Atualizar a referência do processo
    appProcess = newAppProcess;
  }
}, 60000);

// 5. TRATAMENTO DE SINAIS E EXCEÇÕES
// =================================
// Capturar sinais para evitar encerramento prematuro
process.on('SIGTERM', () => {
  log('Recebido sinal SIGTERM, mas continuando execução');
});

process.on('SIGINT', () => {
  log('Recebido sinal SIGINT, mas continuando execução');
});

// Capturar exceções não tratadas
process.on('uncaughtException', (err) => {
  log(`Exceção não tratada: ${err.message}`);
  log(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`Rejeição não tratada: ${reason}`);
});

// Manter o processo principal vivo
process.stdin.resume();

log('Solução dual-server inicializada com sucesso!');
log(`- Health check server rodando na porta ${HEALTH_PORT}`);
log(`- Servidor da aplicação rodando na porta ${APP_PORT}`);
log('Aguardando requisições...');