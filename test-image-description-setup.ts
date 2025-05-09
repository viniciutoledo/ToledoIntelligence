/**
 * Script para testar a configuração do processamento de imagens com descrição
 * Execute com: npx tsx test-image-description-setup.ts
 */
import { verifyImageProcessingSetup } from './server/document-test-utils';

// Definir caminho da imagem e descrição
const testImagePath = './uploads/files/circuit-board-test.jpg';
const imageDescription = 'Placa de circuito com possíveis problemas no capacitor principal e conectores soltos na área superior direita';

// Função principal de teste
async function runTest() {
  console.log('Iniciando teste de configuração do processamento de imagem com descrição...');
  console.log(`Imagem: ${testImagePath}`);
  console.log(`Descrição: "${imageDescription}"`);
  
  // Teste 1: Sem descrição
  console.log('\n=== TESTE 1: Configuração SEM descrição ===');
  const setupWithoutDescription = verifyImageProcessingSetup(testImagePath);
  console.log(JSON.stringify(setupWithoutDescription, null, 2));
  
  // Teste 2: Com descrição
  console.log('\n=== TESTE 2: Configuração COM descrição ===');
  const setupWithDescription = verifyImageProcessingSetup(testImagePath, imageDescription);
  console.log(JSON.stringify(setupWithDescription, null, 2));
  
  // Comparação de prompts
  console.log('\n=== COMPARAÇÃO DE PROMPTS ===');
  
  if (setupWithoutDescription.status === 'success' && setupWithDescription.status === 'success') {
    console.log('OpenAI GPT-4o:');
    console.log('- SEM descrição:', setupWithoutDescription.processing.openai.promptUsed);
    console.log('- COM descrição:', setupWithDescription.processing.openai.promptUsed);
    
    console.log('\nAnthropic Claude:');
    console.log('- SEM descrição:', setupWithoutDescription.processing.claude.promptUsed);
    console.log('- COM descrição:', setupWithDescription.processing.claude.promptUsed);
  } else {
    console.log('Não foi possível comparar os prompts devido a erros na configuração.');
  }
  
  console.log('\nAnálise concluída!');
  console.log('Observe como a descrição fornecida é incorporada nos prompts enviados aos modelos.');
}

// Executar o teste
runTest().catch(console.error);