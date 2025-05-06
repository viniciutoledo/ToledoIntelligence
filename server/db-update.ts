import { pool, db } from './db';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { sql } from 'drizzle-orm';

async function updateLlmConfigTable() {
  console.log('Verificando e atualizando a tabela llm_configs...');
  
  try {
    // Verifica se a coluna tone existe
    const checkToneColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'llm_configs' AND column_name = 'tone'
    `);
    
    if (checkToneColumn.rows.length === 0) {
      console.log('Adicionando coluna tone...');
      await pool.query(`
        ALTER TABLE llm_configs 
        ADD COLUMN tone TEXT CHECK (tone IN ('formal', 'normal', 'casual')) 
        DEFAULT 'normal' NOT NULL
      `);
      console.log('Coluna tone adicionada com sucesso.');
    } else {
      console.log('Coluna tone já existe.');
    }
    
    // Verifica se a coluna behavior_instructions existe
    const checkBehaviorColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'llm_configs' AND column_name = 'behavior_instructions'
    `);
    
    if (checkBehaviorColumn.rows.length === 0) {
      console.log('Adicionando coluna behavior_instructions...');
      await pool.query(`
        ALTER TABLE llm_configs 
        ADD COLUMN behavior_instructions TEXT
      `);
      console.log('Coluna behavior_instructions adicionada com sucesso.');
    } else {
      console.log('Coluna behavior_instructions já existe.');
    }
    
    // Verifica se a coluna should_use_training existe
    const checkTrainingColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'llm_configs' AND column_name = 'should_use_training'
    `);
    
    if (checkTrainingColumn.rows.length === 0) {
      console.log('Adicionando coluna should_use_training...');
      await pool.query(`
        ALTER TABLE llm_configs 
        ADD COLUMN should_use_training BOOLEAN 
        DEFAULT TRUE NOT NULL
      `);
      console.log('Coluna should_use_training adicionada com sucesso.');
    } else {
      console.log('Coluna should_use_training já existe.');
    }
    
    // Verifica se a coluna temperature existe
    const checkTemperatureColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'llm_configs' AND column_name = 'temperature'
    `);
    
    if (checkTemperatureColumn.rows.length === 0) {
      console.log('Adicionando coluna temperature...');
      await pool.query(`
        ALTER TABLE llm_configs 
        ADD COLUMN temperature TEXT 
        DEFAULT '0.3' NOT NULL
      `);
      console.log('Coluna temperature adicionada com sucesso.');
    } else {
      console.log('Coluna temperature já existe.');
    }
    
    console.log('Atualização da tabela llm_configs concluída com sucesso!');
  } catch (error) {
    console.error('Erro ao atualizar a tabela llm_configs:', error);
    throw error;
  }
}

async function createKnowledgeBaseTable() {
  console.log('Verificando e criando a tabela knowledge_base...');
  
  try {
    // Verifica se a tabela knowledge_base existe
    const checkTableExists = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'knowledge_base'
    `);
    
    if (checkTableExists.rows.length === 0) {
      console.log('Criando tabela knowledge_base...');
      
      // Criar tabela knowledge_base com embedding como JSON
      await pool.query(`
        CREATE TABLE knowledge_base (
          id SERIAL PRIMARY KEY,
          content TEXT NOT NULL,
          embedding TEXT, -- Armazenar embedding como texto JSON para compatibilidade
          source_type TEXT NOT NULL,
          source_id INTEGER,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          chunk_index INTEGER,
          document_title TEXT,
          language TEXT DEFAULT 'pt',
          is_verified BOOLEAN DEFAULT FALSE,
          relevance_score INTEGER DEFAULT 0
        )
      `);
      
      // Criar índice básico em source_id e source_type
      await pool.query(`
        CREATE INDEX idx_knowledge_base_source 
        ON knowledge_base(source_type, source_id)
      `);
      
      console.log('Tabela knowledge_base criada com sucesso!');
    } else {
      console.log('Tabela knowledge_base já existe.');
    }
  } catch (error) {
    console.error('Erro ao criar tabela knowledge_base:', error);
    throw error;
  }
}

// Função principal para executar as atualizações
async function runMigrations() {
  console.log('Iniciando atualizações do banco de dados...');
  
  try {
    await updateLlmConfigTable();
    await createKnowledgeBaseTable();
    console.log('Todas as atualizações foram concluídas com sucesso!');
  } catch (error) {
    console.error('Erro durante o processo de atualização:', error);
  } finally {
    // Encerrar a conexão com o banco
    await pool.end();
    console.log('Conexão com o banco de dados encerrada.');
  }
}

// Executar as migrations automaticamente
runMigrations().catch(err => console.error('Erro na execução de migrações:', err));

export { runMigrations };