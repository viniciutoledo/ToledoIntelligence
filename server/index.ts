import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { db } from "./db";
import path from "path";
import fs from "fs";
import { startDocumentMonitor } from "./document-monitor";

// Criar a aplicação Express
const app = express();

// Rota de health-check para o Render
app.get('/healthz', (_req, res) => {
  res.status(200).send('OK');
});

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static files from the dist/public directory in production
if (process.env.NODE_ENV === "production") {
  const publicPath = path.join(process.cwd(), 'dist/public');
  app.use(express.static(publicPath));

  // SPA fallback para todas as rotas que não são API
  app.get('*', (req, res, next) => {    
    if (req.path === '/healthz' || req.path.startsWith('/api/')) {
      next();
    } else {
      // Servir o SPA para todas as outras rotas
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

// Servir arquivos estáticos da pasta uploads
console.log(`Servindo arquivos estáticos de ${uploadsDir} na rota /uploads`);
app.use('/uploads', express.static(uploadsDir, {
  maxAge: '0',
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
    res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');

    if (res.req?.path && /\.(jpg|jpeg|png|gif)$/i.test(res.req.path)) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
  }
}));

// Middleware para permitir incorporação em iframes (embeds)
app.use((req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self' *");
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// Rotas especiais para widget
app.get('/widget-demo', (req, res) => {
  res.redirect('/widget-inline-demo.html');
});

app.get('/widget-docs', (req, res) => {
  res.redirect('/widget-embed-example.html');
});

// Rota para widget embed example
app.get('/widget-embed-example.html', async (req, res) => {
  const filePath = path.join(process.cwd(), 'public', 'widget-embed-example.html');

  try {
    const data = await fs.promises.readFile(filePath, 'utf8');
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self' *");
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(data);
  } catch (err) {
    return res.status(404).send('Documentação não encontrada');
  }
});

// Rota para widget inline demo
app.get('/widget-inline-demo.html', async (req, res) => {
  const filePath = path.join(process.cwd(), 'public', 'widget-inline-demo.html');

  try {
    const data = await fs.promises.readFile(filePath, 'utf8');
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

// Manipuladores de eventos para tratamento de erros
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Iniciar o servidor
async function initServer() {
  try {
    // Registrar rotas da API
    const server = await registerRoutes(app);

    // Middleware para tratamento de erros
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
      console.error(err);
    });

    // Configurar Vite para desenvolvimento ou static para produção
    if (process.env.NODE_ENV === "development") {
      console.log("Configurando Vite para ambiente de desenvolvimento");
      await setupVite(app, server);
    } else {
      console.log("Configurando middleware estático para produção");
      serveStatic(app);
    }

    // Verificar conexão com o banco de dados
    try {
      await db.query.users.findFirst();
      console.log('Database connection successful');
    } catch (error) {
      console.error('Database connection error:', error);
    }

    // Iniciar monitoramento de documentos
    startDocumentMonitor(15);

    return server;
  } catch (error) {
    console.error('Erro ao inicializar servidor:', error);
    throw error;
  }
}

// Iniciar o servidor e fazer o listen na porta
initServer().then(server => {
  const port = Number(process.env.PORT) || 5000;
  app.listen(port, () => console.log(`🚀 Servidor rodando na porta ${port}`));
});