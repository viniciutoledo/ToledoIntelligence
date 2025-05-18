/**
 * Script para preencher o arquivo .env com as variáveis de ambiente atuais
 * Preserva a segurança não exibindo os valores
 */

import fs from 'fs';

// Lista de variáveis de ambiente para transferir para o .env
const envVars = [
  'DATABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'STRIPE_SECRET_KEY',
  'VITE_STRIPE_PUBLIC_KEY',
  'STRIPE_PRICE_ID_BASIC',
  'STRIPE_PRICE_ID_INTERMEDIATE'
];

// Ler o arquivo .env existente
let envContent = fs.readFileSync('.env', 'utf8');

// Substituir cada variável
envVars.forEach(varName => {
  const value = process.env[varName] || '';
  
  // Expressão regular para encontrar a linha com a variável
  const regex = new RegExp(`${varName}=.*`, 'g');
  
  // Se a variável já existe no arquivo, substitua-a
  if (envContent.match(regex)) {
    envContent = envContent.replace(regex, `${varName}=${value}`);
  } else {
    // Se a variável não existe, adicione-a ao final
    envContent += `\n${varName}=${value}`;
  }
});

// Escrever o conteúdo atualizado de volta ao arquivo
fs.writeFileSync('.env', envContent);

console.log('Arquivo .env atualizado com sucesso!');