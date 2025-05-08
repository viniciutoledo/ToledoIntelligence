/**
 * Script para testar a funcionalidade de busca externa
 * 
 * Execute com: npx tsx test-external-knowledge.js "sua consulta aqui"
 */

import { searchExternalKnowledge, shouldUseExternalSearch } from './server/external-search.ts';

async function runTest() {
  try {
    // Obter a consulta da linha de comando
    const query = process.argv[2];
    const language = process.argv[3] === 'en' ? 'en' : 'pt';
    
    if (!query) {
      console.error('Por favor, forneça uma consulta de teste como argumento');
      console.log('Exemplo: npx tsx test-external-knowledge.js "Como funciona um diodo zener?" [pt|en]');
      process.exit(1);
    }
    
    console.log(`Testando busca externa para: "${query}" (${language === 'pt' ? 'Português' : 'Inglês'})`);
    
    // Verificar se a consulta deve usar busca externa
    const shouldSearch = await shouldUseExternalSearch(query);
    console.log(`\nDeve usar busca externa? ${shouldSearch ? 'Sim' : 'Não'}`);
    
    if (!shouldSearch) {
      console.log('Consulta não qualificada para busca externa. Teste encerrado.');
      return;
    }
    
    // Realizar a busca externa
    console.log('\nRealizando busca externa...');
    const result = await searchExternalKnowledge(query, language);
    
    console.log('\nResultado da busca externa:');
    console.log('---------------------------');
    
    if (result) {
      console.log(result);
    } else {
      console.log('Nenhum resultado encontrado.');
    }
    
  } catch (error) {
    console.error('Erro durante o teste:', error);
  }
}

// IIFE para permitir uso de await no nível superior
(async () => {
  await runTest();
})();