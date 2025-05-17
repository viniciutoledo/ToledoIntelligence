import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { syncDatabaseSchema } from "./migrate";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { planPricing } from "@shared/schema";
import path from "path";
import fs from "fs";
import { startDocumentMonitor } from "./document-monitor";
import { initializeSecuritySettings } from "./security-settings";

const app = express();

// Health check endpoints must be first
app.get('/', (req, res) => {
  res.status(200).type('text/plain').send('OK');
});

app.get('/health', (req, res) => {
  res.status(200).type('text/plain').send('OK');
});

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static files from the dist/public directory in production
if (process.env.NODE_ENV === "production") {
  const publicPath = path.join(process.cwd(), 'dist/public');
  app.use(express.static(publicPath));

  // SPA fallback route - exclude health check paths
  app.get('*', (req, res, next) => {
    if (req.path === '/' || req.path === '/health') {
      next();
    } else {
      res.sendFile(path.join(publicPath, 'index.html'));
    }
  });
}

// Garantir que o diretório uploads existe
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Diretório uploads criado com sucesso');
}

// Servir arquivos estáticos da pasta uploads com configurações otimizadas
console.log(`Servindo arquivos estáticos de ${uploadsDir} na rota /uploads`);
app.use('/uploads', express.static(uploadsDir, {
  maxAge: '0', // Sem cache para desenvolvimento
  etag: false, // Desabilitar etag
  lastModified: false,
  setHeaders: (res) => {
    // Headers importantes para permitir acesso cross-origin e cross-frame
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
    res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');

    // Headers específicos para imagens
    if (res.req?.path && /\.(jpg|jpeg|png|gif)$/i.test(res.req.path)) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
  }
}));

// Middleware para permitir incorporação em iframes (embeds)
app.use((req, res, next) => {
  // Remover X-Frame-Options para permitir que o site seja embutido em iframes
  res.removeHeader('X-Frame-Options');

  // Definir Content-Security-Policy para permitir embedding de forma segura
  res.setHeader(
    'Content-Security-Policy',
    "frame-ancestors 'self' *"
  );

  // Permitir CORS para que o widget possa ser carregado em qualquer site
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Se for uma requisição OPTIONS, retornar 200 imediatamente (pré-voo CORS)
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// Rotas especiais para servir documentação do widget diretamente
app.get('/widget-demo', (req, res) => {
  res.redirect('/widget-inline-demo.html');
});

app.get('/widget-docs', (req, res) => {
  res.redirect('/widget-embed-example.html');
});

// Rota específica para o arquivo HTML de demonstração do widget
app.get('/widget-embed-example.html', async (req, res) => {
  // Usando o path já importado globalmente
  // Usando fs.promises para compatibilidade com ES modules
  const filePath = path.join(process.cwd(), 'public', 'widget-embed-example.html');

  try {
    const data = await fs.promises.readFile(filePath, 'utf8');

    // Definir cabeçalhos para permitir incorporação
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self' *");
    res.setHeader('Access-Control-Allow-Origin', '*');

    res.send(data);
  } catch (err) {
    return res.status(404).send('Documentação não encontrada');
  }
});

// Rota específica para o arquivo HTML de demonstração do widget inline
app.get('/widget-inline-demo.html', async (req, res) => {
  // Usando o path já importado globalmente
  // Usando fs.promises para compatibilidade com ES modules
  const filePath = path.join(process.cwd(), 'public', 'widget-inline-demo.html');

  try {
    const data = await fs.promises.readFile(filePath, 'utf8');

    // Definir cabeçalhos para permitir incorporação
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self' *");
    res.setHeader('Access-Control-Allow-Origin', '*');

    res.send(data);
  } catch (err) {
    return res.status(404).send('Demonstração não encontrada');
  }
});

// Middleware de logging
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

    // Inicializar configurações de segurança
    try {
      await initializeSecuritySettings();
    } catch (error) {
      console.error('Erro ao inicializar configurações de segurança:', error);
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

    // Iniciar monitoramento automático de documentos (verificação a cada 15 minutos)
    startDocumentMonitor(15);

    // Log para confirmar que o servidor está rodando
    console.log('Server is now running and will stay up to handle requests');
  }).on('error', (error) => {
    console.error('Server startup error:', error);
    process.exit(1);
  });

  // Prevent the server from closing when main execution ends
  process.on('beforeExit', () => {
    log('Keeping server running in background');
  });

  // Keep the process running indefinitely
  process.stdin.resume();

  // Handle termination signals properly
  ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
    process.on(signal, () => {
      log(`Received ${signal}, shutting down gracefully`);
      server.close(() => {
        log('Server closed');
        process.exit(0);
      });
    });
  });
})();