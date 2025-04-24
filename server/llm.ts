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

// Get active LLM provider and model name with all configuration options
async function getActiveLlmInfo(): Promise<LlmFullConfig> {
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
    // If we have a config, use it
    apiKey = activeConfig.api_key;
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
  
  return { 
    provider, 
    modelName, 
    apiKey, 
    tone, 
    behaviorInstructions, 
    shouldUseTrained 
  };
}

// Create OpenAI client
function getOpenAIClient(apiKey: string) {
  return new OpenAI({ apiKey });
}

// Create Anthropic client
function getAnthropicClient(apiKey: string) {
  return new Anthropic({ apiKey });
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
        // Use Anthropic Claude
        try {
          const anthropic = getAnthropicClient(apiKey);
          
          // Claude apenas suporta formatos específicos de imagem
          const supportedFormats = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
          
          // Para Claude, sempre usar image/jpeg como é mais universalmente compatível
          console.log(`Usando formato image/jpeg para o Claude independente do formato original`);
          
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
                      media_type: "image/jpeg" as "image/jpeg", // Sempre usando JPEG para Claude
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
  history: Array<{ content: string, role: 'user' | 'assistant' }> = [],
  llmConfig?: LlmFullConfig
): Promise<string> {
  try {
    // Se não recebemos configuração LLM, tentar obter configurações padrão
    const config = llmConfig || await getActiveLlmInfo();
    const { provider, modelName, apiKey, tone, behaviorInstructions, shouldUseTrained } = config;
    
    // Detectar idioma a partir do histórico ou mensagem atual
    const language = detectLanguage(message, history);
    
    // Truncar mensagem para evitar exceder limites de token
    const truncatedMessage = truncateText(message);
    
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
    
    // Prompts para os diferentes provedores
    const systemPrompt = language === 'pt' 
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
        return response.content[0].text;
      } else {
        return 'Erro no formato da resposta do modelo.';
      }
    } else {
      // Use OpenAI
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
      
      const response = await openai.chat.completions.create({
        model: actualModel,
        max_tokens: 1024,
        messages
      });

      return response.choices[0].message.content || 'Sem resposta do modelo.';
    }
  } catch (error) {
    console.error('Erro ao processar mensagem de texto:', error);
    // Tenta detectar o idioma da mensagem original para fornecer resposta de erro adequada
    const language = detectLanguage(message, history);
    return language === 'pt'
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

// Estimativa aproximada de tokens baseada em caracteres (2-4 caracteres = ~1 token)
function estimateTokens(text: string): number {
  // Estimativa conservadora: 1 token a cada 3 caracteres
  return Math.ceil(text.length / 3);
}

export async function analyzeFile(filePath: string, language: string): Promise<string> {
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

    // Verificar o tamanho do arquivo (em tokens)
    const estimatedTokens = estimateTokens(fileContent);
    console.log(`Tamanho estimado do arquivo em tokens: ${estimatedTokens}`);
    
    // Limitar o tamanho do arquivo para evitar erros de limite de taxa
    // Deixamos margem para o sistema prompt e a resposta (10000 tokens)
    const MAX_CONTENT_TOKENS = 8000;
    
    if (estimatedTokens > MAX_CONTENT_TOKENS) {
      console.log(`Arquivo muito grande (${estimatedTokens} tokens). Truncando para ${MAX_CONTENT_TOKENS} tokens`);
      fileContent = truncateText(fileContent, MAX_CONTENT_TOKENS * 3); // aproximadamente
    }
    
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
