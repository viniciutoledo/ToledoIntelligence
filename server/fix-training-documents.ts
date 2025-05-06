import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from '@shared/schema';

// Configurar o WebSocket para o Neon
neonConfig.webSocketConstructor = ws;

const fixTrainingDocumentsStatus = async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  
  try {
    console.log('Iniciando correção da tabela training_documents...');
    
    // Verifica se o status "indexed" está sendo usado
    const checkQuery = await pool.query(`
      SELECT COUNT(*) FROM training_documents WHERE status = 'indexed';
    `);
    
    const indexedCount = parseInt(checkQuery.rows[0].count, 10);
    console.log(`Encontrados ${indexedCount} registros com status 'indexed'`);
    
    if (indexedCount > 0) {
      // Atualiza a restrição para incluir "indexed" na lista de valores permitidos
      await pool.query(`
        -- Primeiro removemos a restrição existente
        ALTER TABLE training_documents DROP CONSTRAINT IF EXISTS training_documents_status_check;
        
        -- Depois adicionamos uma nova restrição com "indexed" incluído
        ALTER TABLE training_documents ADD CONSTRAINT training_documents_status_check 
        CHECK (status IN ('pending', 'processing', 'completed', 'error', 'indexed'));
      `);
      
      console.log('Restrição atualizada com sucesso para incluir status "indexed"');
    } else {
      // Se não há registros com status "indexed", atualizamos os que houver para "completed"
      console.log('Não foram encontrados registros com status "indexed". Verificando se há status inválidos...');
      
      const invalidStatusQuery = await pool.query(`
        SELECT id, status FROM training_documents 
        WHERE status NOT IN ('pending', 'processing', 'completed', 'error');
      `);
      
      if (invalidStatusQuery.rows.length > 0) {
        console.log(`Encontrados ${invalidStatusQuery.rows.length} registros com status inválidos. Corrigindo...`);
        
        for (const row of invalidStatusQuery.rows) {
          console.log(`Atualizando documento ID ${row.id} de status "${row.status}" para "completed"`);
          await pool.query(`
            UPDATE training_documents SET status = 'completed' WHERE id = $1;
          `, [row.id]);
        }
        
        console.log('Todos os registros com status inválidos foram atualizados para "completed"');
      } else {
        console.log('Não foram encontrados registros com status inválidos');
      }
    }
    
    console.log('Verificação concluída com sucesso');
    
  } catch (error) {
    console.error('Erro durante a correção:', error);
  } finally {
    await pool.end();
    console.log('Conexão com o banco de dados encerrada');
  }
};

fixTrainingDocumentsStatus().catch(console.error);