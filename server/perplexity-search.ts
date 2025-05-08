/**
 * Módulo para integração com a API Perplexity para busca externa avançada
 * Fornece informações técnicas mais precisas para consultas especializadas
 */

import fetch from 'node-fetch';
import { logLlmUsage } from './llm';

/**
 * Interface para os resultados da API Perplexity
 */
interface PerplexityResponse {
  id: string;
  model: string;
  object: string;
  created: number;
  citations: string[];
  choices: Array<{
    index: number;
    finish_reason: string;
    message: {
      role: string;
      content: string;
    };
    delta?: {
      role: string;
      content: string;
    };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Realiza uma busca usando a API Perplexity
 * 
 * @param query A consulta a ser processada
 * @param language Idioma da consulta ('pt' ou 'en')
 * @param userId ID do usuário que fez a consulta (opcional)
 * @param widgetId ID do widget de onde veio a consulta (opcional)
 * @returns Informações relevantes encontradas ou null se não houver resultados
 */
export async function searchWithPerplexity(
  query: string,
  language: 'pt' | 'en' = 'pt',
  userId?: number,
  widgetId?: string
): Promise<string | null> {
  try {
    // Verificar se a chave API está disponível
    const apiKey = process.env.PERPLEXITY_API_KEY;
    
    if (!apiKey) {
      console.error('API key Perplexity não encontrada no ambiente');
      return null;
    }
    
    if (apiKey.includes('••••••')) {
      console.error('ERRO: Chave API Perplexity mascarada detectada.');
      return null;
    }
    
    console.log(`Realizando busca Perplexity para: "${query}"`);
    
    // Ajustar instruções com base no idioma
    const systemPrompt = language === 'pt' 
      ? 'Você é um especialista em manutenção de placas de circuito e eletrônica. Forneça informações técnicas precisas e relevantes, focando em aspectos práticos e apresentando valores específicos quando disponíveis. Priorize respostas concisas e diretas.'
      : 'You are an expert in circuit board maintenance and electronics. Provide accurate and relevant technical information, focusing on practical aspects and presenting specific values when available. Prioritize concise and direct answers.';
    
    // Ajustar a consulta com base no idioma
    const formattedQuery = language === 'pt' 
      ? `${query} (Responda em português do Brasil)`
      : query;
    
    // Criar o payload para a API
    const payload = {
      model: "llama-3.1-sonar-small-128k-online",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: formattedQuery
        }
      ],
      temperature: 0.2,
      top_p: 0.9,
      max_tokens: 500,
      search_domain_filter: [],
      return_images: false,
      return_related_questions: false,
      search_recency_filter: "month",
      top_k: 0,
      stream: false,
      presence_penalty: 0,
      frequency_penalty: 1
    };
    
    // Realizar a requisição para a API
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro na API Perplexity (${response.status}): ${errorText}`);
    }
    
    // Processar a resposta
    const data = await response.json() as PerplexityResponse;
    
    // Extrair o texto da resposta
    const responseText = data.choices[0]?.message?.content || '';
    
    if (!responseText.trim()) {
      console.log('Resposta vazia da API Perplexity');
      return null;
    }
    
    // Extrair fontes citadas para incluir na resposta
    let formattedResponse = responseText;
    
    if (data.citations && data.citations.length > 0) {
      const formattedCitations = language === 'pt'
        ? '\n\nFontes consultadas:'
        : '\n\nSources:';
      
      // Incluir até 3 fontes para não sobrecarregar a resposta
      formattedResponse += formattedCitations;
      
      for (let i = 0; i < Math.min(data.citations.length, 3); i++) {
        formattedResponse += `\n- ${data.citations[i]}`;
      }
    }
    
    // Registrar o uso da API Perplexity
    if (userId) {
      await logLlmUsage(
        "perplexity-search",
        "text",
        true,
        userId,
        widgetId,
        data.usage.total_tokens,
        undefined
      );
    }
    
    console.log('Busca Perplexity concluída com sucesso');
    return formattedResponse;
  } catch (error: any) {
    console.error('Erro ao realizar busca com Perplexity:', error);
    return null;
  }
}