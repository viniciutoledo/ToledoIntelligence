import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

// Funções auxiliares para extração de texto de diferentes tipos de arquivos
export async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    // Usar o pdfParse importado no topo do arquivo
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    
    // Melhorar a qualidade do texto extraído
    let text = data.text || "";
    
    // Remover quebras de página e normalizar espaçamento
    text = text.replace(/\f/g, '\n')
               .replace(/\r\n/g, '\n')
               .replace(/\n{3,}/g, '\n\n')
               .trim();
               
    console.log(`PDF processado com sucesso: ${text.length} caracteres extraídos`);
    return text;
  } catch (error) {
    console.error("Erro ao extrair texto do PDF:", error);
    return "";
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
    // Processar com base no tipo de documento
    if (documentType === "text" && textContent) {
      return textContent.trim();
    } 
    else if (documentType === "file" && filePath) {
      // Verificar o tipo de arquivo baseado na extensão
      const extension = path.extname(filePath).toLowerCase();
      
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
    else if (documentType === "website" && websiteUrl) {
      return await extractTextFromWebsite(websiteUrl);
    } 
    else {
      return "[Conteúdo indisponível ou tipo de documento não suportado]";
    }
  } catch (error) {
    console.error("Erro ao processar conteúdo do documento:", error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return `[Erro ao processar conteúdo: ${errorMessage}]`;
  }
}