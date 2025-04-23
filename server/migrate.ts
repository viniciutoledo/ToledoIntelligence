import { drizzle } from 'drizzle-orm/neon-serverless';
import { migrate } from 'drizzle-orm/neon-serverless/migrator';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import * as schema from '@shared/schema';

// Configuração para WebSockets com Neon
neonConfig.webSocketConstructor = ws;

// Função para sincronizar o banco de dados com o esquema
export async function syncDatabaseSchema() {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL não está definida no ambiente');
    }

    console.log('Iniciando sincronização do esquema do banco de dados...');
    
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle(pool, { schema });
    
    // Esta função aplica automaticamente as alterações de esquema
    await pool.query(`
      -- Criar tabela plan_features se não existir
      CREATE TABLE IF NOT EXISTS plan_features (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        subscription_tier TEXT NOT NULL,
        feature_key TEXT NOT NULL,
        feature_name TEXT NOT NULL,
        feature_description TEXT,
        is_enabled BOOLEAN NOT NULL DEFAULT TRUE
      );
      
      -- Criar tabela plan_pricing se não existir
      CREATE TABLE IF NOT EXISTS plan_pricing (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        subscription_tier TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'BRL',
        description TEXT
      );
      
      -- Criar tabela analysis_reports se não existir
      CREATE TABLE IF NOT EXISTS analysis_reports (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        title TEXT NOT NULL,
        report_type TEXT NOT NULL,
        image_url TEXT,
        message_id INTEGER,
        is_exported BOOLEAN NOT NULL DEFAULT FALSE,
        export_format TEXT,
        exported_at TIMESTAMP,
        exported_url TEXT
      );
      
      -- Criar tabela support_tickets se não existir
      CREATE TABLE IF NOT EXISTS support_tickets (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        message TEXT NOT NULL,
        status TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        subject TEXT NOT NULL,
        priority TEXT NOT NULL,
        resolved_at TIMESTAMP,
        assigned_to INTEGER
      );
    `);
    
    console.log('Esquema do banco de dados sincronizado com sucesso');
    
    await pool.end();
    
    return true;
  } catch (error) {
    console.error('Erro ao sincronizar esquema do banco de dados:', error);
    return false;
  }
}

// Executar diretamente se este arquivo for chamado diretamente
// Nota: Em módulos ES, não há equivalente direto a require.main === module
// então removemos essa verificação
if (import.meta.url === `file://${process.argv[1]}`) {
  syncDatabaseSchema()
    .then(() => {
      console.log('Sincronização concluída');
      process.exit(0);
    })
    .catch(error => {
      console.error('Erro durante a sincronização:', error);
      process.exit(1);
    });
}