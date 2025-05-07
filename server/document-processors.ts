import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

// Funções auxiliares para extração de texto de diferentes tipos de arquivos
export async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    console.log(`Iniciando processamento de PDF: ${filePath}`);
    
    // Verificar existência e tamanho do arquivo
    if (!fs.existsSync(filePath)) {
      console.error(`Arquivo PDF não encontrado: ${filePath}`);
      return "Arquivo não encontrado";
    }
    
    const fileStats = fs.statSync(filePath);
    const fileSizeMB = fileStats.size / (1024 * 1024);
    console.log(`Arquivo PDF encontrado: ${filePath}, tamanho: ${fileSizeMB.toFixed(2)} MB`);
    
    // Estratégia diferente para PDFs muito grandes
    const isVeryLargePDF = fileSizeMB > 50; // Acima de 50MB é considerado muito grande
    const isLargePDF = fileSizeMB > 20;     // Acima de 20MB é considerado grande
    
    if (isVeryLargePDF) {
      console.log(`PDF muito grande detectado (${fileSizeMB.toFixed(2)} MB). Usando processamento em partes.`);
      // Para PDFs extremamente grandes, podemos tentar:
      // 1. Extrair apenas um resumo ou primeiras páginas
      // 2. Dividir o processamento em partes menores
      
      try {
        // Tentar apenas as primeiras páginas para PDFs extremamente grandes
        console.log("Tentando extrair apenas o início do documento muito grande...");
        
        // Carregar parte do arquivo (primeiros MB) para ler cabeçalho e primeiras páginas
        const maxInitialRead = 10 * 1024 * 1024; // 10MB iniciais para extremamente grandes
        const fd = fs.openSync(filePath, 'r');
        const bufferStart = Buffer.alloc(maxInitialRead);
        
        fs.readSync(fd, bufferStart, 0, maxInitialRead, 0);
        fs.closeSync(fd);
        
        console.log(`Lido início do PDF (${maxInitialRead / (1024 * 1024)} MB) para tentar extrair texto parcial.`);
        
        // Tentar extrair texto dessa parte inicial
        const partialOptions = {
          max: 30,  // limitar a 30 páginas
          version: 'v1.10.100'
        };
        
        try {
          const partialData = await pdfParse(bufferStart, partialOptions);
          
          if (partialData && partialData.text && partialData.text.length > 0) {
            let partialText = partialData.text
              .replace(/\f/g, '\n')
              .replace(/\r\n/g, '\n')
              .replace(/\n{3,}/g, '\n\n')
              .trim();
              
            console.log(`Extração parcial bem-sucedida: ${partialText.length} caracteres obtidos.`);
            
            // Aviso sobre extração parcial
            return `[AVISO: Este PDF é muito grande (${fileSizeMB.toFixed(2)} MB). O texto extraído representa apenas as primeiras páginas.]\n\n${partialText}`;
          }
        } catch (partialError) {
          console.error("Falha na extração parcial:", partialError);
          // Se falhar a estratégia parcial, continuamos com a estratégia padrão
        }
      } catch (chunkedError) {
        console.error("Erro na extração parcial:", chunkedError);
        // Continuamos com o método padrão se a estratégia parcial falhar
      }
    }
    
    // Método padrão melhorado, com tratamento especial para PDFs grandes
    // Carregar o arquivo como buffer
    let dataBuffer;
    try {
      console.log(`Iniciando carregamento do arquivo PDF: ${filePath}`);
      dataBuffer = fs.readFileSync(filePath);
      console.log(`PDF carregado em buffer: ${dataBuffer.length} bytes`);
    } catch (readError) {
      console.error("Erro ao ler arquivo PDF:", readError instanceof Error ? readError.message : 'Erro desconhecido');
      return "Erro ao ler o arquivo PDF";
    }
    
    // Configurações otimizadas com base no tamanho do PDF
    const options = {
      max: 0,                 // sem limite de páginas por padrão
      pagerender: undefined,  // renderização padrão
      version: 'v1.10.100',   // versão específica para estabilidade
      // Para PDFs grandes, limitar o uso de recursos se necessário
      ...(isLargePDF ? { max: 400 } : {}) // Limitar a 400 páginas para PDFs grandes
    };
    
    // Extrair o texto
    let data;
    try {
      console.log("Iniciando extração de texto do PDF...");
      // Aumentar timeout para arquivos grandes
      const timeoutMs = isLargePDF ? 120000 : 60000; // 2 minutos para PDFs grandes, 1 minuto para normais
      
      // Executar com timeout para evitar bloqueio indefinido
      const extractionPromise = pdfParse(dataBuffer, options);
      
      // Criar promise com timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout de ${timeoutMs/1000} segundos excedido ao processar PDF.`)), timeoutMs);
      });
      
      // Corrida entre extração e timeout
      data = await Promise.race([extractionPromise, timeoutPromise]) as any;
      console.log(`Texto extraído do PDF: ${data.text?.length || 0} caracteres em ${data.numpages || 0} páginas`);
    } catch (parseError) {
      console.error("Erro ao fazer parse do PDF:", parseError instanceof Error ? parseError.message : 'Erro desconhecido');
      
      // Mensagens de erro mais específicas
      if (parseError instanceof Error) {
        if (parseError.message.includes("timeout")) {
          return `Tempo limite excedido ao processar o PDF. O arquivo de ${fileSizeMB.toFixed(2)} MB é muito complexo. Tente dividir o PDF em arquivos menores ou simplificar o documento.`;
        } else if (parseError.message.includes("memory")) {
          return `Memória insuficiente para processar o PDF de ${fileSizeMB.toFixed(2)} MB. Tente dividir o arquivo em partes menores.`;
        }
      }
      
      return "Erro ao analisar o conteúdo do PDF. O arquivo pode estar corrompido ou protegido.";
    }
    
    // Melhorar a qualidade do texto extraído
    if (!data || !data.text) {
      console.error("PDF sem texto extraível");
      return "O PDF não contém texto extraível ou está vazio.";
    }
    
    let text = data.text;
    
    // Remover quebras de página e normalizar espaçamento
    text = text.replace(/\f/g, '\n')
               .replace(/\r\n/g, '\n')
               .replace(/\n{3,}/g, '\n\n')
               .trim();
               
    console.log(`PDF processado com sucesso: ${text.length} caracteres extraídos em ${data.numpages} páginas`);
    
    // Sinal claro de sucesso quando temos texto suficiente extraído
    if (text.length > 100) {
      console.log("Extração de PDF bem-sucedida com conteúdo significativo.");
      
      // Adicionar metadata para PDFs grandes
      if (isLargePDF) {
        text = `[PDF de ${fileSizeMB.toFixed(2)} MB com ${data.numpages} páginas]\n\n${text}`;
      }
    } else if (text.length > 0) {
      console.log("Aviso: PDF extraído com pouco conteúdo.");
    } else {
      console.error("PDF não contém texto extraível");
      return "O PDF não contém texto extraível.";
    }
    
    return text;
  } catch (error) {
    console.error("Erro não tratado ao extrair texto do PDF:", error instanceof Error ? error.message : 'Erro desconhecido', error);
    
    if (error instanceof Error) {
      if (error.message.includes("memory")) {
        return "Falha ao processar: o PDF é muito grande ou complexo. Por favor, tente dividi-lo em arquivos menores.";
      } else if (error.message.includes("timeout")) {
        return "Tempo limite excedido ao processar o PDF. O arquivo pode ser muito complexo.";
      } else if (error.stack?.includes("RangeError")) {
        return "Erro ao processar o PDF: o documento excede os limites de processamento. Tente dividir o arquivo em partes menores.";
      }
    }
    
    return "Falha na extração do PDF. Por favor, verifique se o arquivo é válido e não está protegido.";
  }
}

