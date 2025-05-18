/**
 * SCRIPT FINAL DE DEPLOY PARA REPLIT
 * 
 * Este script inicia APENAS o servidor de health check na porta 80
 * O app principal continuará rodando no workflow "Start application"
 */

// Executar o servidor mínimo de health check
require('./health.cjs');