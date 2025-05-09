/**
 * Script para testar o processamento de imagens com descrição
 * usando modelos multimodais (GPT-4o e Claude 3)
 * 
 * Execute com: node test-image-description.js
 */
const fs = require('fs');
const path = require('path');
const { extractContentFromImage } = require('./server/document-processors');

// Definir caminho da imagem e descrição
const testImagePath = process.argv[2] || './uploads/files/test-circuit-board.jpg'; // Substituir por uma imagem real
const imageDescription = process.argv[3] || 'Placa de circuito com problemas no capacitor C13 e conexões soltas no resistor R22';

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

runTest().catch(console.error);