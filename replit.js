// Arquivo especial para resolver o problema de deploy no Replit
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Rota raiz para health check - extremamente simplificada
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send('OK');
});

// Redirecionar todas as outras requisições para o aplicativo principal
app.get('*', (req, res) => {
  if (req.path !== '/') {
    return res.redirect('/app');
  }
  res.setHeader('Content-Type', 'text/plain');
  res.send('OK');
});

// Iniciar o servidor na porta especificada
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor Replit rodando em 0.0.0.0:${PORT}`);
});

// Evitar que o processo termine
process.stdin.resume();

// Log periódico para confirmar que o servidor está em execução
setInterval(() => {
  console.log('Servidor Replit ativo');
}, 60000);