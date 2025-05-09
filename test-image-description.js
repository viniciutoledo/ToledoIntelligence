/**
 * Script para testar o processamento de imagens com descrição
 * usando modelos multimodais (GPT-4o e Claude 3)
 * 
 * Execute com: node test-image-description.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Importação dinâmica para carregar module
let extractContentFromImage;
const loadDependencies = async () => {
  const documentProcessors = await import('./server/document-processors.js');
  extractContentFromImage = documentProcessors.extractContentFromImage;
};

// Definir caminho da imagem e descrição
const testImagePath = process.argv[2] || './uploads/files/circuit-board-test.jpg'; 
const imageDescription = process.argv[3] || 'Placa de circuito com possíveis problemas no capacitor principal e conectores soltos na área superior direita';

async function runTest() {
  console.log('Iniciando teste de processamento de imagem com descrição...');
  console.log(`Imagem: ${testImagePath}`);
  console.log(`Descrição: "${imageDescription}"`);
  
  try {
    // Carregar dependências primeiro
    await loadDependencies();
    
    // Verificar se o arquivo existe
    if (!fs.existsSync(testImagePath)) {
      console.error(`Erro: Arquivo de imagem não encontrado: ${testImagePath}`);
      console.log('Certifique-se de que o arquivo exista ou forneça um caminho válido como argumento.');
      return;
    }
    
    console.log('\nProcessando imagem SEM descrição...');
    const resultWithoutDescription = await extractContentFromImage(testImagePath);
    console.log('\n--- Resultado sem descrição ---');
    console.log(resultWithoutDescription);
    
    console.log('\nProcessando imagem COM descrição...');
    const resultWithDescription = await extractContentFromImage(testImagePath, imageDescription);
    console.log('\n--- Resultado com descrição ---');
    console.log(resultWithDescription);
    
    console.log('\nComparação completa.');
    console.log('Observe como a descrição fornecida influencia a análise do LLM multimodal.');
    
  } catch (error) {
    console.error('Erro durante o teste:', error);
  }
}

// Executar o teste
runTest().catch(console.error);