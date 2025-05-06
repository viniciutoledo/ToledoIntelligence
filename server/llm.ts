import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import fs from 'fs';
import { promisify } from 'util';
import { storage } from './storage';
import path from 'path';
import pdfParse from 'pdf-parse';

// Default models
// the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
const DEFAULT_CLAUDE_MODEL = 'claude-3-7-sonnet-20250219';
// the newest OpenAI model is "gpt-4o" which was released May 13, 2024
const DEFAULT_GPT_MODEL = 'gpt-4o';

// Função auxiliar para registrar o uso do LLM
export async function logLlmUsage(
  modelName: string, 
  operationType: "text" | "image" | "audio" | "file" | "test", 
  success: boolean, 
  userId?: number, 
  widgetId?: string, 
  tokenCount: number = 0, 
  errorMessage?: string
): Promise<void> {
  try {
    // Detectar o provedor com base no nome do modelo
    let provider = '';
    
    // Detecção mais precisa de provedor
    if (modelName.includes('gpt') || modelName.includes('o4') || modelName.includes('o3')) {
      provider = 'openai';
    } else if (modelName.includes('claude')) {
      provider = 'anthropic';
    } else if (modelName.includes('llama')) {
      provider = 'meta';
    } else if (modelName.includes('qwen')) {
      provider = 'alibaba';
    } else if (modelName.includes('deepseek')) {
      provider = 'deepseek';
    } else if (modelName.includes('maritalk')) {
      provider = 'maritaca';
    } else {
      // Fallback: extrair do nome do modelo (parte antes da primeira barra, se existir)
      provider = modelName.split('/')[0].toLowerCase();
    }
    
    // Log para debug
    console.log(`Detectado provedor '${provider}' para modelo '${modelName}'`);
    
    // Registrar no sistema de armazenamento
    await storage.logLlmUsage({
      model_name: modelName,
      provider,
      operation_type: operationType,
      user_id: userId,
      widget_id: widgetId,
      token_count: tokenCount,
      success,
      error_message: errorMessage
    });
    
    console.log(`LLM usage logged: ${modelName} (${provider}) - ${operationType} - ${success ? 'Success' : 'Failed'} - ${tokenCount} tokens`);
  } catch (error) {
    // Não interromper o fluxo principal se o registro falhar
    console.error('Error logging LLM usage:', error);
  }
}

// LLM Providers
type LlmProvider = 'anthropic' | 'openai';

// Tone options
type LlmTone = 'formal' | 'normal' | 'casual';

// LLM Configuration interface
interface LlmFullConfig {
  provider: LlmProvider; 
  modelName: string; 
  apiKey: string;
  tone: LlmTone;
  behaviorInstructions?: string;
  shouldUseTrained: boolean;
}

// Convert fs.readFile to use promises
const readFile = promisify(fs.readFile);

// Nota: A função de limpeza de API key foi substituída por
// métodos mais robustos diretamente nas funções getOpenAIClient e getAnthropicClient
// para tratar as chaves adequadamente.

// Get active LLM provider and model name with all configuration options
export async function getActiveLlmInfo(): Promise<LlmFullConfig> {
  console.log('DIAGNÓSTICO: Buscando configuração LLM ativa');
  
  // Try to get active config from database
  const activeConfig = await storage.getActiveLlmConfig();
  
  // Set default values
  let provider: LlmProvider = 'anthropic';
  let modelName = DEFAULT_CLAUDE_MODEL;
  let apiKey = process.env.ANTHROPIC_API_KEY || '';
  let tone: LlmTone = 'normal';
  let behaviorInstructions = '';
  let shouldUseTrained = true;
  
  if (activeConfig) {
    console.log('DIAGNÓSTICO: Encontrada configuração LLM ativa na base de dados');
    console.log('DIAGNÓSTICO: Modelo configurado: ' + activeConfig.model_name);
    
    // Verificar se a chave API existe na configuração
    if (!activeConfig.api_key || activeConfig.api_key.length < 10) {
      console.error('ERRO CRÍTICO: Chave API na configuração do banco é inválida ou muito curta');
      
      // Tentar usar chave do ambiente como fallback
      if (activeConfig.model_name.startsWith('gpt') && process.env.OPENAI_API_KEY) {
        console.log('DIAGNÓSTICO: Usando chave de ambiente OpenAI como fallback');
        apiKey = process.env.OPENAI_API_KEY;
      } else if (!activeConfig.model_name.startsWith('gpt') && process.env.ANTHROPIC_API_KEY) {
        console.log('DIAGNÓSTICO: Usando chave de ambiente Anthropic como fallback');
        apiKey = process.env.ANTHROPIC_API_KEY;
      } else {
        console.error('ERRO CRÍTICO: Sem chave API válida disponível para o modelo configurado');
      }
    } else {
      // If we have a config, use it directly without cleaning the API key
      apiKey = activeConfig.api_key;
      
      // Verificar a chave parcialmente mascarada
      const maskedKey = apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4);
      console.log('DIAGNÓSTICO: Chave API carregada (parcial): ' + maskedKey);
    }
    
    modelName = activeConfig.model_name;
    tone = activeConfig.tone as LlmTone || 'normal';
    behaviorInstructions = activeConfig.behavior_instructions || '';
    shouldUseTrained = activeConfig.should_use_training !== false;
    
    // Determine provider from model name
    if (modelName.startsWith('gpt')) {
      provider = 'openai';
    } else {
      provider = 'anthropic';
    }
  } else {
    console.log('DIAGNÓSTICO: Nenhuma configuração LLM encontrada na base, usando variáveis de ambiente');
    
    // No config, use environment variables and defaults
    if (process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      provider = 'openai';
      apiKey = process.env.OPENAI_API_KEY || '';
      modelName = DEFAULT_GPT_MODEL;
      console.log('DIAGNÓSTICO: Usando OpenAI do ambiente (sem configuração na base)');
    } else {
      // Use Anthropic como padrão, usar a chave diretamente
      apiKey = process.env.ANTHROPIC_API_KEY || '';
      console.log('DIAGNÓSTICO: Usando Anthropic do ambiente (sem configuração na base)');
    }
  }
  
  if (!apiKey) {
    console.error('ERRO CRÍTICO: Nenhuma chave API disponível para LLM!');
    throw new Error('No API key available for LLM');
  }
  
  console.log(`DIAGNÓSTICO: Configuração final - Provider: ${provider}, Modelo: ${modelName}, Tom: ${tone}`);
  
  // Retornar a configuração completa com a chave API já limpa
  return { 
    provider, 
    modelName, 
    apiKey, 
    tone, 
    behaviorInstructions, 
    shouldUseTrained 
  };
}

// Client singleton para OpenAI
let openaiClient: OpenAI | null = null;

