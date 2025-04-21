import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import { promisify } from 'util';
import { storage } from './storage';
import path from 'path';

// the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
const DEFAULT_MODEL = 'claude-3-7-sonnet-20250219';

// Convert fs.readFile to use promises
const readFile = promisify(fs.readFile);

// Create Anthropic client with environment variable or active config
async function getAnthropicClient() {
  // Try to get active config from database
  const activeConfig = await storage.getActiveLlmConfig();
  
  // Use API key from config or fallback to environment variable
  const apiKey = activeConfig?.api_key || process.env.ANTHROPIC_API_KEY || '';
  
  if (!apiKey) {
    throw new Error('No API key available for LLM');
  }
  
  return new Anthropic({
    apiKey
  });
}

// Get active model name
async function getActiveModelName() {
  const activeConfig = await storage.getActiveLlmConfig();
  return activeConfig?.model_name || DEFAULT_MODEL;
}

// Convert image to base64
async function imageToBase64(imagePath: string): Promise<string> {
  const imageBuffer = await readFile(imagePath);
  return imageBuffer.toString('base64');
}

// Analyze image with Anthropic API
export async function analyzeImage(imagePath: string, language: string): Promise<string> {
  try {
    const anthropic = await getAnthropicClient();
    const modelName = await getActiveModelName();
    const base64Image = await imageToBase64(imagePath);
    
    const systemPrompt = language === 'pt' 
      ? `Você é um assistente especializado em manutenção de placas de circuito. Analise a imagem fornecida e identifique possíveis problemas, componentes danificados, ou problemas de solda. Forneça insights técnicos precisos e sugestões para correção dos problemas. Responda em Português.`
      : `You are an assistant specialized in circuit board maintenance. Analyze the provided image and identify possible issues, damaged components, or soldering problems. Provide accurate technical insights and suggestions for correcting the issues. Respond in English.`;

    const userPrompt = language === 'pt'
      ? 'Por favor, analise esta imagem de placa de circuito e identifique quaisquer problemas visíveis, componentes danificados ou questões de manufatura. Forneça detalhes específicos sobre o que você vê e sugestões de como resolver os problemas identificados.'
      : 'Please analyze this circuit board image and identify any visible problems, damaged components, or manufacturing issues. Provide specific details about what you see and suggestions on how to address the identified issues.';

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
                media_type: getMediaType(imagePath),
                data: base64Image
              }
            }
          ]
        }
      ]
    });

    return response.content[0].text;
  } catch (error) {
    console.error('Error analyzing image:', error);
    return language === 'pt'
      ? 'Ocorreu um erro ao analisar a imagem. Por favor, tente novamente mais tarde.'
      : 'An error occurred while analyzing the image. Please try again later.';
  }
}

// Analyze file with Anthropic API
export async function analyzeFile(filePath: string, language: string): Promise<string> {
  try {
    const anthropic = await getAnthropicClient();
    const modelName = await getActiveModelName();
    
    // Read file content
    const fileContent = await readFile(filePath, 'utf-8');
    
    const systemPrompt = language === 'pt' 
      ? `Você é um assistente especializado em manutenção de placas de circuito. Analise o arquivo fornecido e extraia informações relevantes como códigos de erro, especificações técnicas, ou instruções de manutenção. Forneça insights técnicos precisos baseados no conteúdo. Responda em Português.`
      : `You are an assistant specialized in circuit board maintenance. Analyze the provided file and extract relevant information such as error codes, technical specifications, or maintenance instructions. Provide accurate technical insights based on the content. Respond in English.`;

    const userPrompt = language === 'pt'
      ? `Por favor, analise o conteúdo deste arquivo e extraia informações técnicas relevantes para manutenção de placas de circuito. O conteúdo do arquivo é:\n\n${fileContent}`
      : `Please analyze the content of this file and extract relevant technical information for circuit board maintenance. The file content is:\n\n${fileContent}`;

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

    return response.content[0].text;
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

// Test connection to Anthropic API
export async function testConnection(apiKey: string, modelName: string): Promise<boolean> {
  try {
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
    
    return !!response.content;
  } catch (error) {
    console.error('Error testing LLM connection:', error);
    return false;
  }
}
