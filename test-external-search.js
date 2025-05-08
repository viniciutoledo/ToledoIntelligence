import fetch from 'node-fetch';

async function testDuckDuckGo() {
  try {
    const query = 'arduino uno pinout';
    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.duckduckgo.com/?q=${encodedQuery}&format=json`;
    
    console.log('URL:', url);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error('Erro na busca');
    }
    
    const data = await response.json();
    console.log('Dados recebidos. Tópicos relacionados:', data.RelatedTopics.length);
    
    if (data.RelatedTopics.length > 0) {
      console.log('Exemplo de tópico:', data.RelatedTopics[0].Text);
    } else {
      console.log('Nenhum tópico relacionado encontrado');
    }
    
    if (data.AbstractText) {
      console.log('Resumo:', data.AbstractText);
    } else {
      console.log('Sem resumo');
    }
    
  } catch (error) {
    console.error('Erro:', error);
  }
}

testDuckDuckGo();