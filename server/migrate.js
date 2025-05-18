/**
 * Script para sincronização e migração do banco de dados
 * Executar com: npm run migrate
 */

import { syncDatabaseSchema } from "./migrate.ts";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { planPricing } from "@shared/schema";
import { initializeSecuritySettings } from "./security-settings";

async function migrate() {
  try {
    console.log('Iniciando sincronização do esquema do banco de dados...');
    await syncDatabaseSchema();
    console.log('Esquema do banco de dados sincronizado com sucesso');

    // Inicializar os preços dos planos se não existirem
    try {
      // Verificar se já existem preços para os planos
      const basicPricing = await db.select().from(planPricing).where(eq(planPricing.subscription_tier, 'basic'));
      const intermediatePricing = await db.select().from(planPricing).where(eq(planPricing.subscription_tier, 'intermediate'));

      // Se não existir preço para o plano básico, criar
      if (basicPricing.length === 0) {
        console.log('Criando preço padrão para o plano básico...');
        await db.insert(planPricing).values({
          subscription_tier: 'basic',
          name: 'Plano Básico',
          price: 2990, // R$ 29,90 em centavos
          currency: 'BRL',
          description: 'Acesso a 2.500 interações por mês',
        });
      }

      // Se não existir preço para o plano intermediário, criar
      if (intermediatePricing.length === 0) {
        console.log('Criando preço padrão para o plano intermediário...');
        await db.insert(planPricing).values({
          subscription_tier: 'intermediate',
          name: 'Plano Intermediário',
          price: 3990, // R$ 39,90 em centavos
          currency: 'BRL',
          description: 'Acesso a 5.000 interações por mês',
        });
      }

      console.log('Preços dos planos verificados/inicializados com sucesso');
    } catch (error) {
      console.error('Erro ao inicializar preços dos planos:', error);
    }

    // Inicializar configurações de segurança
    try {
      await initializeSecuritySettings();
    } catch (error) {
      console.error('Erro ao inicializar configurações de segurança:', error);
    }

    console.log('Migração completa');
    process.exit(0);
  } catch (error) {
    console.error('Erro durante a migração:', error);
    process.exit(1);
  }
}

migrate();