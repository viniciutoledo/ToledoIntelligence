/**
 * Script para testar o sistema de aprendizado de tópicos técnicos
 * Execute com: node test-technical-topics.js "consulta de teste"
 */

import { execSync } from 'child_process';
import { testTopicsLearning, addTechnicalTopic } from './server/external-search.ts';

async function runTest() {
  try {
    // Obter a consulta da linha de comando
    const query = process.argv[2];
    
    if (!query) {
      console.error('Por favor, forneça uma consulta de teste como argumento');
      console.log('Exemplo: node test-technical-topics.js "Como funciona um microprocessador?"');
      process.exit(1);
    }
    
    console.log(`Testando consulta: "${query}"`);
    
    // Testar o sistema de aprendizado de tópicos
    const result = await testTopicsLearning(query);
    
    console.log('\nResultados:');
    console.log('-----------');
    console.log(`Deve usar busca externa? ${result.shouldSearch ? 'Sim' : 'Não'}`);
    console.log(`Tópicos técnicos identificados (${result.topicsFound.length}):`);
    
    if (result.topicsFound.length > 0) {
      result.topicsFound.forEach((topic, index) => {
        console.log(`  ${index + 1}. ${topic}`);
      });
    } else {
      console.log('  Nenhum tópico técnico identificado');
    }
    
    // Testar adição de um novo tópico técnico
    if (process.argv[3] === '--add') {
      const newTopic = process.argv[4];
      if (newTopic) {
        console.log(`\nAdicionando novo tópico técnico: "${newTopic}"`);
        const added = await addTechnicalTopic(newTopic);
        console.log(`Tópico adicionado com sucesso: ${added ? 'Sim' : 'Não'}`);
      }
    }
    
    // Verificar o banco de dados para ver os tópicos armazenados
    try {
      console.log('\nTópicos técnicos no banco de dados:');
      const dbContent = execSync('psql -c "SELECT * FROM technical_topics ORDER BY usage_count DESC LIMIT 10;" $DATABASE_URL').toString();
      console.log(dbContent);
    } catch (err) {
      console.error('Erro ao consultar o banco de dados:', err.message);
    }
    
  } catch (error) {
    console.error('Erro durante o teste:', error);
  }
}

// IIFE para permitir uso de await no nível superior
(async () => {
  await runTest();
})();