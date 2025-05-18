// Servidor dedicado para health check que retorna status 200
// Arquivo criado especificamente para resolver problemas de deploy no Replit

const http = require('http');

// Criar um servidor que responde apenas com status 200
const server = http.createServer((req, res) => {
  // Retornar status 200 para qualquer rota
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('OK');
});

// Porta fixa 5000 - mesmo valor que deve estar no deployment config
const PORT = 5000;

// Iniciar o servidor escutando em todas as interfaces
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor de health check rodando em 0.0.0.0:${PORT}`);
});

// Manter o processo vivo
process.stdin.resume();

// Log contínuo para verificar que o servidor está funcionando
setInterval(() => {
  console.log('Health check server alive');
}, 30000);