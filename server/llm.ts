import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import fs from 'fs';
import { promisify } from 'util';
import { storage } from './storage';
import path from 'path';

// Default models
// the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
const DEFAULT_CLAUDE_MODEL = 'claude-3-7-sonnet-20250219';
// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const DEFAULT_GPT_MODEL = 'gpt-4o';

// LLM Providers
type LlmProvider = 'anthropic' | 'openai';

// Convert fs.readFile to use promises
const readFile = promisify(fs.readFile);

// Get active LLM provider and model name
async function getActiveLlmInfo(): Promise<{ provider: LlmProvider, modelName: string, apiKey: string }> {
  // Try to get active config from database
  const activeConfig = await storage.getActiveLlmConfig();
  
  // Determine provider based on model name
  let provider: LlmProvider = 'anthropic';
  let modelName = DEFAULT_CLAUDE_MODEL;
  let apiKey = process.env.ANTHROPIC_API_KEY || '';
  
  if (activeConfig) {
    // If we have a config, use it
    apiKey = activeConfig.api_key;
    modelName = activeConfig.model_name;
    
    // Determine provider from model name
    if (modelName.startsWith('gpt')) {
      provider = 'openai';
    } else {
      provider = 'anthropic';
    }
  } else {
    // No config, use environment variables and defaults
    if (process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      provider = 'openai';
      apiKey = process.env.OPENAI_API_KEY || '';
      modelName = DEFAULT_GPT_MODEL;
    }
  }
  
  if (!apiKey) {
    throw new Error('No API key available for LLM');
  }
  
  return { provider, modelName, apiKey };
}

// Create OpenAI client
function getOpenAIClient(apiKey: string) {
  return new OpenAI({ apiKey });
}

// Create Anthropic client
function getAnthropicClient(apiKey: string) {
  return new Anthropic({ apiKey });
}

// Convert image to base64
async function imageToBase64(imagePath: string): Promise<string> {
  try {
    console.log(`Tentando ler arquivo de imagem: ${imagePath}`);
    
    if (!fs.existsSync(imagePath)) {
      console.error(`Arquivo não encontrado: ${imagePath}`);
      
      // Tentar construir caminhos alternativos
      const alternativePath1 = path.join(process.cwd(), 'uploads', 'files', path.basename(imagePath));
      const alternativePath2 = path.join('/home/runner/workspace/uploads/files', path.basename(imagePath));
      
      console.log(`Tentando caminhos alternativos: 
        1. ${alternativePath1} (existe: ${fs.existsSync(alternativePath1)})
        2. ${alternativePath2} (existe: ${fs.existsSync(alternativePath2)})`);
      
      // Se encontrarmos o arquivo em um dos caminhos alternativos, usamos ele
      if (fs.existsSync(alternativePath1)) {
        console.log(`Usando caminho alternativo 1: ${alternativePath1}`);
        const imageBuffer = await readFile(alternativePath1);
        return imageBuffer.toString('base64');
      } else if (fs.existsSync(alternativePath2)) {
        console.log(`Usando caminho alternativo 2: ${alternativePath2}`);
        const imageBuffer = await readFile(alternativePath2);
        return imageBuffer.toString('base64');
      }
      
      throw new Error(`Arquivo não encontrado: ${imagePath}`);
    }
    
    const imageBuffer = await readFile(imagePath);
    console.log(`Arquivo lido com sucesso: ${imagePath}, tamanho: ${imageBuffer.length} bytes`);
    return imageBuffer.toString('base64');
  } catch (error) {
    console.error(`Erro ao converter imagem para base64: ${error instanceof Error ? error.message : error}`);
    throw error;
  }
}

