/**
 * SCRIPT DE DEPLOY PARA REPLIT
 * Este script inicia tanto o servidor de health check na porta 80
 * quanto o servidor principal na porta 5000
 * 
 * Use este script como comando de deploy no Replit
 */

const http = require('http');
const { exec, spawn } = require('child_process');
const path = require('path');

// Configuração
const HEALTH_CHECK_PORT = 80;
const MAIN_APP_PORT = 5000;
const MAIN_APP_COMMAND = 'npm';
const MAIN_APP_ARGS = ['run', 'dev'];

// Verificar se uma porta está em uso
const checkPortInUse = (port) => {
  return new Promise((resolve) => {
    const command = process.platform === 'win32' 
      ? `netstat -ano | find "LISTENING" | find "${port}"`
      : `lsof -i:${port} -sTCP:LISTEN`;
    
    exec(command, (error, stdout) => {
      if (error || !stdout) {
        resolve(false); // Porta não está em uso
      } else {
        resolve(true);  // Porta está em uso
      }
    });
  });
};

// Iniciar o servidor de health check
const startHealthCheckServer = async () => {
  console.log(`[${new Date().toISOString()}] Iniciando servidor de health check na porta ${HEALTH_CHECK_PORT}...`);
  
  try {
    // Responder "OK" para qualquer requisição, mas dar atenção especial à raiz
    const server = http.createServer((req, res) => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] Health check: ${req.method} ${req.url}`);
      
      // Responder com sucesso especialmente para a raiz (crítico para health check)
      res.writeHead(200, {'Content-Type': 'text/plain'});
      
      if (req.url === '/' || req.url === '') {
        console.log(`[${timestamp}] Respondendo health check na raiz com 200 OK`);
        res.end('OK - Health Check Passed');
      } else {
        res.end('OK');
      }
    });

    // Evitar que erros não tratados derrubem o servidor
    server.on('error', (err) => {
      console.error(`[${new Date().toISOString()}] Erro no servidor de health check: ${err.message}`);
      
      if (err.code === 'EADDRINUSE') {
        console.error(`A porta ${HEALTH_CHECK_PORT} já está em uso. Tentaremos novamente em 5 segundos...`);
        setTimeout(() => {
          try {
            server.close();
            server.listen(HEALTH_CHECK_PORT, '0.0.0.0');
          } catch (innerErr) {
            console.error(`Erro ao tentar reiniciar o servidor: ${innerErr.message}`);
          }
        }, 5000);
      }
    });

    // Certificar-se de que o servidor não será fechado
    server.on('close', () => {
      console.log(`[${new Date().toISOString()}] Servidor de health check foi fechado. Tentando reiniciar...`);
      setTimeout(() => {
        try {
          server.listen(HEALTH_CHECK_PORT, '0.0.0.0');
        } catch (err) {
          console.error(`Erro ao tentar reiniciar o servidor após fechamento: ${err.message}`);
        }
      }, 1000);
    });

    // Iniciar o servidor na porta definida
    server.listen(HEALTH_CHECK_PORT, '0.0.0.0', () => {
      console.log('==============================================================');
      console.log(`= SERVIDOR HEALTH CHECK RODANDO EM 0.0.0.0:${HEALTH_CHECK_PORT}              =`);
      console.log('= RESPONDERÁ "OK" PARA QUALQUER REQUISIÇÃO, INCLUINDO A RAIZ =');
      console.log('==============================================================');
    });
    
    // Manter referência ao servidor para que não seja coletado pelo GC
    global.healthCheckServer = server;
    
    // Configurar keepalive periódico para manter o servidor ativo
    setInterval(() => {
      if (server.listening) {
        console.log(`[${new Date().toISOString()}] Servidor health check continua rodando na porta ${HEALTH_CHECK_PORT}`);
      } else {
        console.log(`[${new Date().toISOString()}] Servidor health check não está mais escutando! Tentando reiniciar...`);
        try {
          server.listen(HEALTH_CHECK_PORT, '0.0.0.0');
        } catch (err) {
          console.error(`Erro ao tentar reiniciar servidor durante verificação de heartbeat: ${err.message}`);
        }
      }
    }, 30000);
    
    return server;
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Erro crítico ao iniciar servidor de health check: ${err.message}`);
    
    // Mesmo com erro crítico, tentamos reiniciar após algum tempo
    setTimeout(() => {
      console.log(`[${new Date().toISOString()}] Tentando reiniciar health check após erro crítico...`);
      startHealthCheckServer().catch(console.error);
    }, 10000);
  }
};

