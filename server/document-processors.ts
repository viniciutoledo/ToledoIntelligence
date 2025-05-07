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
    
    // Para PDFs muito grandes, considerar um processamento em partes
    if (fileSizeMB > 10) {
      console.log(`PDF grande detectado (${fileSizeMB.toFixed(2)} MB). Usando processamento otimizado.`);
    }
    
    // Carregar o arquivo como buffer
    let dataBuffer;
    try {
      dataBuffer = fs.readFileSync(filePath);
      console.log(`PDF carregado em buffer: ${dataBuffer.length} bytes`);
    } catch (readError) {
      console.error("Erro ao ler arquivo PDF:", readError instanceof Error ? readError.message : 'Erro desconhecido');
      return "Erro ao ler o arquivo PDF";
    }
    
    // Configurações de timeout e limites mais generosos para PDFs grandes
    const options = {
      max: 0,  // sem limite de páginas
      pagerender: undefined, // renderização padrão
      version: 'v1.10.100' // versão específica para estabilidade
    };
    
    // Extrair o texto
    let data;
    try {
      console.log("Iniciando extração de texto do PDF...");
      data = await pdfParse(dataBuffer, options);
      console.log(`Texto extraído do PDF: ${data.text?.length || 0} caracteres em ${data.numpages || 0} páginas`);
    } catch (parseError) {
      console.error("Erro ao fazer parse do PDF:", parseError instanceof Error ? parseError.message : 'Erro desconhecido');
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
    } else if (text.length > 0) {
      console.log("Aviso: PDF extraído com pouco conteúdo.");
    } else {
      console.error("PDF não contém texto extraível");
      return "O PDF não contém texto extraível.";
    }
    
    return text;
  } catch (error) {
    console.error("Erro não tratado ao extrair texto do PDF:", error instanceof Error ? error.message : 'Erro desconhecido');
    
    if (error instanceof Error && error.message.includes("memory")) {
      return "Falha ao processar: o PDF é muito grande ou complexo. Por favor, tente dividi-lo em arquivos menores.";
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
    
    // Verificar existência do arquivo
    try {
      const fileExists = fs.existsSync(filePath);
      if (!fileExists) {
        console.error(`Arquivo DOCX não encontrado: ${filePath}`);
        return "Arquivo não encontrado";
      }
      
      console.log(`Arquivo DOCX encontrado: ${filePath}, tamanho: ${fs.statSync(filePath).size} bytes`);
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
      ]
    };
    
    console.log(`Tentando extrair HTML do arquivo DOCX: ${filePath}`);
    
    // Primeiro extraímos o HTML para melhor preservação da estrutura
    let htmlResult;
    try {
      htmlResult = await mammoth.convertToHtml({
        path: filePath
      }, options);
      console.log(`HTML extraído com sucesso, tamanho: ${htmlResult.value.length} caracteres`);
    } catch (htmlError) {
      console.error(`Erro ao extrair HTML do DOCX: ${htmlError instanceof Error ? htmlError.message : 'Erro desconhecido'}`);
      return "Erro ao processar HTML do documento";
    }
    
    console.log(`Tentando extrair texto bruto do arquivo DOCX: ${filePath}`);
    
    // Extrair também o texto simples
    let textResult;
    try {
      textResult = await mammoth.extractRawText({
        path: filePath
      });
      console.log(`Texto bruto extraído com sucesso, tamanho: ${textResult.value.length} caracteres`);
    } catch (textError) {
      console.error(`Erro ao extrair texto bruto do DOCX: ${textError instanceof Error ? textError.message : 'Erro desconhecido'}`);
      // Se conseguimos extrair HTML, podemos continuar mesmo sem o texto bruto
      if (htmlResult && htmlResult.value) {
        textResult = { value: "", messages: [] };
      } else {
        return "Erro ao processar texto do documento";
      }
    }
    
    let htmlText = htmlResult.value || "";
    let rawText = textResult.value || "";
    
    // Para extrair valores técnicos mais precisamente
    // Vamos processar tanto o HTML quanto o texto bruto para melhorar a precisão
    
    // Normalizar quebras de linha e espaços no texto bruto
    const cleanedRawText = rawText.replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s{2,}/g, ' ')
      .trim();
    
    // Converter o HTML para texto mantendo alguma estrutura
    // Remove as tags, mas adiciona marcadores para preservar a estrutura
    const htmlToText = htmlText
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
      
    // Preservar especialmente valores numéricos e técnicos
    // Reconhecer padrões como tensões (ex: VS1 ~2.05V, VPA ~2.0V)
    const cleanedFinalText = `${htmlToText}\n\n${cleanedRawText}`;
    
    // Remover duplicações potenciais - convertendo para array simples para evitar problemas de compatibilidade
    const uniqueLines: string[] = [];
    const lines = cleanedFinalText.split('\n');
    lines.forEach(line => {
      if (!uniqueLines.includes(line)) {
        uniqueLines.push(line);
      }
    });
    
    const processedText = uniqueLines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    
    console.log(`DOCX processado com método aprimorado: ${processedText.length} caracteres extraídos`);
    
    if (textResult.messages && textResult.messages.length > 0) {
      console.log("Mensagens de extração DOCX:", textResult.messages);
    }
    
    return processedText;
  } catch (error) {
    console.error("Erro ao extrair texto do DOCX:", error instanceof Error ? error.message : 'Erro desconhecido');
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
        ".pdf": 20,    // 20 MB
        ".txt": 5,     // 5 MB
        ".docx": 10,   // 10 MB
        ".doc": 10     // 10 MB
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