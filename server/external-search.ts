/**
 * Módulo para realizar buscas externas quando o conhecimento interno não for suficiente
 * Utiliza a DuckDuckGo Instant Answer API para obter informações da web
 */
import fetch from 'node-fetch';
// Importar apenas funções essenciais para logging, sem depender do arquivo de auditoria
import { logLlmUsage } from './llm';

// Interface para os resultados da API do DuckDuckGo
interface DuckDuckGoResult {
  Abstract: string;
  AbstractText: string;
  AbstractSource: string;
  AbstractURL: string;
  Image: string;
  Heading: string;
  Answer: string;
  Redirect: string;
  AnswerType: string;
  Definition: string;
  DefinitionSource: string;
  DefinitionURL: string;
  RelatedTopics: Array<{
    Result: string;
    FirstURL: string;
    Icon: {
      URL: string;
      Height: string;
      Width: string;
    };
    Text: string;
    Topics?: any[];
  }>;
  Results: Array<{
    Result: string;
    FirstURL: string;
    Icon: {
      URL: string;
      Height: string;
      Width: string;
    };
    Text: string;
  }>;
  Type: string;
  Infobox: {
    content: Array<{
      data_type: string;
      label: string;
      value: string;
    }>;
    meta: Array<{
      data_type: string;
      label: string;
      value: string;
    }>;
  };
}

/**
 * Realiza uma busca externa usando a DuckDuckGo Instant Answer API
 * 
 * @param query A consulta a ser buscada
 * @param language Idioma da consulta ('pt' ou 'en')
 * @param userId ID do usuário que fez a consulta (opcional)
 * @param widgetId ID do widget de onde veio a consulta (opcional)
 * @returns Informações relevantes encontradas ou null se nada for encontrado
 */
