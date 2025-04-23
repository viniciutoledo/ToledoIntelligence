import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { syncDatabaseSchema } from "./migrate";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { planPricing } from "@shared/schema";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Sincronizar o esquema do banco de dados antes de iniciar o servidor
  try {
    console.log('Sincronizando o esquema do banco de dados...');
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
  } catch (error) {
    console.error('Erro ao sincronizar o esquema do banco de dados:', error);
  }
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
