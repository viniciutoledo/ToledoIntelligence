// Arquivo principal para deploy no Replit
// Este arquivo detecta o ambiente e escolhe o servidor apropriado

if (process.env.NODE_ENV === 'production') {
  // Em produção, usar o servidor minimalista
  console.log('Iniciando em modo PRODUÇÃO - usando servidor minimalista');
  require('./server/production-server.js');
} else {
  // Em desenvolvimento, usar o servidor completo
  console.log('Iniciando em modo DESENVOLVIMENTO - usando servidor completo');
  require('./server');
}