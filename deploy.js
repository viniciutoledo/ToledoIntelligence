/**
 * SCRIPT DE DEPLOY ESPECÍFICO PARA REPLIT
 * 
 * Este script inicia o servidor principal na porta 80,
 * que é a porta que o Replit espera para health checks.
 */

console.log('Iniciando script de deploy para Replit...');

// Definir a porta como 80 para o health check do Replit
process.env.PORT = "80";

// Definir ambiente como produção
process.env.NODE_ENV = "production";

console.log(`PORT definida como: ${process.env.PORT}`);
console.log(`NODE_ENV definido como: ${process.env.NODE_ENV}`);

// Importar e iniciar o servidor principal
console.log('Iniciando o servidor principal...');
require('./dist/index.js');