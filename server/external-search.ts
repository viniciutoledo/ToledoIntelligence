/**
 * Módulo para realizar buscas externas quando o conhecimento interno não for suficiente
 * Utiliza a DuckDuckGo Instant Answer API para obter informações da web
 */
import fetch from 'node-fetch';
// Importar apenas funções essenciais para logging, sem depender do arquivo de auditoria
import { logLlmUsage } from './llm';

// Para testes
export async function testTopicsLearning(query: string): Promise<{
  shouldSearch: boolean;
  topicsFound: string[];
}> {
  const shouldSearch = await shouldUseExternalSearch(query);
  const topicsFound = await technicalTopicsInQuery(query);
  
  return {
    shouldSearch,
    topicsFound
  };
}

// Instâncias públicas do Searx (podem mudar com o tempo)
const SEARX_INSTANCES = [
  'https://searx.be',  
  'https://search.mdosch.de',
  'https://search.disroot.org',
  'https://search.unlocked.link'
];

// Interface para os resultados da API do Searx
interface SearxResult {
  query: string;
  number_of_results: number;
  results: Array<{
    title: string;
    url: string;
    content: string;
    engine: string;
    score?: number;
    category?: string;
    pretty_url?: string;
    published_date?: string;
  }>;
  answers?: string[];
  corrections?: string[];
  infoboxes?: Array<{
    infobox: string;
    id: string;
    content: string;
    img_src?: string;
    urls?: Array<{
      title: string;
      url: string;
    }>;
    attributes?: Record<string, string>;
  }>;
  suggestions?: string[];
  unresponsive_engines?: string[];
}

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

// Importar o módulo de busca Perplexity
import { searchWithPerplexity } from './perplexity-search';

/**
 * Realiza uma busca externa usando Perplexity, Searx e DuckDuckGo em cascata
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
  const shouldSearch = await shouldUseExternalSearch(query);
  if (!shouldSearch) {
    console.log('Consulta não se qualifica para busca externa:', query);
    return null;
  }
  
  try {
    // Primeiro tentar usar a API Perplexity (se disponível)
    if (process.env.PERPLEXITY_API_KEY) {
      console.log(`Tentando busca avançada via Perplexity para: "${query}"`);
      const perplexityResult = await searchWithPerplexity(query, language, userId, widgetId);
      
      if (perplexityResult) {
        console.log('Busca Perplexity retornou resultados úteis');
        return perplexityResult;
      }
    }
    
    // Se não tiver API Perplexity ou falhar, tentar usar o Searx
    console.log(`Tentando busca externa via Searx para: "${query}"`);
    const searxResult = await searchWithSearx(query, language);
    
    if (searxResult) {
      console.log('Busca Searx retornou resultados úteis');
      
      // Registrar o uso da busca externa via logLlmUsage
      if (userId) {
        const tokenEstimate = Math.floor(query.length / 4) + Math.floor(searxResult.length / 4);
        await logLlmUsage(
          "external-search-searx",
          "text",
          true,
          userId,
          widgetId,
          tokenEstimate,
          undefined
        );
      }
      
      return searxResult;
    }
    
    // Se o Searx não retornou resultados, tentar o DuckDuckGo
    console.log('Searx não retornou resultados úteis, tentando DuckDuckGo');
    
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
      throw new Error(`Erro na busca DuckDuckGo: ${response.statusText}`);
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
      console.log('Busca DuckDuckGo não retornou resultados estruturados, tentando extrair de resultados brutos...');
      
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
        console.log('Nenhuma busca externa retornou resultados úteis. Gerando resposta de fallback.');
        
        try {
          // Identificar temas técnicos na consulta para personalizar a resposta
          const temas = await technicalTopicsInQuery(query);
          
          if (temas.length > 0) {
            // Criar uma resposta de fallback personalizada
            result = generateFallbackResponse(query, temas, language);
          } else {
            console.log('Nenhum tema técnico identificado para fallback. Retornando null.');
            return null;
          }
        } catch (error) {
          console.error('Erro ao identificar temas técnicos para fallback:', error);
          return null;
        }
      }
    }
    
    // Registrar o uso da busca externa via logLlmUsage
    if (userId && result.trim()) {
      const tokenEstimate = Math.floor(query.length / 4) + Math.floor(result.length / 4);
      // Usar a função logLlmUsage com o formato correto
      await logLlmUsage(
        "external-search-ddg",
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
 * Realiza uma busca usando o Searx
 * 
 * @param query A consulta a ser buscada
 * @param language Idioma da consulta ('pt' ou 'en')
 * @returns Informações relevantes encontradas ou null se nada for encontrado
 */
