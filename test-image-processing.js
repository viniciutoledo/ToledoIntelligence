/**
 * Script para testar o processamento de imagens com LLM multimodal
 * 
 * Execute com: node test-image-processing.js
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Função principal do teste
async function runTest() {
  try {
    console.log("Iniciando teste de processamento de imagens com LLM...");
    
    // Importar o processador de documentos
    const { extractContentFromImage } = await import('./server/document-processors.js');
    
    // Usar uma imagem existente para o teste
    const imagePath = path.join(__dirname, 'uploads/files/1746802088455-098011a34b8e.png');
    console.log(`Usando imagem de teste: ${imagePath}`);
    
    // Processar a imagem
    console.log("Iniciando análise da imagem com LLM multimodal...");
    const result = await extractContentFromImage(imagePath);
    
    console.log("\n=== RESULTADO DA ANÁLISE DE IMAGEM ===\n");
    console.log(result);
    console.log("\n====================================\n");
    
  } catch (error) {
    console.error("Erro durante o teste:", error);
  }
}

// Executar o teste
runTest();