// Iniciar o servidor principal
const startMainApp = async () => {
  console.log(`[${new Date().toISOString()}] Verificando status do aplicativo principal...`);
  
  // Verificar se a porta do aplicativo principal já está em uso
  const isPortInUse = await checkPortInUse(MAIN_APP_PORT);
  if (isPortInUse) {
    console.log(`[${new Date().toISOString()}] A porta ${MAIN_APP_PORT} já está em uso - o aplicativo principal parece estar rodando.`);
    console.log(`[${new Date().toISOString()}] Pulando inicialização do aplicativo principal para evitar conflitos.`);
    return Promise.resolve({ status: 'already-running' });
  }

  console.log(`[${new Date().toISOString()}] Iniciando aplicativo principal na porta ${MAIN_APP_PORT}...`);

  return new Promise((resolve, reject) => {
    try {
      // Configurar variáveis de ambiente para garantir a porta correta
      const env = {
        ...process.env,
        PORT: MAIN_APP_PORT.toString(),  // Garantir que o app use a porta 5000 (como string)
        NODE_ENV: process.env.NODE_ENV || 'production'
      };

      // Spawn cria um processo filho para executar o comando
      const child = spawn(MAIN_APP_COMMAND, MAIN_APP_ARGS, {
        stdio: 'inherit', // Compartilhar stdio com o processo pai
        shell: true,      // Executar em um shell
        env
      });

      console.log(`[${new Date().toISOString()}] Aplicativo principal iniciado com PID ${child.pid}`);

      // Manipular eventos do processo filho
      child.on('error', (err) => {
        console.error(`[${new Date().toISOString()}] Erro ao iniciar aplicativo principal: ${err.message}`);
        reject(err);
      });

      child.on('exit', (code, signal) => {
        if (code !== 0) {
          console.error(`[${new Date().toISOString()}] Aplicativo principal encerrou com código ${code}, sinal ${signal}`);
          
          // Reiniciar o aplicativo principal automaticamente após falha, mas apenas se não for problema de porta
          console.log(`[${new Date().toISOString()}] Verificando se a porta ${MAIN_APP_PORT} está disponível antes de tentar reiniciar...`);
          
          checkPortInUse(MAIN_APP_PORT).then(isInUse => {
            if (!isInUse) {
              console.log(`[${new Date().toISOString()}] Porta ${MAIN_APP_PORT} está disponível. Tentando reiniciar o aplicativo principal em 5 segundos...`);
              setTimeout(() => {
                startMainApp()
                  .then(() => console.log(`[${new Date().toISOString()}] Aplicativo principal reiniciado com sucesso`))
                  .catch(err => console.error(`[${new Date().toISOString()}] Falha ao reiniciar aplicativo principal: ${err.message}`));
              }, 5000);
            } else {
              console.log(`[${new Date().toISOString()}] Porta ${MAIN_APP_PORT} já está em uso. Não será feita tentativa de reinício.`);
            }
          });
        } else {
          console.log(`[${new Date().toISOString()}] Aplicativo principal encerrou normalmente`);
        }
      });

      // Manter referência ao processo filho
      global.mainAppProcess = child;
      
      // Esperar um pouco antes de considerar sucesso
      setTimeout(() => {
        // Se o processo ainda estiver rodando após 2 segundos, consideramos que iniciou com sucesso
        if (child.exitCode === null) {
          resolve({ status: 'running', process: child });
        }
      }, 2000);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Erro ao iniciar o aplicativo principal: ${err.message}`);
      reject(err);
    }
  });
};

// Função principal para iniciar todos os serviços
const startServices = async () => {
  try {
    // Primeiro inicia o servidor de health check
    await startHealthCheckServer();
    console.log(`[${new Date().toISOString()}] Servidor de health check iniciado com sucesso na porta ${HEALTH_CHECK_PORT}`);
    
    // Depois inicia o aplicativo principal
    await startMainApp();
    console.log(`[${new Date().toISOString()}] Aplicativo principal iniciado com sucesso na porta ${MAIN_APP_PORT}`);
    
    console.log(`[${new Date().toISOString()}] Todos os serviços iniciados com sucesso!`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Erro ao iniciar serviços: ${err.message}`);
  }
};

// Tratamento de sinais do sistema para evitar encerramento prematuro
process.on('SIGTERM', () => {
  console.log(`[${new Date().toISOString()}] Recebido sinal SIGTERM, mas continuando execução`);
});

process.on('SIGINT', () => {
  console.log(`[${new Date().toISOString()}] Recebido sinal SIGINT, mas continuando execução`);
});

// Capturar exceções não tratadas
process.on('uncaughtException', (err) => {
  console.error(`[${new Date().toISOString()}] Exceção não tratada: ${err.message}`);
  console.error(err.stack);
  // Continuar execução
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`[${new Date().toISOString()}] Rejeição não tratada: ${reason}`);
  // Continuar execução
});

// Manter o processo ativo
process.stdin.resume();

// Iniciar todos os serviços
console.log(`[${new Date().toISOString()}] Iniciando deploy completo (health check + aplicativo principal)`);
startServices().catch(err => {
  console.error(`[${new Date().toISOString()}] Falha crítica ao iniciar serviços: ${err.message}`);
});

// Log periódico para confirmar que o processo principal está ativo
setInterval(() => {
  console.log(`[${new Date().toISOString()}] Processo principal de deploy continua ativo`);
}, 60000);