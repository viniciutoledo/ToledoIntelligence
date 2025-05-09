/**
 * Teste simplificado para análise de imagem
 * Execute com: npx tsx quick-image-test.ts
 */
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';

// Configuração básica
const testImagePath = './uploads/files/circuit-board-test.jpg';

// Função para teste direto com o OpenAI API
async function testImageAnalysis() {
  console.log('Iniciando teste rápido de análise de imagem...');
  console.log(`Imagem: ${testImagePath}`);
  
  try {
    // Verificar se o arquivo existe
    if (!fs.existsSync(testImagePath)) {
      console.error(`Erro: Arquivo de imagem não encontrado: ${testImagePath}`);
      return;
    }
    
    // Obter o tamanho do arquivo
    const stats = fs.statSync(testImagePath);
    console.log(`Tamanho do arquivo: ${(stats.size / 1024).toFixed(2)} KB`);
    
    // Carregar a imagem como base64
    const imageBuffer = fs.readFileSync(testImagePath);
    const base64Image = imageBuffer.toString('base64');
    
    // Criar cliente OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // Teste 1: Sem descrição
    console.log('\nTeste 1: Processando imagem SEM descrição adicional...');
    const response1 = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Você é um especialista em manutenção de placas de circuito. Analise a imagem fornecida detalhadamente, identificando componentes, conexões, possíveis problemas e características relevantes."
        },
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: "Analise esta imagem de placa de circuito em detalhes para fins de manutenção:"
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 300 // Limitado para ser mais rápido
    });
    
    console.log('\n--- Resultado sem descrição ---');
    console.log(response1.choices[0].message.content);
    
    // Teste 2: Com descrição
    console.log('\nTeste 2: Processando imagem COM descrição adicional...');
    const description = 'Placa de circuito com possíveis problemas no capacitor principal e conectores soltos na área superior direita';
    
    const response2 = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Você é um especialista em manutenção de placas de circuito. Analise a imagem fornecida detalhadamente, identificando componentes, conexões, possíveis problemas e características relevantes."
        },
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: `Analise esta imagem de placa de circuito em detalhes para fins de manutenção. Descrição fornecida pelo usuário: "${description}"`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 300 // Limitado para ser mais rápido
    });
    
    console.log('\n--- Resultado com descrição ---');
    console.log(response2.choices[0].message.content);
    
    console.log('\nComparação completa.');
    console.log('Observe como a descrição fornecida influencia a análise do LLM multimodal.');
    
  } catch (error) {
    console.error('Erro durante o teste:', error);
  }
}

// Executar o teste
testImageAnalysis().catch(console.error);