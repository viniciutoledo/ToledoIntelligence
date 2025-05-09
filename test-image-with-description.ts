/**
 * Script para testar o processamento de imagens com descrição
 * usando modelos multimodais (GPT-4o e Claude 3)
 * 
 * Execute com: npx tsx test-image-with-description.ts
 */
import fs from 'fs';
import path from 'path';
import { extractContentFromImage } from './server/document-processors';

// Definir caminho da imagem e descrição
const testImagePath = './uploads/files/circuit-board-test.jpg';
const imageDescription = 'Placa de circuito com possíveis problemas no capacitor principal e conectores soltos na área superior direita';

async function runTest() {
  console.log('Iniciando teste de processamento de imagem com descrição...');
  console.log(`Imagem: ${testImagePath}`);
  console.log(`Descrição: "${imageDescription}"`);
  
  try {
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