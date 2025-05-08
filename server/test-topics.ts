/**
 * Script de teste para o sistema de aprendizado dinâmico de tópicos técnicos
 * Este script valida se o módulo está funcionando corretamente
 */

import { testTopicsLearning, addTechnicalTopic } from './external-search';
import { storage } from './storage';

async function testTechTopics() {
  console.log("=== TESTE DO SISTEMA DE APRENDIZADO DE TÓPICOS TÉCNICOS ===\n");
  
  try {
    // 1. Criar alguns tópicos técnicos de teste no banco
    console.log("1. Adicionando tópicos técnicos iniciais...");
    const topics = ["microprocessador", "arduino", "placa de circuito"];
    
    for (const topic of topics) {
      await addTechnicalTopic(topic);
      console.log(`   - Tópico '${topic}' adicionado`);
    }
    
    // 2. Verificar identificação de tópicos em uma consulta simples
    console.log("\n2. Testando identificação em consulta simples...");
    const simpleQuery = "Como programar um arduino para controlar um motor?";
    const simpleResult = await testTopicsLearning(simpleQuery);
    
    console.log(`   Consulta: "${simpleQuery}"`);
    console.log(`   Deve usar busca externa? ${simpleResult.shouldSearch ? 'Sim' : 'Não'}`);
    console.log(`   Tópicos encontrados: ${simpleResult.topicsFound.join(', ')}`);
    
    // 3. Verificar identificação de tópicos em uma consulta complexa
    console.log("\n3. Testando identificação em consulta complexa...");
    const complexQuery = "Qual a diferença entre um microprocessador e um microcontrolador numa placa de circuito para automação industrial?";
    const complexResult = await testTopicsLearning(complexQuery);
    
    console.log(`   Consulta: "${complexQuery}"`);
    console.log(`   Deve usar busca externa? ${complexResult.shouldSearch ? 'Sim' : 'Não'}`);
    console.log(`   Tópicos encontrados: ${complexResult.topicsFound.join(', ')}`);
    
    // 4. Verificar aprendizado de novos tópicos
    console.log("\n4. Testando aprendizado de novos tópicos...");
    const learningQuery = "Como calibrar um osciloscópio para analisar sinais PWM de um ESP32?";
    const learningResult = await testTopicsLearning(learningQuery);
    
    console.log(`   Consulta: "${learningQuery}"`);
    console.log(`   Deve usar busca externa? ${learningResult.shouldSearch ? 'Sim' : 'Não'}`);
    console.log(`   Tópicos encontrados: ${learningResult.topicsFound.join(', ')}`);
    
    // 5. Verificar o conteúdo da tabela no banco de dados
    console.log("\n5. Conteúdo atual do banco de dados:");
    const savedTopics = await storage.getTechnicalTopics();
    
    if (savedTopics.length === 0) {
      console.log("   Nenhum tópico encontrado no banco de dados!");
    } else {
      console.log("   ID | Tópico | Uso | Última Utilização");
      console.log("   ---------------------------------------");
      savedTopics.forEach(topic => {
        console.log(`   ${topic.id} | ${topic.topic} | ${topic.usage_count} | ${topic.last_used.toISOString()}`);
      });
    }
    
    // 6. Atualizar um tópico existente
    if (savedTopics.length > 0) {
      console.log("\n6. Atualizando um tópico existente...");
      const topicToUpdate = savedTopics[0];
      
      console.log(`   - Incrementando uso do tópico '${topicToUpdate.topic}' de ${topicToUpdate.usage_count} vezes`);
      await storage.updateTechnicalTopicUsage(topicToUpdate.topic);
      
      const updatedTopic = await storage.getTechnicalTopicByName(topicToUpdate.topic);
      if (updatedTopic) {
        console.log(`   - Tópico atualizado: '${updatedTopic.topic}' agora tem ${updatedTopic.usage_count} usos`);  
      }
    }
    
    console.log("\n=== TESTE CONCLUÍDO ===");
    
  } catch (error) {
    console.error("ERRO DURANTE O TESTE:", error);
  }
}

// Executar o teste
testTechTopics().then(() => {
  console.log("\nTodos os testes concluídos.");
});