// Create OpenAI client
// Adaptador que usa chamadas fetch diretamente em vez de usar o cliente OpenAI
// para evitar os problemas persistentes com headers HTTP
export async function fetchOpenAIDirectly(endpoint: string, data: any, apiKey: string) {
  console.log('Chamando OpenAI diretamente via fetch: ' + endpoint);
  
  // Verificar se a chave API contém caracteres inválidos ou mascarados (•)
  if (apiKey.includes('•') || apiKey.includes('…')) {
    console.error('ERRO: Chave API contém caracteres de mascaramento');
    // Usar a chave de ambiente se disponível
    if (process.env.OPENAI_API_KEY) {
      console.log('Usando chave OpenAI do ambiente como alternativa');
      apiKey = process.env.OPENAI_API_KEY;
    } else {
      throw new Error('Chave API contém caracteres inválidos e não há chave alternativa disponível');
    }
  }
  
  // Garantir que a chave está limpa
  if (typeof apiKey !== 'string') {
    throw new Error('API key inválida para OpenAI: não é uma string');
  }
  
  // URGENTE: Limpar a chave apenas de prefixos e aspas, sem remover outros caracteres
  // que podem ser parte da chave
  let cleanedKey = apiKey.replace(/^bearer\s+/i, '').replace(/["']/g, '').trim();
  
  // Verificar se a chave não está vazia ou muito curta após a limpeza
  if (!cleanedKey || cleanedKey.length < 10) {
    console.error('ALERTA: Chave API ficou muito curta após limpeza, usando original');
    cleanedKey = apiKey.trim();
  }
  
  // Verificação adicional - garantir que a chave não foi completamente zerada
  if (!cleanedKey) {
    console.error('ERRO CRÍTICO: Chave OpenAI está vazia após limpeza');
    // Usar chave direta do ambiente em caso de emergência
    if (process.env.OPENAI_API_KEY) {
      console.log('Tentando usar chave OpenAI do ambiente como fallback');
      cleanedKey = process.env.OPENAI_API_KEY;
    }
  }
  
  try {
    // Verificar se há caracteres não-ASCII na chave
    for (let i = 0; i < cleanedKey.length; i++) {
      if (cleanedKey.charCodeAt(i) > 255) {
        console.error(`Caractere inválido encontrado na posição ${i}: ${cleanedKey.charCodeAt(i)}`);
        if (process.env.OPENAI_API_KEY) {
          console.log('Usando chave OpenAI do ambiente devido a caracteres inválidos');
          cleanedKey = process.env.OPENAI_API_KEY;
          break;
        } else {
          throw new Error('A chave de API contém caracteres inválidos');
        }
      }
    }
    
    // Validar formato da chave API (aceitar tanto 'sk-' quanto 'sk-proj-')
    if (!cleanedKey.startsWith('sk-')) {
      console.error('ALERTA: Chave OpenAI não tem o formato esperado (sk- ou sk-proj-)');
      throw new Error('Formato de chave API inválido. Deve começar com sk- ou sk-proj-');
    }
    
    // Usar concatenação de strings em vez de template literals para evitar problemas com caracteres especiais
    const authHeader = 'Bearer ' + cleanedKey;
    
    const response = await fetch('https://api.openai.com/v1/' + endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        'OpenAI-Beta': 'assistants=v1'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro na resposta da OpenAI:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Erro ao chamar OpenAI diretamente:', error);
    throw error;
  }
}

function getOpenAIClient(apiKey: string) {
  // Usar singleton para reutilizar
  if (openaiClient) {
    return openaiClient;
  }
  
  // Garantir que não temos nenhum prefixo em NENHUMA circunstância
  if (typeof apiKey !== 'string') {
    throw new Error('API key inválida para OpenAI: não é uma string');
  }
  
  // Remover qualquer prefixo em todas as circunstâncias
  const cleanedKey = apiKey.replace(/^bearer\s+/i, '').replace(/["']/g, '').trim();
  
  // Verificar comprimento mínimo após limpeza
  if (cleanedKey.length < 20) {
    throw new Error('API key da OpenAI parece ser inválida (muito curta)');
  }
  
  // Verificar se a chave começa com o formato esperado
  if (!cleanedKey.startsWith('sk-')) {
    console.error('AVISO: Chave OpenAI não começa com sk-, formato potencialmente inválido');
  }
  
  // Validar corretamente os novos formatos de chave (sk-proj-) além do formato tradicional (sk-)
  console.log('Formato da chave OpenAI: ' + (cleanedKey.startsWith('sk-proj-') ? 'Novo formato (sk-proj-)' : 'Formato tradicional'));
  
  // Loga a chave parcialmente mascarada para debug
  const maskedKey = cleanedKey.substring(0, 4) + '...' + cleanedKey.substring(cleanedKey.length - 4);
  console.log('Inicializando OpenAI com chave: ' + maskedKey.substring(0, 4) + '...' + maskedKey.substring(maskedKey.length - 4));
  
  // Criar um cliente falso que usa fetch diretamente
  try {
    // Criar um cliente fake que usa nossa implementação de fetch direta
    openaiClient = {
      chat: {
        completions: {
          create: async (params: any) => {
            const response = await fetchOpenAIDirectly('chat/completions', params, cleanedKey);
            return response;
          }
        }
      }
    } as any;
    
    return openaiClient;
  } catch (err) {
    console.error('Erro ao criar cliente OpenAI:', err);
    throw new Error('Falha ao inicializar cliente OpenAI');
  }
}

// Client singleton para Anthropic
let anthropicClient: Anthropic | null = null;

// Create Anthropic client
// Adaptador que usa chamadas fetch diretamente em vez de usar o cliente Anthropic
// para evitar os problemas persistentes com headers HTTP
export async function fetchAnthropicDirectly(endpoint: string, data: any, apiKey: string) {
  console.log('Chamando Anthropic diretamente via fetch: ' + endpoint);
  
  // Verificar se a chave API contém caracteres inválidos ou mascarados (•)
  if (apiKey.includes('•') || apiKey.includes('…')) {
    console.error('ERRO: Chave API Anthropic contém caracteres de mascaramento');
    // Usar a chave de ambiente se disponível
    if (process.env.ANTHROPIC_API_KEY) {
      console.log('Usando chave Anthropic do ambiente como alternativa');
      apiKey = process.env.ANTHROPIC_API_KEY;
    } else {
      throw new Error('Chave API contém caracteres inválidos e não há chave alternativa disponível');
    }
  }
  
  // Garantir que a chave está limpa
  if (typeof apiKey !== 'string') {
    throw new Error('API key inválida para Anthropic: não é uma string');
  }
  
  // URGENTE: Limpar a chave apenas de prefixos e aspas, sem remover outros caracteres
  // que podem ser parte da chave
  let cleanedKey = apiKey.replace(/^bearer\s+/i, '').replace(/["']/g, '').trim();
  
  // Verificar se a chave não está vazia ou muito curta após a limpeza
  if (!cleanedKey || cleanedKey.length < 10) {
    console.error('ALERTA: Chave API Anthropic ficou muito curta após limpeza, usando original');
    cleanedKey = apiKey.trim();
  }
  
  // Verificação adicional - garantir que a chave não foi completamente zerada
  if (!cleanedKey) {
    console.error('ERRO CRÍTICO: Chave Anthropic está vazia após limpeza');
    // Usar chave direta do ambiente em caso de emergência
    if (process.env.ANTHROPIC_API_KEY) {
      console.log('Tentando usar chave Anthropic do ambiente como fallback');
      cleanedKey = process.env.ANTHROPIC_API_KEY;
    }
  }
  
  // Verificar se há caracteres não-ASCII na chave
  for (let i = 0; i < cleanedKey.length; i++) {
    if (cleanedKey.charCodeAt(i) > 255) {
      console.error(`Caractere inválido encontrado na posição ${i}: ${cleanedKey.charCodeAt(i)}`);
      if (process.env.ANTHROPIC_API_KEY) {
        console.log('Usando chave Anthropic do ambiente devido a caracteres inválidos');
        cleanedKey = process.env.ANTHROPIC_API_KEY;
        break;
      } else {
        throw new Error('A chave de API contém caracteres inválidos');
      }
    }
  }
  
  // Correção para formatar os dados conforme esperado pela API do Anthropic
  // A API espera { prompt: "" } para Claude 1/2 ou { messages: [] } para Claude 3
  const formattedData = { ...data };
  
  console.log('DADOS ORIGINAIS ANTHROPIC:', JSON.stringify(data, null, 2));
  
  // Verificar se estamos tentando usar o formato Claude 3 (messages) com um modelo Claude 2
  if (data.messages && (data.model === 'claude-2' || data.model === 'claude-2.0' || data.model === 'claude-2.1')) {
    console.log('Convertendo formato de API Claude 3 para Claude 2');
    
    // Extrair apenas o conteúdo da primeira mensagem do usuário
    const userMessage = data.messages.find((msg: any) => msg.role === 'user');
    if (userMessage) {
      formattedData.prompt = `\n\nHuman: ${userMessage.content}\n\nAssistant: `;
      delete formattedData.messages;
    }
  }
  
  // Verificar o formato correto com base no modelo
  if (!formattedData.prompt && !formattedData.messages) {
    console.error('AVISO: Dados do Anthropic não têm prompt nem messages, tentando corrigir');
    
    // Tentar criar um prompt básico como fallback
    formattedData.prompt = "\n\nHuman: Hello\n\nAssistant: ";
  }
  
  console.log('DADOS FORMATADOS ANTHROPIC:', JSON.stringify(formattedData, null, 2));
  
  try {
    // Construir URL e cabeçalhos usando concatenação para evitar problemas com caracteres Unicode
    const url = 'https://api.anthropic.com/v1/' + endpoint;
    
    // Verificar versão da API baseado no modelo
    const apiVersion = data.model?.includes('claude-3') ? '2023-06-01' : '2023-06-01';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cleanedKey,
        'anthropic-version': apiVersion
      },
      body: JSON.stringify(formattedData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro na resposta da Anthropic:', response.status, errorText);
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Erro ao chamar Anthropic diretamente:', error);
    throw error;
  }
}

function getAnthropicClient(apiKey: string) {
  // Usar singleton para reutilizar
  if (anthropicClient) {
    return anthropicClient;
  }
  
  // Garantir que não temos nenhum prefixo em NENHUMA circunstância
  if (typeof apiKey !== 'string') {
    throw new Error('API key inválida para Anthropic: não é uma string');
  }
  
  // Remover qualquer prefixo em todas as circunstâncias
  const cleanedKey = apiKey.replace(/^bearer\s+/i, '').replace(/["']/g, '').trim();
  
  // Verificar comprimento mínimo após limpeza
  if (cleanedKey.length < 20) {
    throw new Error('API key da Anthropic parece ser inválida (muito curta)');
  }
  
  // Loga a chave parcialmente mascarada para debug
  const maskedKey = cleanedKey.substring(0, 4) + '...' + cleanedKey.substring(cleanedKey.length - 4);
  console.log('Inicializando Anthropic com chave: ' + maskedKey.substring(0, 4) + '...' + maskedKey.substring(maskedKey.length - 4));
  
  try {
    // Verificando se a chave já está no formato correto para o Anthropic
    if (cleanedKey.startsWith('sk-ant-')) {
      console.log('Chave Anthropic corretamente formatada');
    } else {
      console.log('AVISO: Chave Anthropic não começa com sk-ant-, pode causar problemas');
    }
    
    // Criar um cliente falso que usa fetch diretamente
    anthropicClient = {
      messages: {
        create: async (params: any) => {
          const response = await fetchAnthropicDirectly('messages', params, cleanedKey);
          return {
            content: [
              {
                type: 'text',
                text: response.content
              }
            ]
          };
        }
      }
    } as any;
    
    return anthropicClient;
  } catch (err) {
    console.error('Erro ao criar cliente Anthropic:', err);
    throw new Error('Falha ao inicializar cliente Anthropic');
  }
}

// Verifica se um buffer contém uma imagem válida
function isValidImageBuffer(buffer: Buffer): boolean {
  // Assinaturas de arquivo comuns para formatos de imagem
  const jpegSignature = Buffer.from([0xFF, 0xD8, 0xFF]);
  const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
  const gifSignature = Buffer.from('GIF8', 'ascii');
  const webpSignature = Buffer.from('RIFF', 'ascii');

  // Verifica as assinaturas no início do buffer
  if (buffer.length < 8) return false;
  
  return (
    buffer.subarray(0, 3).equals(jpegSignature) || 
    buffer.subarray(0, 4).equals(pngSignature) || 
    buffer.subarray(0, 4).equals(gifSignature) ||
    buffer.subarray(0, 4).equals(webpSignature)
  );
}

// Lista de caminhos alternativos possíveis para encontrar a imagem
function generateAlternativePaths(originalPath: string): string[] {
  const filename = path.basename(originalPath);
  
  return [
    originalPath,
    path.join(process.cwd(), 'uploads', 'files', filename),
    path.join('/home/runner/workspace/uploads/files', filename),
    path.join('/uploads/files', filename),
    path.join('./uploads/files', filename),
    path.join('../uploads/files', filename)
  ];
}

// Convert image to base64 with improved handling
async function imageToBase64(imagePath: string): Promise<string> {
  try {
    console.log(`Tentando ler arquivo de imagem: ${imagePath}`);
    
    // Gera uma lista de caminhos alternativos para procurar a imagem
    const possiblePaths = generateAlternativePaths(imagePath);
    
    // Tenta encontrar a imagem em cada um dos caminhos possíveis
    let imageBuffer: Buffer | null = null;
    let successPath = '';
    
    for (const testPath of possiblePaths) {
      try {
        if (fs.existsSync(testPath)) {
          const buffer = await readFile(testPath);
          
          // Verifica se o buffer parece ser uma imagem válida
          if (isValidImageBuffer(buffer)) {
            imageBuffer = buffer;
            successPath = testPath;
            break;
          } else {
            console.log(`Arquivo encontrado em ${testPath}, mas não parece ser uma imagem válida`);
          }
        }
      } catch (err) {
        console.log(`Não foi possível ler ${testPath}: ${err instanceof Error ? err.message : err}`);
      }
    }
    
    if (!imageBuffer) {
      // Se chegamos aqui, não conseguimos encontrar um arquivo válido
      throw new Error(`Não foi possível encontrar uma imagem válida em nenhum dos caminhos testados para: ${imagePath}`);
    }
    
    console.log(`Arquivo de imagem lido com sucesso de: ${successPath}, tamanho: ${imageBuffer.length} bytes`);
    
    // Verifica se a imagem é muito grande (maior que 10MB)
    const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
    if (imageBuffer.length > MAX_IMAGE_SIZE) {
      console.log(`Imagem muito grande: ${imageBuffer.length} bytes. Tentando reduzir...`);
      // Aqui poderíamos implementar uma redução de tamanho, mas por ora apenas alertamos
    }
    
    return imageBuffer.toString('base64');
  } catch (error) {
    console.error(`Erro ao processar imagem: ${error instanceof Error ? error.message : error}`);
    throw error;
  }
}

// Determina o formato de imagem a partir dos primeiros bytes
function detectImageFormat(buffer: Buffer): string {
  // JPEG: começa com FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }
  
  // PNG: começa com 89 50 4E 47 (hexadecimal para .PNG)
  if (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'image/png';
  }
  
  // GIF: começa com "GIF8"
  if (buffer.length >= 4 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return 'image/gif';
  }
  
  // WEBP: começa com "RIFF" e tem "WEBP" no offset 8
  if (buffer.length >= 12 && 
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return 'image/webp';
  }
  
  // Formato não detectado, retornamos JPEG como padrão
  return 'image/jpeg';
}

// Analyze image with either Anthropic or OpenAI with enhanced error handling
export async function analyzeImage(imagePath: string, language: string): Promise<string> {
  try {
    // Declarações de erros e mensagens
    const errorMessages = {
      imageNotFound: language === 'pt'
        ? 'Não foi possível encontrar a imagem. Por favor, verifique se o arquivo existe e tente novamente.'
        : 'Could not find the image. Please check if the file exists and try again.',
      invalidImage: language === 'pt'
        ? 'O arquivo não parece ser uma imagem válida. Por favor, envie uma imagem em formato JPG, PNG ou GIF.'
        : 'The file does not appear to be a valid image. Please upload an image in JPG, PNG, or GIF format.',
      modelError: language === 'pt'
        ? 'Ocorreu um erro no processamento da imagem pelo modelo. Por favor, tente com outra imagem ou mais tarde.'
        : 'An error occurred while processing the image. Please try with another image or try again later.',
      generalError: language === 'pt'
        ? 'Ocorreu um erro ao analisar a imagem. Por favor, tente novamente mais tarde.'
        : 'An error occurred while analyzing the image. Please try again later.'
    };

    // Tentar carregar a imagem com tratamento avançado de erros
    let base64Image: string;
    try {
      base64Image = await imageToBase64(imagePath);
      
      // Validação básica de dados base64
      if (!base64Image || base64Image.length < 100) {
        console.error('Imagem inválida ou muito pequena');
        return errorMessages.invalidImage;
      }
    } catch (imageError) {
      console.error('Erro ao carregar imagem:', imageError);
      return errorMessages.imageNotFound;
    }
    
    try {
      const config = await getActiveLlmInfo();
      const { provider, modelName, apiKey, tone, behaviorInstructions } = config;
      
      // Obter conteúdo do buffer novamente para detectar formato real
      const imageBuffer = Buffer.from(base64Image, 'base64');
      // Detectar formato baseado no conteúdo real
      const detectedFormat = detectImageFormat(imageBuffer);
      console.log(`Formato de imagem detectado: ${detectedFormat}`);
      
      // Configurar estilo de comunicação com base no tom escolhido
      let toneStyle = '';
      if (language === 'pt') {
        switch(tone) {
          case 'formal':
            toneStyle = 'Utilize um tom formal e profissional, com vocabulário mais técnico e estruturado.';
            break;
          case 'casual':
            toneStyle = 'Utilize um tom mais descontraído e casual, como uma conversa informal entre colegas.';
            break;
          default: // normal
            toneStyle = 'Utilize um tom equilibrado, nem muito formal nem muito casual.';
        }
      } else {
        switch(tone) {
          case 'formal':
            toneStyle = 'Use a formal and professional tone, with more technical and structured vocabulary.';
            break;
          case 'casual':
            toneStyle = 'Use a more relaxed and casual tone, like an informal conversation between colleagues.';
            break;
          default: // normal
            toneStyle = 'Use a balanced tone, neither too formal nor too casual.';
        }
      }
      
      // Instruções de comportamento personalizadas
      const customBehavior = behaviorInstructions ? 
        (language === 'pt' ? `Comportamento específico: ${behaviorInstructions}` : `Specific behavior: ${behaviorInstructions}`) : '';
      
      // Common prompts for both providers with enhanced specificity
      const systemPrompt = language === 'pt' 
        ? `Você é um técnico especializado em manutenção de placas de circuito.
           Analise a imagem da placa de circuito e identifique os 2-3 problemas ou componentes MAIS críticos.
           Seja EXTREMAMENTE CONCISO (máximo 3-4 frases) e use linguagem técnica direta,
           como se estivesse falando com um colega técnico. 
           EVITE longas explicações, descrições detalhadas ou introduções teóricas.
           Concentre-se apenas nos problemas mais graves e nas soluções mais práticas.
           Seja direto e objetivo. Responda em Português. ${toneStyle} ${customBehavior}`
        : `You are a technician specialized in circuit board maintenance.
           Analyze the circuit board image and identify the 2-3 MOST critical issues or components.
           Be EXTREMELY CONCISE (maximum 3-4 sentences) and use direct technical language,
           as if you were talking to a fellow technician.
           AVOID lengthy explanations, detailed descriptions, or theoretical introductions.
           Focus only on the most serious problems and the most practical solutions.
           Be direct and to the point. Respond in English. ${toneStyle} ${customBehavior}`;

      const userPrompt = language === 'pt'
        ? 'Analise rapidamente esta placa de circuito. Identifique apenas os problemas mais críticos (se houver) e sugira soluções práticas. Seja extremamente conciso.'
        : 'Quickly analyze this circuit board. Identify only the most critical issues (if any) and suggest practical solutions. Be extremely concise.';

      // Process with appropriate provider with enhanced error handling
      if (provider === 'anthropic') {
        // Use Anthropic Claude with direct fetch approach
        try {
          console.log(`Analisando imagem com Anthropic: ${modelName}`);
          const anthropic = getAnthropicClient(apiKey);
          
          // Claude suporta formatos específicos de imagem
          const supportedFormats = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
          
          // Para Claude, sempre usar image/jpeg como é mais universalmente compatível
          console.log(`Usando formato image/jpeg para o Claude independente do formato original`);
          
          // Estruturar dados para a chamada fetch direta para o Anthropic
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
                      media_type: "image/jpeg" as "image/jpeg",
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
            console.error('Resposta do Claude em formato inesperado');
            return errorMessages.modelError;
          }
        } catch (claudeError) {
          console.error('Erro específico do Claude:', claudeError);
          return errorMessages.modelError;
        }
      } else {
        // Use OpenAI com tratamento de erros avançado
        try {
          const openai = getOpenAIClient(apiKey);
          
          // o modelo mais recente da OpenAI é "gpt-4o" que foi lançado em 13 de maio de 2024. não mude isso a menos que explicitamente solicitado pelo usuário
          const actualModel = modelName === 'gpt-4' ? 'gpt-4o' : modelName;
          
          const response = await openai.chat.completions.create({
            model: actualModel, 
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
                      url: `data:${detectedFormat};base64,${base64Image}`
                    }
                  }
                ]
              }
            ]
          });

          if (!response.choices[0].message.content) {
            console.error('Resposta vazia do OpenAI');
            return errorMessages.modelError;
          }
          
          return response.choices[0].message.content;
        } catch (openaiError) {
          console.error('Erro específico do OpenAI:', openaiError);
          return errorMessages.modelError;
        }
      }
    } catch (error) {
      console.error('Erro geral na análise de imagem:', error);
      return errorMessages.generalError;
    }
  } catch (criticalError) {
    // Se chegamos aqui, é um erro verdadeiramente inesperado
    console.error('Erro crítico na análise de imagem:', criticalError);
    return language === 'pt'
      ? 'Ocorreu um erro crítico inesperado. Por favor, informe o administrador do sistema.'
      : 'A critical unexpected error occurred. Please inform the system administrator.';
  }
}

// Analyze file with either Anthropic or OpenAI
// Processa mensagens de texto com LLM
export async function processTextMessage(
  message: string, 
  language: string,
  llmConfig?: LlmFullConfig,
  history: Array<{ content: string, role: 'user' | 'assistant' }> = [],
  userId?: number,
  widgetId?: string
): Promise<string> {
  try {
    // Se não recebemos configuração LLM, tentar obter configurações padrão
    const config = llmConfig || await getActiveLlmInfo();
    const { provider, modelName, apiKey, tone, behaviorInstructions, shouldUseTrained } = config;
    
    // Se o idioma não foi especificado, detectamos a partir do histórico ou mensagem atual
    const detectedLanguage = language || detectLanguage(message, history);
    // Usar o idioma detectado daqui para frente
    const effectiveLanguage = detectedLanguage;
    
    // Truncar mensagem para evitar exceder limites de token
    const truncatedMessage = truncateText(message);
    
    // Configurar estilo de comunicação com base no tom escolhido
    let toneStyle = '';
    if (effectiveLanguage === 'pt') {
      switch(tone) {
        case 'formal':
          toneStyle = 'Utilize um tom formal e profissional, com vocabulário mais técnico e estruturado.';
          break;
        case 'casual':
          toneStyle = 'Utilize um tom mais descontraído e casual, como uma conversa informal entre colegas.';
          break;
        default: // normal
          toneStyle = 'Utilize um tom equilibrado, nem muito formal nem muito casual.';
      }
    } else {
      switch(tone) {
        case 'formal':
          toneStyle = 'Use a formal and professional tone, with more technical and structured vocabulary.';
          break;
        case 'casual':
          toneStyle = 'Use a more relaxed and casual tone, like an informal conversation between colleagues.';
          break;
        default: // normal
          toneStyle = 'Use a balanced tone, neither too formal nor too casual.';
      }
    }
    
    // Instruções de comportamento personalizadas
    const customBehavior = behaviorInstructions ? 
      (effectiveLanguage === 'pt' ? `Comportamento específico: ${behaviorInstructions}` : `Specific behavior: ${behaviorInstructions}`) : '';
    
    // Prompts para os diferentes provedores
    const systemPrompt = effectiveLanguage === 'pt' 
      ? `Você é um assistente técnico especializado em manutenção de placas de circuito. 
         Forneça respostas precisas, úteis e CONCISAS (máximo 3-4 frases) relacionadas à manutenção, 
         diagnóstico e reparo de placas de circuito. Use linguagem simples e direta, como 
         se estivesse conversando com um colega técnico. Evite explicações muito longas e 
         acadêmicas. Responda em Português. ${toneStyle} ${customBehavior}`
      : `You are a technical assistant specialized in circuit board maintenance. 
         Provide accurate, helpful and CONCISE (maximum 3-4 sentences) responses related to maintenance, 
         diagnosis, and repair of circuit boards. Use simple and direct language, as if you were
         talking to a fellow technician. Avoid overly lengthy and academic explanations. Respond in English. ${toneStyle} ${customBehavior}`;
    
    // Process with appropriate provider
    if (provider === 'anthropic') {
      // Use Anthropic Claude
      console.log("Processando texto com Anthropic Claude:", {
        model: modelName,
        messageLength: message.length,
        historyLength: history.length
      });
      
      const anthropic = getAnthropicClient(apiKey);
      
      // Preparar mensagens com histórico
      const messages = [...history]; // Clone o histórico
      
      // Adicionar a mensagem atual do usuário se não estiver no histórico
      if (!messages.find(m => m.content === truncatedMessage && m.role === 'user')) {
        messages.push({ role: 'user', content: truncatedMessage });
      }
      
      const response = await anthropic.messages.create({
        model: modelName,
        max_tokens: 1024,
        system: systemPrompt,
        messages
      });

      if (response.content[0].type === 'text') {
        const responseText = response.content[0].text;
        
        // Registrar uso bem-sucedido
        const tokenEstimate = estimateTokens(truncatedMessage, modelName) + estimateTokens(responseText, modelName);
        await logLlmUsage(modelName, "text", true, userId, widgetId, tokenEstimate);
        
        return responseText;
      } else {
        // Registrar erro de formato
        await logLlmUsage(modelName, "text", false, userId, widgetId, 0, 'Erro no formato da resposta');
        return 'Erro no formato da resposta do modelo.';
      }
    } else {
      // Use OpenAI com fetch direto
      console.log("Processando texto com OpenAI:", {
        model: modelName,
        messageLength: message.length,
        historyLength: history.length
      });
      
      const openai = getOpenAIClient(apiKey);
      
      // Preparar mensagens para OpenAI
      const messages = [{ role: "system", content: systemPrompt }];
      
      // Adicionar histórico se existir
      if (history.length > 0) {
        messages.push(...history.map(msg => ({
          role: msg.role,
          content: msg.content
        })));
      }
      
      // Adicionar a mensagem atual do usuário se não estiver no final do histórico
      const lastMessage = history.length > 0 ? history[history.length - 1] : null;
      if (!lastMessage || lastMessage.role !== 'user' || lastMessage.content !== truncatedMessage) {
        messages.push({ role: "user", content: truncatedMessage });
      }
      
      // o modelo mais recente da OpenAI é "gpt-4o" que foi lançado em 13 de maio de 2024. não mude isso a menos que explicitamente solicitado pelo usuário
      const actualModel = modelName === 'gpt-4' ? 'gpt-4o' : modelName;
      
      // Utilizando cliente baseado em fetch direto
      const response = await openai.chat.completions.create({
        model: actualModel,
        max_tokens: 1024,
        messages: messages
      });

      if (response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.content) {
        const responseText = response.choices[0].message.content;
        
        // Registrar uso bem-sucedido
        const tokenEstimate = estimateTokens(truncatedMessage, modelName) + estimateTokens(responseText, modelName);
        await logLlmUsage(modelName, "text", true, userId, widgetId, tokenEstimate);
        
        return responseText;
      }
      
      // Registrar erro de resposta vazia
      await logLlmUsage(modelName, "text", false, userId, widgetId, 0, 'Resposta vazia do modelo');
      return 'Sem resposta do modelo.';
    }
  } catch (error) {
    console.error('Erro ao processar mensagem de texto:', error);
    
    // Registrar erro na aplicação
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    // Usar o modelo padrão se não tivermos acesso ao modelName devido ao erro
    const modelToLog = (llmConfig?.modelName || 
                      (llmConfig?.provider === 'openai' ? DEFAULT_GPT_MODEL : DEFAULT_CLAUDE_MODEL));
    
    // Registrar o erro no sistema
    await logLlmUsage(modelToLog, "text", false, userId, widgetId, 0, errorMessage);
    
    // Tenta detectar o idioma da mensagem original para fornecer resposta de erro adequada
    // Aqui usamos o idioma passado como parâmetro, ou detectamos a partir da mensagem
    const errorLanguage = language || detectLanguage(message, history);
    return errorLanguage === 'pt'
      ? 'Ocorreu um erro ao processar sua mensagem. Por favor, tente novamente mais tarde.'
      : 'An error occurred while processing your message. Please try again later.';
  }
}

// Função auxiliar para detectar o idioma com base no histórico e mensagem atual
function detectLanguage(
  message: string, 
  history: Array<{ content: string, role: 'user' | 'assistant' }> = []
): 'pt' | 'en' {
  // Palavras comuns em português para detecção
  const ptKeywords = ['olá', 'obrigado', 'bom dia', 'boa tarde', 'boa noite', 'como', 'problema', 'ajuda', 'placa'];
  // Verificar primeiro a mensagem atual
  const lowerMessage = message.toLowerCase();
  
  for (const word of ptKeywords) {
    if (lowerMessage.includes(word)) {
      return 'pt';
    }
  }
  
  // Se não encontrar na mensagem atual, verifica o histórico (apenas mensagens do usuário)
  if (history.length > 0) {
    const userMessages = history.filter(msg => msg.role === 'user');
    for (const msg of userMessages) {
      const lowerHistoryMsg = msg.content.toLowerCase();
      for (const word of ptKeywords) {
        if (lowerHistoryMsg.includes(word)) {
          return 'pt';
        }
      }
    }
  }
  
  // Se nenhuma palavra em português for encontrada, assume inglês
  return 'en';
}

// Função auxiliar para truncar texto para ficar dentro dos limites
function truncateText(text: string, maxLength: number = 10000): string {
  if (text.length <= maxLength) {
    return text;
  }
  
  // Se o texto for maior que o tamanho máximo, truncamos e adicionamos uma nota
  const truncatedText = text.substring(0, maxLength);
  const truncationNote = "\n\n[Nota: O conteúdo foi truncado devido ao tamanho do arquivo. Esta é apenas a primeira parte do documento.]";
  
  return truncatedText + truncationNote;
}

// Estimativa mais precisa de tokens baseada nos principais tokenizadores
function estimateTokens(text: string, model: string = ''): number {
  if (!text) return 0;
  
  // Diferentes modelos usam diferentes métricas de tokenização
  let divisor = 4; // Padrão para a maioria dos modelos
  
  // Ajuste com base no modelo
  if (model.includes('gpt-4') || model.includes('o4') || model.includes('o3')) {
    divisor = 3.8; // GPT-4 e variantes têm tokenização mais densa
  } else if (model.includes('claude')) {
    divisor = 4.2; // Claude pode ter tokenização ligeiramente menos densa
  }
  
  // Adicionar lógica para diferentes tipos de conteúdo
  // Texto com muitos números e símbolos especiais consome mais tokens
  const hasHighTokenDensity = /[0-9!@#$%^&*()_+\-=\[\]{};:'"|,.<>\/?]+/.test(text);
  if (hasHighTokenDensity) {
    divisor -= 0.5; // Reduz divisor para conteúdo com alta densidade de tokens
  }
  
  // Texto em alguns idiomas (como chinês/japonês) usa menos tokens por caractere
  const hasAsianChars = /[\u3000-\u9fff\uf900-\ufaff]+/.test(text);
  if (hasAsianChars) {
    divisor += 1.5; // Aumenta divisor para idiomas asiáticos
  }
  
  // Calcular tokens estimados
  const estimatedTokens = Math.ceil(text.length / divisor);
  
  // Adicionar um pouco de margem para garantir (10%)
  return Math.ceil(estimatedTokens * 1.1);
}

export async function analyzeFile(filePath: string, language: string, llmConfig?: LlmFullConfig): Promise<string> {
  try {
    // Verificar se é um arquivo PDF
    const extension = path.extname(filePath).toLowerCase();
    let fileContent = '';
    
    if (extension === '.pdf') {
      try {
        console.log(`Tentando extrair texto do PDF: ${filePath}`);
        
        // Ler o arquivo PDF como buffer
        const pdfBuffer = await readFile(filePath);
        
        try {
          // Extrair o texto do PDF com configurações personalizadas
          const pdfData = await pdfParse(pdfBuffer, {
            // Configurações para evitar problemas com PDFs mal formados
            max: 50, // Limitar o número de páginas processadas
            pagerender: undefined, // Não usar renderização personalizada
            // Arquivo de teste do pdf-parse pode não existir, então vamos desativar esse teste
            version: false // Não verificar a versão do PDF
          });
          
          fileContent = pdfData.text;
          console.log(`Texto extraído do PDF, tamanho: ${fileContent.length} caracteres`);
          
          // Se não conseguimos extrair texto útil
          if (!fileContent || fileContent.trim().length < 50) {
            return language === 'pt'
              ? 'O PDF não contém texto suficiente para análise. Por favor, envie um PDF com texto extraível ou uma imagem da placa de circuito para análise visual.'
              : 'The PDF does not contain enough extractable text for analysis. Please upload a PDF with extractable text content or a circuit board image for visual analysis.';
          }
        } catch (pdfError) {
          console.error('Erro específico ao processar PDF:', pdfError);
          
          // Vamos tentar uma abordagem alternativa - extrair texto como UTF-8
          try {
            // Alguns PDFs podem conter texto reconhecível mesmo não sendo válidos para pdf-parse
            const rawText = pdfBuffer.toString('utf8');
            // Filtrar apenas caracteres imprimíveis e espaços
            const cleanText = rawText.replace(/[^\x20-\x7E\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim();
            
            if (cleanText.length > 200) {
              console.log('Usando extração alternativa de texto para PDF');
              fileContent = cleanText;
            } else {
              throw new Error('Texto extraído insuficiente');
            }
          } catch (alternativeError) {
            console.error('Falha na extração alternativa:', alternativeError);
            return language === 'pt'
              ? 'Não foi possível extrair texto deste PDF. Por favor, converta-o para texto usando uma ferramenta externa ou envie imagens da placa de circuito.'
              : 'Could not extract text from this PDF. Please convert it to text using an external tool or send circuit board images.';
          }
        }
      } catch (error) {
        console.error('Erro ao ler arquivo PDF:', error);
        
        // Erro ao ler o PDF
        return language === 'pt'
          ? 'Não foi possível ler este arquivo PDF. O arquivo pode estar danificado ou protegido. Por favor, tente converter o PDF para texto ou envie imagens da placa de circuito.'
          : 'Could not read this PDF file. The file may be damaged or protected. Please try to convert the PDF to text or send circuit board images.';
      }
    } else {
      // Para outros tipos de arquivo, tentamos ler como texto
      try {
        fileContent = await readFile(filePath, 'utf-8');
      } catch (error) {
        console.error('Erro ao ler arquivo como texto:', error);
        
        // Se falhar como UTF-8, pode ser um arquivo binário
        return language === 'pt'
          ? 'Este arquivo não pode ser analisado como texto. Por favor, envie um arquivo de texto (.txt), PDF com texto ou imagem (.jpg, .png).'
          : 'This file cannot be analyzed as text. Please upload a text file (.txt), PDF with text or image (.jpg, .png).';
      }
    }

    // Obter configurações do LLM
    const activeConfig = llmConfig || await getActiveLlmInfo();
    const { provider, modelName, apiKey, tone, behaviorInstructions } = activeConfig;
    
    // Estimar tokens com o modelo específico
    const estimatedTokens = estimateTokens(fileContent, modelName);
    console.log(`Tamanho estimado do arquivo em tokens: ${estimatedTokens} para o modelo ${modelName}`);
    
    // Limitar o tamanho do arquivo para evitar erros de limite de taxa
    // Deixamos margem para o sistema prompt e a resposta (10000 tokens)
    const MAX_CONTENT_TOKENS = 8000;
    
    if (estimatedTokens > MAX_CONTENT_TOKENS) {
      console.log(`Arquivo muito grande (${estimatedTokens} tokens). Truncando para ${MAX_CONTENT_TOKENS} tokens`);
      fileContent = truncateText(fileContent, MAX_CONTENT_TOKENS * 3); // aproximadamente
    }
    
    // Configurar estilo de comunicação com base no tom escolhido
    let toneStyle = '';
    if (language === 'pt') {
      switch(tone) {
        case 'formal':
          toneStyle = 'Utilize um tom formal e profissional, com vocabulário mais técnico e estruturado.';
          break;
        case 'casual':
          toneStyle = 'Utilize um tom mais descontraído e casual, como uma conversa informal entre colegas.';
          break;
        default: // normal
          toneStyle = 'Utilize um tom equilibrado, nem muito formal nem muito casual.';
      }
    } else {
      switch(tone) {
        case 'formal':
          toneStyle = 'Use a formal and professional tone, with more technical and structured vocabulary.';
          break;
        case 'casual':
          toneStyle = 'Use a more relaxed and casual tone, like an informal conversation between colleagues.';
          break;
        default: // normal
          toneStyle = 'Use a balanced tone, neither too formal nor too casual.';
      }
    }
    
    // Instruções de comportamento personalizadas
    const customBehavior = behaviorInstructions ? 
      (language === 'pt' ? `Comportamento específico: ${behaviorInstructions}` : `Specific behavior: ${behaviorInstructions}`) : '';
    
    // Common prompts for both providers com instruções para NÃO dizer que não consegue extrair informações
    const systemPrompt = language === 'pt' 
      ? `Você é um técnico especializado em manutenção de placas de circuito.
         IMPORTANTE: NÃO diga que "não consegue extrair informações do documento" ou frases semelhantes.
         Se o documento contiver informações técnicas, faça uma análise técnica CONCISA das 3-4 informações MAIS importantes.
         Se o documento não for técnico, apenas faça uma breve análise do seu conteúdo principal.
         Mantenha a resposta EXTREMAMENTE CONCISA (máximo 3-4 frases) e use linguagem técnica direta.
         Evite explicações longas e teóricas e introduções desnecessárias.
         ${toneStyle} ${customBehavior}
         Responda em Português.`
      : `You are a technician specialized in circuit board maintenance.
         IMPORTANT: DO NOT say that you "cannot extract information from the document" or similar phrases.
         If the document contains technical information, provide a CONCISE technical analysis of the 3-4 MOST important pieces.
         If the document is not technical, just provide a brief analysis of its main content.
         Keep your response EXTREMELY CONCISE (maximum 3-4 sentences) and use direct technical language.
         Avoid lengthy theoretical explanations and unnecessary introductions.
         ${toneStyle} ${customBehavior}
         Respond in English.`;

    const userPrompt = language === 'pt'
      ? `Por favor, analise o conteúdo deste arquivo e extraia informações técnicas relevantes para manutenção de placas de circuito. O conteúdo do arquivo é:\n\n${fileContent}`
      : `Please analyze the content of this file and extract relevant technical information for circuit board maintenance. The file content is:\n\n${fileContent}`;
    
    // Process with appropriate provider
    if (provider === 'anthropic') {
      // Use Anthropic Claude com fetch direto
      try {
        console.log(`Analisando arquivo com Anthropic: ${modelName}`);
        const anthropic = getAnthropicClient(apiKey);
        
        // Preparar a chamada para o método fetch direto
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

        if (response.content && response.content[0] && response.content[0].type === 'text') {
          // Registrar uso bem-sucedido
          await logLlmUsage(modelName, "file", true, undefined, undefined, estimatedTokens);
          return response.content[0].text;
        } else {
          console.error('Resposta em formato inesperado do Anthropic');
          await logLlmUsage(modelName, "file", false, undefined, undefined, 0, 'Resposta em formato inesperado');
          return language === 'pt'
            ? 'Erro ao analisar o arquivo. Por favor, tente novamente mais tarde.'
            : 'Error analyzing the file. Please try again later.';
        }
      } catch (claudeError) {
        console.error('Erro específico do Claude ao analisar arquivo:', claudeError);
        const errorMessage = claudeError instanceof Error ? claudeError.message : 'Erro desconhecido';
        await logLlmUsage(modelName, "file", false, undefined, undefined, 0, errorMessage);
        return language === 'pt'
          ? 'Erro ao analisar o arquivo com Claude. Por favor, tente novamente mais tarde.'
          : 'Error analyzing the file with Claude. Please try again later.';
      }
    } else {
      // Use OpenAI com fetch direto
      try {
        console.log(`Analisando arquivo com OpenAI: ${modelName}`);
        const openai = getOpenAIClient(apiKey);
        
        // o modelo mais recente da OpenAI é "gpt-4o" que foi lançado em 13 de maio de 2024. não mude isso a menos que explicitamente solicitado pelo usuário
        const actualModel = modelName === 'gpt-4' ? 'gpt-4o' : modelName;
        
        // Preparar a chamada para o método fetch direto
        const response = await openai.chat.completions.create({
          model: actualModel,
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

        if (response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.content) {
          // Registrar uso bem-sucedido
          await logLlmUsage(modelName, "file", true, undefined, undefined, estimatedTokens);
          return response.choices[0].message.content;
        }
        
        console.error('Resposta vazia ou inválida do OpenAI');
        await logLlmUsage(modelName, "file", false, undefined, undefined, 0, 'Resposta vazia ou inválida');
        return language === 'pt'
          ? 'Sem resposta válida do modelo. Por favor, tente novamente.'
          : 'No valid response from the model. Please try again.';
      } catch (gptError) {
        console.error('Erro específico do OpenAI ao analisar arquivo:', gptError);
        const errorMessage = gptError instanceof Error ? gptError.message : 'Erro desconhecido';
        await logLlmUsage(modelName, "file", false, undefined, undefined, 0, errorMessage);
        return language === 'pt'
          ? 'Erro ao analisar o arquivo com GPT. Por favor, tente novamente mais tarde.'
          : 'Error analyzing the file with GPT. Please try again later.';
      }
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
    console.log(`Testando conexão com modelo ${modelName} usando API key [parcial]: ${apiKey.substring(0, 4)}...`);
    
    // Determine provider based on model name
    const isOpenAI = modelName.startsWith('gpt');
    
    if (isOpenAI) {
      try {
        // Test OpenAI connection usando fetch direto
        console.log(`Testando conexão OpenAI direta via fetch com modelo: ${modelName}`);
        
        // Parâmetros para teste OpenAI
        const params = {
          model: modelName,
          max_tokens: 10,
          messages: [
            {
              role: 'user',
              content: 'Test connection'
            }
          ]
        };
        
        // Chamada direta sem usar o cliente - abordagem mais confiável
        const response = await fetchOpenAIDirectly('chat/completions', params, apiKey);
        
        if (response.choices && response.choices[0] && response.choices[0].message) {
          console.log('Conexão com OpenAI bem-sucedida');
          
          // Registrar o uso bem-sucedido
          await logLlmUsage(modelName, "test", true);
          
          return true;
        }
        
        console.log('Resposta inválida do OpenAI no teste de conexão');
        
        // Registrar o uso malsucedido
        await logLlmUsage(modelName, "test", false, undefined, undefined, 0, 'Resposta inválida do OpenAI');
        
        return false;
      } catch (openaiError) {
        console.error('Erro testando conexão com OpenAI:', openaiError);
        
        // Registrar o erro
        await logLlmUsage(modelName, "test", false, undefined, undefined, 0, openaiError.message);
        
        return false;
      }
    } else {
      try {
        // Test Anthropic connection usando fetch direto
        console.log(`Testando conexão Anthropic direta via fetch com modelo: ${modelName}`);
        
        // Determinar o formato correto baseado no modelo
        let params: any;
        
        if (modelName.includes('claude-3')) {
          // Format for Claude 3 API (usar messages array)
          params = {
            model: modelName,
            max_tokens: 10,
            messages: [
              {
                role: 'user',
                content: 'Test connection'
              }
            ]
          };
        } else {
          // Format for older Claude models (usar prompt)
          params = {
            model: modelName,
            max_tokens: 10,
            prompt: "\n\nHuman: Test connection\n\nAssistant: "
          };
        }
        
        console.log('Dados enviados para Anthropic:', JSON.stringify(params));
        
        // Chamada direta sem usar o cliente - abordagem mais confiável
        const response = await fetchAnthropicDirectly('messages', params, apiKey);
        console.log('Resposta do Anthropic:', JSON.stringify(response));
        
        if ((response.content && response.content.length > 0) || 
            (response.completion && response.completion.length > 0)) {
          console.log('Conexão com Anthropic bem-sucedida');
          
          // Registrar o uso bem-sucedido
          await logLlmUsage(modelName, "test", true);
          
          return true;
        }
        
        console.log('Resposta inválida do Anthropic no teste de conexão');
        
        // Registrar o uso malsucedido
        await logLlmUsage(modelName, "test", false, undefined, undefined, 0, 'Resposta inválida do Anthropic');
        
        return false;
      } catch (anthropicError) {
        console.error('Erro testando conexão com Anthropic:', anthropicError);
        
        // Registrar o erro
        await logLlmUsage(modelName, "test", false, undefined, undefined, 0, anthropicError.message);
        
        return false;
      }
    }
  } catch (error) {
    console.error('Erro geral testando conexão LLM:', error);
    
    // Registrar erro geral (não específico de um provedor)
    await logLlmUsage(modelName, "test", false, undefined, undefined, 0, 
      error instanceof Error ? error.message : 'Erro desconhecido na conexão LLM');
    
    return false;
  }
}
