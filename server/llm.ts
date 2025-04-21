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
  const imageBuffer = await readFile(imagePath);
  return imageBuffer.toString('base64');
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
      
      // Claude only supports certain image formats
      const supportedFormats = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      const actualMediaType = supportedFormats.includes(mediaType) ? mediaType : 'image/jpeg';
      
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
                  media_type: actualMediaType,
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
export async function analyzeFile(filePath: string, language: string): Promise<string> {
  try {
    // Read file content
    const fileContent = await readFile(filePath, 'utf-8');
    const { provider, modelName, apiKey } = await getActiveLlmInfo();
    
    // Common prompts for both providers
    const systemPrompt = language === 'pt' 
      ? `Você é um assistente especializado em manutenção de placas de circuito. Analise o arquivo fornecido e extraia informações relevantes como códigos de erro, especificações técnicas, ou instruções de manutenção. Forneça insights técnicos precisos baseados no conteúdo. Responda em Português.`
      : `You are an assistant specialized in circuit board maintenance. Analyze the provided file and extract relevant information such as error codes, technical specifications, or maintenance instructions. Provide accurate technical insights based on the content. Respond in English.`;

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