export async function searchExternalKnowledge(
  query: string,
  language: 'pt' | 'en' = 'pt',
  userId?: number,
  widgetId?: string
): Promise<string | null> {
  // Verificar se a consulta deve usar busca externa
  if (!shouldUseExternalSearch(query)) {
    console.log('Consulta não se qualifica para busca externa:', query);
    return null;
  }
  try {
    console.log(`Executando busca externa via DuckDuckGo para: "${query}"`);
    
    // Adicionar indicadores de idioma à consulta se for português
    const formattedQuery = language === 'pt' 
      ? `${query} português`
      : query;
    
    // Codificar a consulta para uso na URL
    const encodedQuery = encodeURIComponent(formattedQuery);
    
    // Montar a URL para a API do DuckDuckGo
    const url = `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&skip_disambig=1&no_html=1&no_redirect=1`;
    
    // Realizar a requisição
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Erro na busca externa: ${response.statusText}`);
    }
    
    // Processar a resposta
    const data = await response.json() as DuckDuckGoResult;
    
    // Construir o resultado formatado com as informações encontradas
    let result = '';
    
    // Adicionar a resposta direta se disponível
    if (data.Answer && data.Answer.trim()) {
      result += `Resposta: ${data.Answer}\n\n`;
    }
    
    // Adicionar o resumo se disponível
    if (data.AbstractText && data.AbstractText.trim()) {
      result += `Resumo: ${data.AbstractText}\n`;
      if (data.AbstractSource) {
        result += `Fonte: ${data.AbstractSource}\n`;
      }
      result += '\n';
    }
    
    // Adicionar a definição se disponível
    if (data.Definition && data.Definition.trim()) {
      result += `Definição: ${data.Definition}\n`;
      if (data.DefinitionSource) {
        result += `Fonte: ${data.DefinitionSource}\n`;
      }
      result += '\n';
    }
    
    // Adicionar tópicos relacionados
    if (data.RelatedTopics && data.RelatedTopics.length > 0) {
      result += 'Tópicos relacionados:\n';
      
      // Limitar a 3 tópicos para não sobrecarregar a resposta
      const topicsToShow = data.RelatedTopics.slice(0, 3);
      
      for (const topic of topicsToShow) {
        if (topic.Text) {
          result += `- ${topic.Text}\n`;
        }
      }
      
      result += '\n';
    }
    
    // Se não encontrou nada relevante, tentar extrair informações dos dados brutos
    if (!result.trim()) {
      console.log('Busca não retornou resultados estruturados, tentando extrair de resultados brutos...');
      
      // Tentar extrair de Results se disponível
      if (data.Results && data.Results.length > 0) {
        result += "Resultados encontrados:\n";
        for (const item of data.Results.slice(0, 3)) {
          if (item.Text) {
            result += `- ${item.Text}\n`;
          }
        }
        result += '\n';
      }
      
      // Tentar extrair de Infobox se disponível
      if (data.Infobox && data.Infobox.content && data.Infobox.content.length > 0) {
        result += "Informações adicionais:\n";
        for (const item of data.Infobox.content.slice(0, 5)) {
          if (item.label && item.value) {
            result += `- ${item.label}: ${item.value}\n`;
          }
        }
        result += '\n';
      }
      
      // Se ainda não tiver resultados úteis, gerar uma resposta de fallback
      if (!result.trim()) {
        console.log('Busca externa não retornou resultados úteis após processamento adicional. Gerando resposta de fallback.');
        
        // Identificar temas técnicos na consulta para personalizar a resposta
        const temas = technicalTopicsInQuery(query);
        
        if (temas.length > 0) {
          // Criar uma resposta de fallback personalizada
          result = generateFallbackResponse(query, temas, language);
        } else {
          console.log('Nenhum tema técnico identificado para fallback. Retornando null.');
          return null;
        }
      }
    }
    
    // Registrar o uso da busca externa via logLlmUsage
    if (userId) {
      const tokenEstimate = Math.floor(query.length / 4) + Math.floor(result.length / 4);
      // Usar a função logLlmUsage com o formato correto
      await logLlmUsage(
        "external-search",
        "text",
        true,
        userId,
        widgetId,
        tokenEstimate,
        undefined
      );
    }
    
    console.log('Busca externa concluída com sucesso');
    return result.trim();
  } catch (error: any) {
    console.error('Erro ao executar busca externa:', error);
    return null;
  }
}

/**
 * Verifica se uma consulta deve usar busca externa
 * 
 * @param query A consulta a ser verificada
 * @returns true se a consulta deve usar busca externa, false caso contrário
 */
export function shouldUseExternalSearch(query: string): boolean {
  // Verificar se a consulta contém algum dos temas técnicos
  const lowerQuery = query.toLowerCase();
  return getTechnicalTopics().some(topic => 
    lowerQuery.includes(topic) || 
    lowerQuery.includes(topic + 's')  // Plural
  );
}

/**
 * Identifica quais temas técnicos estão presentes na consulta
 * 
 * @param query A consulta a ser analisada
 * @returns Array com os temas técnicos encontrados na consulta
 */
function technicalTopicsInQuery(query: string): string[] {
  const lowerQuery = query.toLowerCase();
  return getTechnicalTopics().filter(topic => 
    lowerQuery.includes(topic) || 
    lowerQuery.includes(topic + 's')  // Plural
  );
}

/**
 * Gera uma resposta de fallback quando a busca externa não encontra resultados
 * 
 * @param query A consulta original
 * @param topics Os temas técnicos identificados na consulta
 * @param language O idioma preferido para a resposta
 * @returns Uma resposta estruturada e informativa
 */
function generateFallbackResponse(query: string, topics: string[], language: 'pt' | 'en'): string {
  // Selecionar mensagens com base no idioma
  const messages = language === 'pt' ? {
    intro: "Não encontrei informações específicas sobre sua consulta na nossa base de conhecimento ou em buscas externas.",
    relevance: "Esta parece ser uma questão técnica importante relacionada a:",
    suggestion: "Recomendações:",
    checkDocs: "• Verificar manuais técnicos e datasheets específicos do componente ou equipamento.",
    consultExp: "• Consultar um especialista se o problema persistir.",
    checkForums: "• Buscar em fóruns especializados como StackExchange, fóruns de Arduino, ou comunidades de eletrônica.",
    addDocs: "• Considerar adicionar documentação sobre este tema à base de conhecimento do sistema."
  } : {
    intro: "I couldn't find specific information about your query in our knowledge base or through external searches.",
    relevance: "This appears to be an important technical question related to:",
    suggestion: "Recommendations:",
    checkDocs: "• Check technical manuals and datasheets specific to the component or equipment.",
    consultExp: "• Consult an expert if the problem persists.",
    checkForums: "• Search specialized forums such as StackExchange, Arduino forums, or electronics communities.",
    addDocs: "• Consider adding documentation about this topic to the system's knowledge base."
  };

  let response = `${messages.intro}\n\n${messages.relevance}\n`;
  
  // Adicionar os tópicos identificados
  topics.forEach(topic => {
    response += `• ${topic}\n`;
  });
  
  response += `\n${messages.suggestion}\n${messages.checkDocs}\n${messages.consultExp}\n${messages.checkForums}\n${messages.addDocs}`;
  
  return response;
}

/**
 * Retorna a lista de temas técnicos usados para identificar consultas que podem se beneficiar de buscas externas
 * 
 * @returns Array com todos os temas técnicos cadastrados
 */
function getTechnicalTopics(): string[] {
  return [
    // Componentes eletrônicos
    'componente',
    'circuito', 
    'microcontrolador',
    'sensor',
    'placa',
    'arduino',
    'raspberry',
    'pic',
    'stm32',
    'esp8266',
    'esp32',
    'atmega',
    'avr',
    'arm',
    'pic16f',
    'pic18f',
    
    // Documentação técnica
    'especificação',
    'datasheet',
    'pinagem',
    'pinout',
    'esquemático',
    'diagrama',
    
    // Propriedades elétricas
    'potência',
    'tensão',
    'corrente',
    'resistência',
    'volt',
    'ampere',
    'ohm',
    'watt',
    'frequência',
    'hertz',
    
    // Componentes específicos
    'capacitor',
    'transistor',
    'diodo',
    'led',
    'indutor',
    'oscilador',
    'relé',
    'transformador',
    'resistor',
    'fusível',
    'cristal',
    
    // Manutenção
    'manutenção',
    'reparo',
    'solda',
    'erro',
    'falha',
    'diagnóstico',
    'troubleshooting',
    'multímetro',
    'osciloscópio',
    
    // Comunicação
    'protocolo',
    'comunicação',
    'uart',
    'spi',
    'i2c',
    'rs232',
    'rs485',
    'can',
    'usb',
    'ethernet',
    'wifi',
    'bluetooth',
    
    // Software
    'firmware',
    'bootloader',
    'driver',
    'biblioteca',
    'library',
    'código',
    'programação',
    'debugger'
  ];
}