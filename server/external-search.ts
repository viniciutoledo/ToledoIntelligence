/**
 * Módulo para realizar buscas externas quando o conhecimento interno não for suficiente
 * Utiliza a DuckDuckGo Instant Answer API para obter informações da web
 */
import fetch from 'node-fetch';
import { logAction } from './audit-log';

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
    
    // Registrar o uso da busca externa
    if (userId) {
      await logAction({
        userId,
        action: "external_search",
        details: { 
          query,
          widget_id: widgetId || null,
          found_results: Boolean(data.AbstractText || data.Answer || data.RelatedTopics.length > 0)
        }
      });
    }
    
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
    
    // Se não encontrou nada relevante
    if (!result.trim()) {
      console.log('Busca externa não retornou resultados úteis.');
      return null;
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
  // Lista de temas técnicos que podem se beneficiar de buscas externas
  const technicalTopics = [
    'componente',
    'circuito', 
    'microcontrolador',
    'sensor',
    'placa',
    'arduino',
    'raspberry',
    'especificação',
    'datasheet',
    'pinagem',
    'esquemático',
    'diagrama',
    'potência',
    'tensão',
    'corrente',
    'resistência',
    'capacitor',
    'transistor',
    'diodo',
    'led',
    'manutenção',
    'reparo',
    'solda',
    'erro',
    'falha',
    'protocolo',
    'comunicação',
    'firmware'
  ];
  
  // Verificar se a consulta contém algum dos temas técnicos
  const lowerQuery = query.toLowerCase();
  
  return technicalTopics.some(topic => 
    lowerQuery.includes(topic) || 
    lowerQuery.includes(topic + 's')  // Plural
  );
}