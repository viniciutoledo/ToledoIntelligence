import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from "@shared/schema";

// Configuração para suporte a WebSockets no Neon
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL deve ser configurada. Você esqueceu de provisionar um banco de dados?"
  );
}

// Criar pool de conexões
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Criar cliente Drizzle
export const db = drizzle(pool, { schema });