// Analyze image with either Anthropic or OpenAI
export async function analyzeImage(imagePath: string, language: string): Promise<string> {
  try {
    const base64Image = await imageToBase64(imagePath);
    const { provider, modelName, apiKey } = await getActiveLlmInfo();
    
    // Common prompts for both providers
    const systemPrompt = language === 'pt' 
      ? `Você é um assistente especializado em manutenção de placas de circuito. Analise a imagem fornecida e identifique possíveis problemas, componentes danificados, ou problemas de solda. Forneça insights técnicos precisos e sugestões para correção dos problemas. Responda em Português.`
      : `You are an assistant specialized in circuit board maintenance. Analyze the provided image and identify possible issues, damaged components, or soldering problems. Provide accurate technical insights and suggestions for correcting the issues. Respond in English.`;

    const userPrompt = language === 'pt'
      ? 'Por favor, analise esta imagem de placa de circuito e identifique quaisquer problemas visíveis, componentes danificados ou questões de manufatura. Forneça detalhes específicos sobre o que você vê e sugestões de como resolver os problemas identificados.'
      : 'Please analyze this circuit board image and identify any visible problems, damaged components, or manufacturing issues. Provide specific details about what you see and suggestions on how to address the identified issues.';

    // Process with appropriate provider
    if (provider === 'anthropic') {
      // Use Anthropic Claude
      const anthropic = getAnthropicClient(apiKey);
      const mediaType = getMediaType(imagePath);
      
      // Claude apenas suporta formatos específicos de imagem
      const supportedFormats = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      // Se o formato não for suportado, vamos usar jpeg como padrão
      let actualMediaType = 'image/jpeg';
      
      if (supportedFormats.includes(mediaType)) {
        actualMediaType = mediaType;
      }
      
      console.log(`Tipo de mídia original: ${mediaType}, tipo a ser usado: ${actualMediaType}`);
      
      const response = await anthropic.messages.create({
        model: modelName,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: userPrompt
              },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: supportedFormats.includes(actualMediaType) ? actualMediaType : 'image/jpeg',
                  data: base64Image
                }
              }
            ]
          }
        ]
      });

      if (response.content[0].type === 'text') {
        return response.content[0].text;
      } else {
        return 'Erro no formato da resposta do modelo.';
      }
    } else {
      // Use OpenAI
      const openai = getOpenAIClient(apiKey);
      
      const response = await openai.chat.completions.create({
        model: modelName, 
        max_tokens: 1024,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: userPrompt
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${getMediaType(imagePath)};base64,${base64Image}`
                }
              }
            ]
          }
        ]
      });

      return response.choices[0].message.content || 'Sem resposta do modelo.';
    }
  } catch (error) {
    console.error('Error analyzing image:', error);
    return language === 'pt'
      ? 'Ocorreu um erro ao analisar a imagem. Por favor, tente novamente mais tarde.'
      : 'An error occurred while analyzing the image. Please try again later.';
  }
}

// Analyze file with either Anthropic or OpenAI
// Processa mensagens de texto com LLM
export async function processTextMessage(message: string, language: string): Promise<string> {
  try {
    const { provider, modelName, apiKey } = await getActiveLlmInfo();
    
    // Prompts para os diferentes provedores
    const systemPrompt = language === 'pt' 
      ? `Você é um assistente técnico especializado em manutenção de placas de circuito. 
         Forneça respostas precisas, úteis e CONCISAS (máximo 3-4 frases) relacionadas à manutenção, 
         diagnóstico e reparo de placas de circuito. Use linguagem simples e direta, como 
         se estivesse conversando com um colega técnico. Evite explicações muito longas e 
         acadêmicas. Responda em Português.`
      : `You are a technical assistant specialized in circuit board maintenance. 
         Provide accurate, helpful and CONCISE (maximum 3-4 sentences) responses related to maintenance, 
         diagnosis, and repair of circuit boards. Use simple and direct language, as if you were
         talking to a fellow technician. Avoid overly lengthy and academic explanations. Respond in English.`;
    
    // Process with appropriate provider
    if (provider === 'anthropic') {
      // Use Anthropic Claude
      console.log("Processando texto com Anthropic Claude:", {
        model: modelName,
        messageLength: message.length
      });
      
      const anthropic = getAnthropicClient(apiKey);
      
      const response = await anthropic.messages.create({
        model: modelName,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: message
          }
        ]
      });

      if (response.content[0].type === 'text') {
        return response.content[0].text;
      } else {
        return 'Erro no formato da resposta do modelo.';
      }
    } else {
      // Use OpenAI
      console.log("Processando texto com OpenAI:", {
        model: modelName,
        messageLength: message.length
      });
      
      const openai = getOpenAIClient(apiKey);
      
      const response = await openai.chat.completions.create({
        model: modelName,
        max_tokens: 1024,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: message
          }
        ]
      });

      return response.choices[0].message.content || 'Sem resposta do modelo.';
    }
  } catch (error) {
    console.error('Erro ao processar mensagem de texto:', error);
    return language === 'pt'
      ? 'Ocorreu um erro ao processar sua mensagem. Por favor, tente novamente mais tarde.'
      : 'An error occurred while processing your message. Please try again later.';
  }
}

export async function analyzeFile(filePath: string, language: string): Promise<string> {
  try {
    // Read file content
    const fileContent = await readFile(filePath, 'utf-8');
    const { provider, modelName, apiKey } = await getActiveLlmInfo();
    
    // Common prompts for both providers
    const systemPrompt = language === 'pt' 
      ? `Você é um técnico especializado em manutenção de placas de circuito. 
         Analise o arquivo fornecido e extraia as 3-4 informações MAIS importantes, como códigos de erro, 
         especificações técnicas ou instruções de manutenção. Mantenha a resposta CONCISA (máximo 
         3-4 frases) e em linguagem técnica direta. Evite explicações longas e teóricas. 
         Responda como um técnico falaria com outro técnico. Responda em Português.`
      : `You are a technician specialized in circuit board maintenance. 
         Analyze the provided file and extract the 3-4 MOST important pieces of information, such as error codes, 
         technical specifications, or maintenance instructions. Keep your response CONCISE (maximum 
         3-4 sentences) and in direct technical language. Avoid lengthy theoretical explanations.
         Respond as one technician would talk to another. Respond in English.`;

    const userPrompt = language === 'pt'
      ? `Por favor, analise o conteúdo deste arquivo e extraia informações técnicas relevantes para manutenção de placas de circuito. O conteúdo do arquivo é:\n\n${fileContent}`
      : `Please analyze the content of this file and extract relevant technical information for circuit board maintenance. The file content is:\n\n${fileContent}`;
    
    // Process with appropriate provider
    if (provider === 'anthropic') {
      // Use Anthropic Claude
      const anthropic = getAnthropicClient(apiKey);
      
      const response = await anthropic.messages.create({
        model: modelName,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt
          }
        ]
      });

      if (response.content[0].type === 'text') {
        return response.content[0].text;
      } else {
        return 'Erro no formato da resposta do modelo.';
      }
    } else {
      // Use OpenAI
      const openai = getOpenAIClient(apiKey);
      
      const response = await openai.chat.completions.create({
        model: modelName,
        max_tokens: 1024,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userPrompt
          }
        ]
      });

      return response.choices[0].message.content || 'Sem resposta do modelo.';
    }
  } catch (error) {
    console.error('Error analyzing file:', error);
    return language === 'pt'
      ? 'Ocorreu um erro ao analisar o arquivo. Por favor, tente novamente mais tarde.'
      : 'An error occurred while analyzing the file. Please try again later.';
  }
}

// Determine media type based on file extension
function getMediaType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  
  switch (extension) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.pdf':
      return 'application/pdf';
    case '.txt':
      return 'text/plain';
    default:
      return 'application/octet-stream';
  }
}

// Test connection to either Anthropic or OpenAI API
export async function testConnection(apiKey: string, modelName: string): Promise<boolean> {
  try {
    // Determine provider based on model name
    const isOpenAI = modelName.startsWith('gpt');
    
    if (isOpenAI) {
      // Test OpenAI connection
      const openai = new OpenAI({ apiKey });
      
      // Simple test request
      const response = await openai.chat.completions.create({
        model: modelName,
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: 'Test connection'
          }
        ]
      });
      
      return !!response.choices[0].message.content;
    } else {
      // Test Anthropic connection
      const anthropic = new Anthropic({
        apiKey
      });
      
      // Simple test request
      const response = await anthropic.messages.create({
        model: modelName,
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: 'Test connection'
          }
        ]
      });
      
      return response.content.length > 0;
    }
  } catch (error) {
    console.error('Error testing LLM connection:', error);
    return false;
  }
}
