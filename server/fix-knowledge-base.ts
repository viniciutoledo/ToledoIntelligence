import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from '@shared/schema';

// Configurar o WebSocket para o Neon
neonConfig.webSocketConstructor = ws;

const runMigration = async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  
  try {
    console.log('Iniciando correção da tabela knowledge_base...');
    
    // Verificar se a tabela existe
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'knowledge_base'
      );
    `);
    
    const tableExists = tableCheck.rows[0].exists;
    
    if (tableExists) {
      console.log('Tabela knowledge_base encontrada.');
      
      // Dropar a tabela existente
      console.log('Removendo tabela existente para recriar com estrutura correta...');
      await pool.query(`DROP TABLE IF EXISTS knowledge_base CASCADE;`);
      console.log('Tabela removida com sucesso.');
    }
    
    // Criar a tabela novamente com a estrutura correta
    console.log('Criando tabela knowledge_base com a estrutura atualizada...');
    await pool.query(`
      CREATE TABLE knowledge_base (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        embedding TEXT,
        source_type TEXT NOT NULL,
        source_id INTEGER,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        chunk_index INTEGER,
        document_title TEXT,
        language TEXT DEFAULT 'pt' NOT NULL,
        is_verified BOOLEAN DEFAULT FALSE,
        relevance_score INTEGER DEFAULT 0
      );
      
      CREATE INDEX idx_knowledge_base_source ON knowledge_base(source_type, source_id);
      CREATE INDEX idx_knowledge_base_language ON knowledge_base(language);
    `);
    
    console.log('Tabela knowledge_base criada com sucesso!');
    console.log('Migração concluída.');
    
  } catch (error) {
    console.error('Erro durante a migração:', error);
  } finally {
    await pool.end();
    console.log('Conexão com o banco de dados encerrada.');
  }
};

runMigration().catch(console.error);