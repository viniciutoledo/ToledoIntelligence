/**
 * Utilitário para testes de processamento de documentos
 * Essas funções simulam o comportamento real sem fazer chamadas para APIs externas
 */
import path from 'path';
import fs from 'fs';

/**
 * Função auxiliar para verificar se a descrição está sendo passada corretamente
 * para o processamento de imagens
 * 
 * @param filePath Caminho para o arquivo de imagem
 * @param description Descrição opcional da imagem
 * @returns Detalhes sobre como a imagem seria processada
 */
export function verifyImageProcessingSetup(filePath: string, description?: string): any {
  // Verificar existência do arquivo
  if (!fs.existsSync(filePath)) {
    return {
      status: 'error',
      message: `Arquivo não encontrado: ${filePath}`,
    };
  }

  // Verificar tipo de arquivo
  const extension = path.extname(filePath).toLowerCase();
  const supportedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  
  if (!supportedExtensions.includes(extension)) {
    return {
      status: 'error',
      message: `Formato de arquivo não suportado: ${extension}. Formatos suportados: ${supportedExtensions.join(', ')}`,
    };
  }

  // Verificar tamanho do arquivo
  const stats = fs.statSync(filePath);
  const fileSizeMB = stats.size / (1024 * 1024);
  const MAX_SIZE_MB = 20;
  
  if (fileSizeMB > MAX_SIZE_MB) {
    return {
      status: 'error',
      message: `Arquivo muito grande: ${fileSizeMB.toFixed(2)} MB. Tamanho máximo: ${MAX_SIZE_MB} MB`,
    };
  }

  // Verificar descrição
  const hasDescription = !!description;
  const descriptionLength = description ? description.length : 0;

  // Simular escolha do modelo
  const useOpenAI = process.env.OPENAI_API_KEY ? true : false;
  const useClaude = process.env.ANTHROPIC_API_KEY ? true : false;

  // Determinar qual prompt seria usado (simulação)
  let gpt4oPrompt = "";
  let claude3Prompt = "";

  if (hasDescription) {
    gpt4oPrompt = `Analise esta imagem de placa de circuito em detalhes para fins de manutenção. Descrição fornecida pelo usuário: "${description}"`;
    claude3Prompt = `Analise esta imagem de placa de circuito em detalhes para fins de manutenção. Descrição fornecida pelo usuário: "${description}"`;
  } else {
    gpt4oPrompt = "Analise esta imagem de placa de circuito em detalhes para fins de manutenção:";
    claude3Prompt = "Analise esta imagem de placa de circuito em detalhes para fins de manutenção:";
  }

  // Retornar detalhes de como a imagem seria processada
  return {
    status: 'success',
    filePath,
    fileDetails: {
      name: path.basename(filePath),
      extension,
      size: `${fileSizeMB.toFixed(2)} MB`,
      fullPath: path.resolve(filePath),
    },
    description: {
      provided: hasDescription,
      text: description,
      length: descriptionLength,
    },
    processing: {
      openai: {
        available: useOpenAI,
        model: 'gpt-4o',
        promptUsed: gpt4oPrompt,
      },
      claude: {
        available: useClaude,
        model: 'claude-3-7-sonnet-20250219',
        promptUsed: claude3Prompt,
      },
    },
  };
}