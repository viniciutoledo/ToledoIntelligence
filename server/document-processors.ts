import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';

// Funções auxiliares para extração de texto de diferentes tipos de arquivos
export async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    const pdf = require('pdf-parse');
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    
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
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({
      path: filePath
    });
    const text = result.value || "";
    
    // Normalizar quebras de linha e espaços
    const cleanedText = text.replace(/\r\n/g, '\n')
                           .replace(/\n{3,}/g, '\n\n')
                           .replace(/\s{2,}/g, ' ')
                           .trim();
                           
    console.log(`DOCX processado com sucesso: ${cleanedText.length} caracteres extraídos`);
    
    if (result.messages && result.messages.length > 0) {
      console.log("Mensagens de extração DOCX:", result.messages);
    }
    
    return cleanedText;
  } catch (error) {
    console.error("Erro ao extrair texto do DOCX:", error);
    return "";
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
    return `Não foi possível extrair o conteúdo do website: ${error.message}`;
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
    return `[Erro ao processar conteúdo: ${error.message}]`;
  }
}