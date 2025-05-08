/**
 * Script para testar a integração com a API Perplexity
 * 
 * Execute com: node test-perplexity.js "consulta de teste"
 */

import { searchWithPerplexity } from './server/perplexity-search.js';

async function runTest() {
  try {
    // Obter a consulta da linha de comando
    const query = process.argv[2];
    const language = process.argv[3] === 'en' ? 'en' : 'pt';
    
    if (!query) {
      console.error('Por favor, forneça uma consulta de teste como argumento');
      console.log('Exemplo: node test-perplexity.js "Como funciona um microprocessador?" [pt|en]');
      process.exit(1);
    }
    
    // Verificar se a chave API está disponível
    if (!process.env.PERPLEXITY_API_KEY) {
      console.error('Erro: A variável de ambiente PERPLEXITY_API_KEY não está definida');
      console.log('Defina-a antes de executar este teste:');
      console.log('  export PERPLEXITY_API_KEY=sua_chave_api');
      process.exit(1);
    }
    
    console.log(`Testando consulta em ${language === 'pt' ? 'português' : 'inglês'}: "${query}"`);
    
    // Realizar a busca com a API Perplexity
    console.log('Consultando a API Perplexity...');
    const result = await searchWithPerplexity(query, language);
    
    if (result) {
      console.log('\nResultado da busca Perplexity:');
      console.log('--------------------------------');
      console.log(result);
    } else {
      console.log('\nA busca Perplexity não retornou resultados.');
    }
    
  } catch (error) {
    console.error('Erro durante o teste:', error);
  }
}

// IIFE para permitir uso de await no nível superior
(async () => {
  await runTest();
})();