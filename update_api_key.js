// Script para atualizar a chave API da OpenAI no banco de dados
const { pool } = require('./server/db');

async function updateApiKey() {
  const newApiKey = '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';
  
  try {
    // Atualiza todas as configurações LLM que usam OpenAI
    const result = await pool.query(`
      UPDATE llm_configs 
      SET api_key = $1
      WHERE model_name LIKE 'gpt-%'
    `, [newApiKey]);
    
    console.log(`Chaves atualizadas com sucesso! ${result.rowCount} registros modificados.`);
  } catch (error) {
    console.error('Erro ao atualizar chave API:', error);
  } finally {
    await pool.end();
  }
}

updateApiKey();