async function searchWithSearx(query: string, language: 'pt' | 'en' = 'pt'): Promise<string | null> {
  try {
    console.log(`Executando busca via Searx para: "${query}"`);
    
    // Adicionar indicadores de idioma à consulta se for português
    const formattedQuery = language === 'pt' 
      ? `${query} português`
      : query;
    
    // Codificar a consulta para uso na URL
    const encodedQuery = encodeURIComponent(formattedQuery);
    
    // Tentar as instâncias do Searx em ordem até encontrar uma que responda
    for (const baseUrl of SEARX_INSTANCES) {
      try {
        // Montar a URL para a API do Searx
        const url = `${baseUrl}/search?q=${encodedQuery}&format=json&language=${language === 'pt' ? 'pt-BR' : 'en-US'}&categories=general`;
        
        // Realizar a requisição
        const response = await fetch(url, { 
          headers: {
            'User-Agent': 'ToledoIA Search/1.0',
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Erro na busca Searx: ${response.statusText}`);
        }
        
        // Processar a resposta
        const data = await response.json() as SearxResult;
        
        // Construir o resultado formatado com as informações encontradas
        let result = '';
        
        // Adicionar respostas diretas se disponíveis
        if (data.answers && data.answers.length > 0) {
          result += `Resposta: ${data.answers[0]}\n\n`;
        }
        
        // Adicionar infoboxes se disponíveis
        if (data.infoboxes && data.infoboxes.length > 0) {
          const infobox = data.infoboxes[0];
          result += `${infobox.infobox}: ${infobox.content}\n\n`;
        }
        
        // Adicionar resultados da busca
        if (data.results && data.results.length > 0) {
          result += "Resultados encontrados:\n";
          
          // Limitar a 5 resultados para não sobrecarregar a resposta
          const resultsToShow = data.results.slice(0, 5);
          
          for (const item of resultsToShow) {
            result += `- ${item.title}\n  ${item.content.substring(0, 150)}${item.content.length > 150 ? '...' : ''}\n\n`;
          }
        }
        
        // Adicionar sugestões de termos relacionados
        if (data.suggestions && data.suggestions.length > 0) {
          result += "Termos relacionados: ";
          result += data.suggestions.slice(0, 5).join(", ");
          result += "\n\n";
        }
        
        if (result.trim()) {
          console.log('Busca Searx concluída com sucesso');
          return result.trim();
        }
      } catch (error) {
        console.warn(`Erro ao usar instância Searx ${baseUrl}:`, error);
        // Continuar tentando com a próxima instância
        continue;
      }
    }
    
    console.log('Nenhuma instância Searx retornou resultados úteis');
    return null;
  } catch (error) {
    console.error('Erro ao executar busca Searx:', error);
    return null;
  }
}

/**
 * Verifica se uma consulta deve usar busca externa
 * 
 * @param query A consulta a ser verificada
 * @returns true se a consulta deve usar busca externa, false caso contrário
 */
export async function shouldUseExternalSearch(query: string): Promise<boolean> {
  try {
    // Verificar se a consulta contém algum dos temas técnicos
    const lowerQuery = query.toLowerCase();
    const topics = await getTechnicalTopics();
    
    return topics.some((topic: string) => 
      lowerQuery.includes(topic) || 
      lowerQuery.includes(topic + 's')  // Plural
    );
  } catch (error) {
    console.error('Erro ao verificar se consulta deve usar busca externa:', error);
    // Em caso de erro, assumir que não deve usar busca externa
    return false;
  }
}

/**
 * Identifica quais temas técnicos estão presentes na consulta
 * 
 * @param query A consulta a ser analisada
 * @returns Array com os temas técnicos encontrados na consulta
 */
async function technicalTopicsInQuery(query: string): Promise<string[]> {
  try {
    const lowerQuery = query.toLowerCase();
    const topics = await getTechnicalTopics();
    
    const foundTopics = topics.filter((topic: string) => 
      lowerQuery.includes(topic) || 
      lowerQuery.includes(topic + 's')  // Plural
    );
    
    // Para cada tópico encontrado, atualizar a contagem de uso
    if (foundTopics.length > 0) {
      for (const topic of foundTopics) {
        await storage.updateTechnicalTopicUsage(topic).catch(err => {
          console.error(`Erro ao atualizar uso do tópico "${topic}":`, err);
        });
      }
      
      // Tentar identificar possíveis novos tópicos técnicos na consulta
      await learnNewTopics(query, foundTopics);
    }
    
    return foundTopics;
  } catch (error) {
    console.error('Erro ao identificar temas técnicos na consulta:', error);
    // Em caso de erro, retornar array vazio
    return [];
  }
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

// Importar o módulo de armazenamento para salvar/recuperar tópicos adicionais
import { storage } from './storage';

/**
 * Cache em memória para tópicos técnicos adicionais
 * Será carregado do banco de dados na primeira chamada
 */
let additionalTopicsCache: string[] | null = null;

/**
 * Retorna a lista de temas técnicos usados para identificar consultas que podem se beneficiar de buscas externas
 * Combina a lista estática com tópicos adicionais aprendidos do banco de dados
 * 
 * @returns Array com todos os temas técnicos cadastrados
 */
async function getTechnicalTopics(): Promise<string[]> {
  // Lista base estática de tópicos técnicos
  const baseTopics = [
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
    'debugger',
    
    // Componentes modernos
    'iot',
    'módulo',
    'nodemcu',
    'display',
    'lcd',
    'oled',
    'tft',
    'servo',
    'motor',
    'stepper',
    'step-motor',
    'servo-motor',
    'brushless',
    'dc-motor',
    'shield',
    'hat',
    'expansão',
    'rtc',
    'relógio',
    
    // Novos padrões de comunicação
    'lorawan',
    'lora',
    'sigfox',
    'zigbee',
    'thread',
    'z-wave',
    'mqtt',
    'coap',
    'websocket',
    'bluetooth-le',
    'ble',
    'nfc',
    'rf',
    'infravermelho',
    
    // Componentes e termos específicos de PCB
    'pcb',
    'placa de circuito',
    'trilha',
    'via',
    'pad',
    'footprint',
    'máscara',
    'silkscreen',
    'serigrafia',
    'smd',
    'pth',
    'through-hole',
    'montagem',
    'dip',
    'soic',
    'qfp',
    'bga',
    
    // Ferramentas
    'osciloscópio',
    'analisador lógico',
    'analisador de espectro',
    'gerador de sinais',
    'fonte de alimentação',
    'estação de solda',
    'retrabalho',
  ];
  
  try {
    // Carregar tópicos adicionais do banco de dados se ainda não estiverem em cache
    if (additionalTopicsCache === null) {
      const additionalTopics = await storage.getAdditionalTechnicalTopics();
      
      // Filtrar para remover duplicatas e tópicos vazios
      if (additionalTopics && additionalTopics.length > 0) {
        additionalTopicsCache = additionalTopics
          .filter(topic => topic && topic.trim() !== '' && !baseTopics.includes(topic.trim().toLowerCase()));
      } else {
        additionalTopicsCache = [];
      }
    }
    
    // Combinar os tópicos base com os adicionais do cache
    return [...baseTopics, ...additionalTopicsCache];
  } catch (error) {
    console.error('Erro ao recuperar tópicos técnicos adicionais:', error);
    // Em caso de erro, retornar apenas a lista base
    return baseTopics;
  }
}

/**
 * Adiciona um novo tópico técnico ao sistema para uso em futuras detecções
 * 
 * @param topic O novo tópico técnico a ser adicionado
 * @returns true se o tópico foi adicionado com sucesso, false caso contrário
 */
export async function addTechnicalTopic(topic: string): Promise<boolean> {
  if (!topic || topic.trim() === '') {
    return false;
  }
  
  const normalizedTopic = topic.trim().toLowerCase();
  
  try {
    // Verificar se o tópico já existe na lista base ou na lista adicional
    const allTopics = await getTechnicalTopics();
    
    if (allTopics.includes(normalizedTopic)) {
      console.log(`Tópico "${normalizedTopic}" já existe na lista de tópicos técnicos`);
      return false;
    }
    
    // Adicionar o tópico ao banco de dados
    await storage.addTechnicalTopic(normalizedTopic);
    
    // Atualizar o cache
    if (additionalTopicsCache !== null) {
      additionalTopicsCache.push(normalizedTopic);
    }
    
    console.log(`Novo tópico técnico adicionado: "${normalizedTopic}"`);
    return true;
  } catch (error) {
    console.error('Erro ao adicionar novo tópico técnico:', error);
    return false;
  }
}

/**
 * Analisa a consulta do usuário para tentar identificar novos tópicos técnicos
 * Usa heurísticas simples e contexto dos tópicos já encontrados
 * 
 * @param query A consulta original do usuário
 * @param foundTopics Tópicos técnicos já encontrados na consulta
 * @returns Promise que resolve quando a análise for concluída
 */
async function learnNewTopics(query: string, foundTopics: string[]): Promise<void> {
  // Se não houver tópicos conhecidos, não temos contexto suficiente para aprender
  if (foundTopics.length === 0) {
    return;
  }
  
  try {
    const lowerQuery = query.toLowerCase();
    
    // Palavras muito comuns que não devem ser consideradas como tópicos técnicos
    const stopwords = [
      'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'de', 'do', 'da', 'dos', 'das', 'no', 'na',
      'nos', 'nas', 'ao', 'aos', 'à', 'às', 'pelo', 'pela', 'pelos', 'pelas', 'em', 'por', 'para',
      'com', 'sem', 'sob', 'sobre', 'entre', 'contra', 'que', 'porque', 'como', 'quando', 'onde',
      'quem', 'qual', 'quais', 'cujo', 'cujos', 'cuja', 'cujas', 'e', 'ou', 'mas', 'porém', 'contudo',
      'todavia', 'entretanto', 'então', 'portanto', 'logo', 'assim', 'se', 'caso', 'embora', 'apesar',
      'ainda', 'já', 'nunca', 'sempre', 'também', 'nem', 'é', 'são', 'foi', 'eram', 'estar', 'eu',
      'tu', 'ele', 'ela', 'nós', 'vós', 'eles', 'elas', 'meu', 'minha', 'seu', 'sua', 'este', 'esse',
      'aquele', 'isso', 'isto', 'aquilo', 'ter', 'fazer', 'ir', 'vir', 'pôr', 'ver', 'pode', 'será',
      'preciso', 'deveria', 'gostaria', 'quero', 'está', 'tem', 'foi', 'seria', 'há'
    ];
    
    // Extrair palavras-chave da consulta
    // Dividir a string em palavras
    const words = lowerQuery.split(/\s+/)
      .map(word => word.replace(/[.,!?;:(){}[\]<>]/g, '')) // Remover pontuação
      .filter(word => word.length > 3) // Palavras com mais de 3 caracteres
      .filter(word => !stopwords.includes(word)) // Excluir stopwords
    
    // Encontrar termos técnicos potenciais
    // 1. Palavras próximas a termos técnicos conhecidos
    const potentialTopics: string[] = [];
    
    // Examinar palavras específicas
    for (const word of words) {
      // Ignorar palavras que já são tópicos técnicos conhecidos
      if (foundTopics.some(topic => word.includes(topic) || topic.includes(word))) {
        continue;
      }
      
      // Verificar palavras técnicas específicas (sufixos e prefixos)
      const technicalIndicators = ['ador', 'sor', 'metro', 'scope', 'grafo', 'tech', 'ônico', 'ência', 'lógico', 'tron'];
      if (technicalIndicators.some(indicator => word.includes(indicator))) {
        potentialTopics.push(word);
        continue;
      }
      
      // Verificar palavras que podem ser modelos específicos (combinações de letras e números)
      if (/^[a-z]{1,4}\d{1,4}[a-z]?\d?$/i.test(word)) {
        potentialTopics.push(word);
        continue;
      }
      
      // Verificar palavras com hífen que podem indicar componentes técnicos
      if (word.includes('-') && word.length > 5) {
        potentialTopics.push(word);
        continue;
      }
    }
    
    // 2. Verificar frases substantivas (n-gramas) para termos compostos
    // Termos técnicos frequentemente são compostos por 2-3 palavras
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i+1]}`;
      
      // Verificar se algum dos termos já conhecidos está no bigrama
      if (foundTopics.some(topic => bigram.includes(topic))) {
        // Não adicionar termos que são apenas variações de termos já conhecidos
        continue;
      }
      
      // Adicionar termos substantivos compostos que pareçam técnicos
      if (!stopwords.includes(words[i]) && !stopwords.includes(words[i+1])) {
        if (words[i].length > 3 && words[i+1].length > 3) {
          potentialTopics.push(bigram);
        }
      }
    }
    
    // Limitar a quantidade de novos tópicos por consulta para evitar ruído
    if (potentialTopics.length > 0) {
      // Ordenar por comprimento (priorizar termos mais curtos e mais precisos)
      potentialTopics.sort((a, b) => a.length - b.length);
      
      // Adicionar até 2 novos tópicos por consulta
      const topicsToAdd = potentialTopics.slice(0, 2);
      
      for (const topic of topicsToAdd) {
        // Adicionar somente se o tópico tiver entre 4 e 25 caracteres (evitar termos muito curtos ou muito longos)
        if (topic.length >= 4 && topic.length <= 25) {
          await addTechnicalTopic(topic).catch(err => {
            console.error(`Erro ao adicionar novo tópico técnico potencial "${topic}":`, err);
          });
        }
      }
    }
  } catch (error) {
    console.error('Erro ao analisar consulta para aprendizado de novos tópicos:', error);
  }
}