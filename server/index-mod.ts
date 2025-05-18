/**
 * VERSÃO MODIFICADA DO SERVIDOR PRINCIPAL
 * Alterada para escutar também na porta 80 para health checks
 */

import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Criar app Express
const app = express();

// Configurações básicas
const PORT = process.env.PORT || 5000;
const HEALTH_PORT = 80;

// Rota específica para health check
app.get('/', (req, res) => {
  res.status(200).send('OK');
});

// Iniciar servidor principal na porta 5000
const mainServer = http.createServer(app);
mainServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor principal rodando em 0.0.0.0:${PORT}`);
  console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

// Iniciar servidor de health check na porta 80
const healthServer = http.createServer((req, res) => {
  // Responder sempre com OK
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OK');
});

// Tentar iniciar o servidor de health check
try {
  healthServer.listen(HEALTH_PORT, '0.0.0.0', () => {
    console.log(`Servidor de health check rodando na porta ${HEALTH_PORT}`);
  });
} catch (err) {
  console.error(`Não foi possível iniciar o servidor de health check: ${err.message}`);
}