export async function extractTextFromTXT(filePath: string): Promise<string> {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Remover caracteres não imprimíveis e normalizar quebras de linha
    const cleanedContent = content.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '')
                                 .replace(/\r\n/g, '\n')
                                 .replace(/\n{3,}/g, '\n\n')
                                 .trim();
                                 
    console.log(`TXT processado com sucesso: ${cleanedContent.length} caracteres extraídos`);
    return cleanedContent;
  } catch (error) {
    console.error("Erro ao extrair texto do arquivo TXT:", error);
    return "";
  }
}

export async function extractTextFromDOCX(filePath: string): Promise<string> {
  try {
    console.log(`Iniciando processamento DOCX: ${filePath}`);
    
    // Verificar existência e tamanho do arquivo
    try {
      const fileExists = fs.existsSync(filePath);
      if (!fileExists) {
        console.error(`Arquivo DOCX não encontrado: ${filePath}`);
        return "Arquivo não encontrado";
      }
      
      const fileStats = fs.statSync(filePath);
      const fileSizeMB = fileStats.size / (1024 * 1024);
      console.log(`Arquivo DOCX encontrado: ${filePath}, tamanho: ${fileSizeMB.toFixed(2)} MB`);
      
      // Verificar se estamos lidando com um arquivo grande
      const isLargeDOCX = fileSizeMB > 20;
      const isVeryLargeDOCX = fileSizeMB > 40;
      
      if (isVeryLargeDOCX) {
        console.log(`DOCX extremamente grande detectado (${fileSizeMB.toFixed(2)} MB). Usando modo de processamento especial.`);
        return `[AVISO: Este documento DOCX é extremamente grande (${fileSizeMB.toFixed(2)} MB) e pode não ser processado completamente. Recomendamos dividir o arquivo em partes menores para melhor processamento.]`;
      }
      
      if (isLargeDOCX) {
        console.log(`DOCX grande detectado (${fileSizeMB.toFixed(2)} MB). Usando modo de economia de memória.`);
      }
      
    } catch (checkError) {
      console.error(`Erro ao verificar existência do arquivo DOCX: ${checkError instanceof Error ? checkError.message : 'Erro desconhecido'}`);
      return "Erro ao verificar arquivo";
    }
    
    // Configuração simplificada sem convertImage e outras opções que podem causar problemas
    const options = {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "r[style-name='Strong'] => strong",
        "table => table",
        "tr => tr",
        "td => td"
      ],
      transformDocument: (document: any) => {
        return document;  // Não transformar, para evitar problemas de memória
      }
    };
    
    // Utilizamos Promise com timeout para evitar processamentos muito longos
    const timeoutMs = 180000; // 3 minutos
    const extractionTimeout = new Promise<{ value: string, messages: any[] }>((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout de ${timeoutMs/1000} segundos excedido ao processar DOCX.`)), timeoutMs);
    });
    
    console.log(`Tentando extrair texto do arquivo DOCX: ${filePath} (timeout: ${timeoutMs/1000}s)`);
    
    // Tentar extrair texto bruto diretamente, mais eficiente para arquivos grandes
    let textResult;
    try {
      const extractRawPromise = mammoth.extractRawText({
        path: filePath
      });
      
      // Corrida entre extração e timeout
      textResult = await Promise.race([extractRawPromise, extractionTimeout]);
      console.log(`Texto bruto extraído com sucesso, tamanho: ${textResult.value.length} caracteres`);
      
      // Se conseguimos extrair texto bruto com sucesso, já temos o necessário
      if (textResult.value && textResult.value.length > 0) {
        // Normalizar quebras de linha e espaços no texto bruto
        const cleanedRawText = textResult.value
          .replace(/\r\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .replace(/\s{2,}/g, ' ')
          .trim();
          
        const fileStats = fs.statSync(filePath);
        const fileSizeMB = fileStats.size / (1024 * 1024);
          
        // Adicionar informações de contexto sobre o arquivo
        const processedText = `[Documento DOCX de ${fileSizeMB.toFixed(2)} MB processado com sucesso]\n\n${cleanedRawText}`;
        
        console.log(`DOCX processado com método de texto bruto: ${processedText.length} caracteres extraídos`);
        
        if (textResult.messages && textResult.messages.length > 0) {
          const issueMessages = textResult.messages
            .filter(msg => msg.type === 'warning' || msg.type === 'error')
            .map(msg => msg.message);
            
          if (issueMessages.length > 0) {
            console.log("Avisos durante extração DOCX:", issueMessages);
          }
        }
        
        // Retornar o texto processado sem tentar extração HTML, que é mais intensiva
        return processedText;
      }
    } catch (textError) {
      console.error(`Erro ao extrair texto bruto do DOCX: ${textError instanceof Error ? textError.message : 'Erro desconhecido'}`);
      
      if (textError instanceof Error) {
        if (textError.message.includes("timeout")) {
          const fileStats = fs.statSync(filePath);
          const fileSizeMB = fileStats.size / (1024 * 1024);
          return `Tempo limite excedido ao processar documento DOCX de ${fileSizeMB.toFixed(2)} MB. O arquivo pode ser muito complexo ou grande demais. Tente dividi-lo em partes menores.`;
        } else if (textError.message.includes("memory")) {
          return "Memória insuficiente para processar o documento DOCX. Tente dividi-lo em partes menores.";
        }
      }
      
      // Se não tivemos sucesso com texto bruto, tentamos HTML como fallback apenas para documentos não muito grandes
      const fileStats = fs.statSync(filePath);
      const fileSizeMB = fileStats.size / (1024 * 1024);
      
      if (fileSizeMB > 20) {
        return `Não foi possível extrair o texto deste documento DOCX grande (${fileSizeMB.toFixed(2)} MB). Considere convertê-lo para formato PDF ou dividi-lo em arquivos menores.`;
      }
    }
    
    // Se chegamos aqui, a extração de texto bruto falhou ou foi insuficiente, e o arquivo não é grande demais
    // Tentamos a abordagem HTML como fallback para arquivos menores
    console.log(`Tentando extrair HTML do arquivo DOCX como método alternativo: ${filePath}`);
    
    let htmlResult;
    try {
      // Novo timeout para extração HTML
      const htmlTimeout = new Promise<{ value: string, messages: any[] }>((_, reject) => {
        setTimeout(() => reject(new Error("Timeout excedido ao extrair HTML do DOCX.")), timeoutMs);
      });
      
      const htmlExtractionPromise = mammoth.convertToHtml({
        path: filePath
      }, options);
      
      htmlResult = await Promise.race([htmlExtractionPromise, htmlTimeout]);
      console.log(`HTML extraído com sucesso, tamanho: ${htmlResult.value.length} caracteres`);
      
      // Converter o HTML para texto mantendo alguma estrutura
      const htmlToText = htmlResult.value
        .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n## $1 ##\n')
        .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n### $1 ###\n')
        .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n#### $1 ####\n')
        .replace(/<li[^>]*>(.*?)<\/li>/gi, '\n• $1')
        .replace(/<tr[^>]*>(.*?)<\/tr>/gi, '\n$1\n')
        .replace(/<td[^>]*>(.*?)<\/td>/gi, ' | $1')
        .replace(/<p[^>]*>(.*?)<\/p>/gi, '\n$1\n')
        .replace(/<br[^>]*>/gi, '\n')
        .replace(/<(?:.|\s)*?>/g, '') // Remove todas as demais tags
        .replace(/\n{3,}/g, '\n\n')
        .replace(/\s{2,}/g, ' ')
        .trim();
      
      console.log(`DOCX processado via HTML: ${htmlToText.length} caracteres extraídos`);
      
      const fileStats = fs.statSync(filePath);
      const fileSizeMB = fileStats.size / (1024 * 1024);
        
      // Adicionar informações de contexto sobre o arquivo
      return `[Documento DOCX de ${fileSizeMB.toFixed(2)} MB processado com método alternativo]\n\n${htmlToText}`;
      
    } catch (htmlError) {
      console.error(`Erro ao extrair HTML do DOCX: ${htmlError instanceof Error ? htmlError.message : 'Erro desconhecido'}`);
      
      // Mensagens de erro específicas
      if (htmlError instanceof Error) {
        if (htmlError.message.includes("timeout")) {
          const fileStats = fs.statSync(filePath);
          const fileSizeMB = fileStats.size / (1024 * 1024);
          return `Tempo limite excedido ao processar documento DOCX de ${fileSizeMB.toFixed(2)} MB. O arquivo pode ser muito complexo.`;
        }
      }
      
      return "Erro ao processar conteúdo do documento DOCX. O arquivo pode estar corrompido ou em formato incompatível.";
    }
  } catch (error) {
    console.error("Erro não tratado ao extrair texto do DOCX:", error instanceof Error ? error.message : 'Erro desconhecido', error);
    
    // Tratamento específico para erros comuns
    if (error instanceof Error) {
      if (error.message.includes("memory")) {
        return "Falha no processamento: memória insuficiente para processar o documento DOCX. Tente dividi-lo em partes menores.";
      } else if (error.message.includes("timeout") || error.message.includes("timed out")) {
        return "Tempo limite excedido ao processar o documento DOCX. O arquivo pode ser muito complexo.";
      } else if (error.stack?.includes("RangeError")) {
        return "Erro ao processar o DOCX: o documento excede os limites de processamento. Tente dividi-lo em partes menores.";
      }
    }
    
    return "Falha no processamento do documento DOCX. Por favor, verifique o formato do arquivo.";
  }
}

export async function extractTextFromWebsite(url: string): Promise<string> {
  try {
    // Verificar se é uma URL válida
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    console.log(`Tentando extrair conteúdo da URL: ${url}`);
    
    // Fazer requisição HTTP para obter o conteúdo
    const response = await fetch(url);
    const html = await response.text();
    
    // Extrair o conteúdo textual, removendo tags HTML
    // Abordagem simples, em produção seria ideal usar um parser HTML apropriado
    const textContent = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
      
    console.log(`Website processado com sucesso: ${textContent.length} caracteres extraídos`);
    return textContent;
  } catch (error) {
    console.error(`Erro ao extrair texto do site ${url}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return `Não foi possível extrair o conteúdo do website: ${errorMessage}`;
  }
}

// Função unificada para processar qualquer tipo de documento
export async function processDocumentContent(
  documentType: string,
  filePath?: string,
  websiteUrl?: string,
  textContent?: string
): Promise<string> {
  try {
    console.log(`Iniciando processamento de documento do tipo: ${documentType}`);
    
    // Adicionar verificação mais detalhada dos parâmetros
    if (!documentType) {
      console.error("Erro: documentType não fornecido");
      throw new Error("Tipo de documento não especificado");
    }
    
    // Processar com base no tipo de documento
    if (documentType === "text") {
      if (!textContent) {
        console.error("Erro: conteúdo de texto não fornecido para tipo 'text'");
        return "[Conteúdo de texto não fornecido]";
      }
      console.log(`Processando conteúdo de texto: ${textContent.length} caracteres`);
      return textContent.trim();
    } 
    else if (documentType === "file") {
      if (!filePath) {
        console.error("Erro: caminho do arquivo não fornecido para tipo 'file'");
        return "[Caminho do arquivo não fornecido]";
      }
      
      // Verificar existência do arquivo
      if (!fs.existsSync(filePath)) {
        console.error(`Erro: arquivo não encontrado: ${filePath}`);
        return `[Arquivo não encontrado: ${path.basename(filePath)}]`;
      }
      
      const fileStats = fs.statSync(filePath);
      const fileSizeMB = fileStats.size / (1024 * 1024);
      console.log(`Arquivo encontrado: ${filePath}, tamanho: ${fileSizeMB.toFixed(2)} MB`);
      
      // Verificar o tipo de arquivo baseado na extensão
      const extension = path.extname(filePath).toLowerCase();
      
      // Limitar tamanhos de arquivo por tipo para segurança
      const maxSizes: Record<string, number> = {
        ".pdf": 100,   // 100 MB
        ".txt": 20,    // 20 MB
        ".docx": 50,   // 50 MB
        ".doc": 50     // 50 MB
      };
      
      const maxSizeForType = maxSizes[extension] || 5; // padrão 5 MB para tipos desconhecidos
      
      if (fileSizeMB > maxSizeForType) {
        console.error(`Arquivo muito grande (${fileSizeMB.toFixed(2)} MB). Limite é ${maxSizeForType} MB para ${extension}`);
        return `[Arquivo muito grande (${fileSizeMB.toFixed(2)} MB). Por favor, divida o documento em partes menores.]`;
      }
      
      // Processar conteúdo do arquivo baseado no tipo
      console.log(`Processando arquivo ${extension}: ${filePath}`);
      
      if (extension === ".pdf") {
        return await extractTextFromPDF(filePath);
      } 
      else if (extension === ".txt") {
        return await extractTextFromTXT(filePath);
      } 
      else if (extension === ".docx" || extension === ".doc") {
        return await extractTextFromDOCX(filePath);
      } 
      else {
        console.warn(`Tipo de arquivo não processável: ${extension}`);
        return `[Conteúdo não processável para arquivo do tipo ${extension}]`;
      }
    } 
    else if (documentType === "website") {
      if (!websiteUrl) {
        console.error("Erro: URL do website não fornecida para tipo 'website'");
        return "[URL do website não fornecida]";
      }
      console.log(`Processando website: ${websiteUrl}`);
      return await extractTextFromWebsite(websiteUrl);
    } 
    else if (documentType === "video") {
      console.warn("Processamento de vídeo não implementado");
      return "[Processamento de vídeo não implementado]";
    }
    else {
      console.error(`Tipo de documento não suportado: ${documentType}`);
      return `[Tipo de documento não suportado: ${documentType}]`;
    }
  } catch (error) {
    console.error("Erro ao processar conteúdo do documento:", error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    // Melhores mensagens de erro para o usuário
    if (errorMessage.includes("memory")) {
      return "[Erro: Memória insuficiente para processar este documento. Por favor, divida-o em partes menores.]";
    } else if (errorMessage.includes("timeout")) {
      return "[Erro: Tempo limite excedido ao processar o documento. O arquivo pode ser muito complexo.]";
    } else {
      return `[Erro ao processar conteúdo: ${errorMessage}]`;
    }
  }
}