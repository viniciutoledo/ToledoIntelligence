import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, checkRole } from "./auth";
import { analyzeImage, analyzeFile } from "./llm";
import { logAction } from "./audit";
import multer from "multer";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { 
  insertLlmConfigSchema,
  insertAvatarSchema,
  insertChatSessionSchema,
  insertChatMessageSchema
} from "@shared/schema";

// Importações para o Stripe e Supabase
import { 
  stripe, 
  STRIPE_PRICE_IDS, 
  getOrCreateStripeCustomer, 
  createCheckoutSession,
  getSubscriptionDetails,
  cancelSubscription,
  updateUserSubscriptionTier,
  MESSAGE_LIMITS
} from './stripe';
import { 
  supabase, 
  checkSubscriptionStatus, 
  incrementMessageCount, 
  checkMessageLimit 
} from './supabase';

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

// Create uploads directory if it doesn't exist
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.mkdirSync(path.join(UPLOADS_DIR, "avatars"), { recursive: true });
  fs.mkdirSync(path.join(UPLOADS_DIR, "files"), { recursive: true });
}

// Configure multer storage
const storageConfig = multer.diskStorage({
  destination: (req, file, cb) => {
    const isAvatar = req.path.includes("/avatar");
    const destination = isAvatar 
      ? path.join(UPLOADS_DIR, "avatars") 
      : path.join(UPLOADS_DIR, "files");
    cb(null, destination);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
    const extension = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${extension}`);
  },
});

// File filter for supported formats
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const isAvatar = req.path.includes("/avatar");
  
  if (isAvatar) {
    // Avatar: JPG, PNG only
    if (file.mimetype === "image/jpeg" || file.mimetype === "image/png") {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file format. Please upload JPG or PNG."));
    }
  } else {
    // Chat uploads: PNG, JPG, PDF, TXT
    if (
      file.mimetype === "image/jpeg" || 
      file.mimetype === "image/png" || 
      file.mimetype === "application/pdf" || 
      file.mimetype === "text/plain"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file format. Please upload PNG, JPG, PDF, or TXT."));
    }
  }
};

// Create multer upload instance
const upload = multer({ 
  storage: storageConfig, 
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max for chat uploads
  }
});

// Create avatar upload instance with 5MB limit
const avatarUpload = multer({
  storage: storageConfig,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max for avatars
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes
  setupAuth(app);
  
  // API routes
  // User management
  app.get("/api/user", isAuthenticated, async (req, res) => {
    const user = await storage.getUser(req.user!.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    
    // Don't send password and other sensitive data to client
    const { password, twofa_secret, ...safeUser } = user;
    res.json(safeUser);
  });
  
  // Informações de assinatura do usuário
  app.get("/api/user/subscription", isAuthenticated, async (req, res) => {
    try {
      // Verificar no Supabase os detalhes de assinatura
      const subscriptionStatus = await checkSubscriptionStatus(req.user!.id.toString());
      
      // Se o usuário tem uma assinatura ativa, buscar mais detalhes no Stripe
      if (subscriptionStatus.active && subscriptionStatus.tier !== 'none') {
        // Consultar o usuário no Supabase para obter o ID da assinatura no Stripe
        const { data: userData, error } = await supabase
          .from('users')
          .select('stripe_subscription_id')
          .eq('id', req.user!.id.toString())
          .single();
        
        if (error || !userData?.stripe_subscription_id) {
          // Se não conseguir encontrar detalhes, apenas retornar o status básico
          return res.json(subscriptionStatus);
        }
        
        // Buscar detalhes adicionais no Stripe
        const subscriptionDetails = await getSubscriptionDetails(userData.stripe_subscription_id);
        
        if (subscriptionDetails) {
          return res.json({
            ...subscriptionStatus,
            details: subscriptionDetails
          });
        }
      }
      
      // Caso não tenha detalhes adicionais, retornar apenas o status básico
      return res.json(subscriptionStatus);
    } catch (error) {
      console.error('Erro ao buscar informações de assinatura:', error);
      res.status(500).json({ 
        message: 'Erro ao buscar informações de assinatura',
        tier: 'none',
        messageCount: 0,
        maxMessages: 0,
        active: false
      });
    }
  });
  
  app.post("/api/user/language", isAuthenticated, async (req, res) => {
    const schema = z.object({
      language: z.enum(["pt", "en"])
    });
    
    try {
      const { language } = schema.parse(req.body);
      const updatedUser = await storage.updateUser(req.user!.id, { language });
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Log the language change
      await logAction({
        userId: req.user!.id,
        action: "language_changed",
        details: { language },
        ipAddress: req.ip
      });
      
      // Return safe user
      const { password, twofa_secret, ...safeUser } = updatedUser;
      res.json(safeUser);
    } catch (error) {
      res.status(400).json({ message: "Invalid language" });
    }
  });
  
  // Admin routes
  // LLM Configuration
  app.get("/api/admin/llm", isAuthenticated, checkRole("admin"), async (req, res) => {
    const activeLlm = await storage.getActiveLlmConfig();
    
    if (!activeLlm) {
      return res.json({ active: false, message: "No active LLM configuration found" });
    }
    
    // Don't send API key to client
    const { api_key, ...safeLlm } = activeLlm;
    res.json({ 
      active: true, 
      config: {
        ...safeLlm,
        api_key: "••••••••••••••••••••••••••••••" // Mask the API key
      }
    });
  });
  
  app.post("/api/admin/llm", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const data = insertLlmConfigSchema.parse({
        ...req.body,
        created_by: req.user!.id
      });
      
      const newConfig = await storage.createLlmConfig(data);
      
      // Log the action
      await logAction({
        userId: req.user!.id,
        action: "llm_config_created",
        details: { model: data.model_name },
        ipAddress: req.ip
      });
      
      // Don't send API key back
      const { api_key, ...safeConfig } = newConfig;
      res.status(201).json(safeConfig);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid request" });
    }
  });
  
  app.post("/api/admin/llm/test", isAuthenticated, checkRole("admin"), async (req, res) => {
    const schema = z.object({
      model_name: z.string(),
      api_key: z.string()
    });
    
    try {
      const { model_name, api_key } = schema.parse(req.body);
      
      // Test connection using the LLM service (implement this in llm.ts)
      // For now, we'll just assume it's valid
      const isValid = true; // TODO: Replace with actual API test
      
      res.json({ success: isValid });
    } catch (error) {
      res.status(400).json({ message: "Invalid configuration" });
    }
  });
  
  app.put("/api/admin/llm/:id/activate", isAuthenticated, checkRole("admin"), async (req, res) => {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }
    
    const config = await storage.getLlmConfig(id);
    
    if (!config) {
      return res.status(404).json({ message: "Configuration not found" });
    }
    
    const activatedConfig = await storage.setActiveLlmConfig(id);
    
    // Log the action
    await logAction({
      userId: req.user!.id,
      action: "llm_config_activated",
      details: { id, model: config.model_name },
      ipAddress: req.ip
    });
    
    // Don't send API key back
    const { api_key, ...safeConfig } = activatedConfig!;
    res.json(safeConfig);
  });
  
  // Avatar Management
  app.get("/api/avatar", isAuthenticated, async (req, res) => {
    const activeAvatar = await storage.getActiveAvatar();
    
    if (!activeAvatar) {
      // Return default avatar
      return res.json({
        id: 0,
        name: req.user!.language === "pt" ? "Bot ToledoIA" : "ToledoIA Bot",
        image_url: "/default-avatar.svg"
      });
    }
    
    res.json(activeAvatar);
  });
  
  app.post("/api/admin/avatar", isAuthenticated, checkRole("admin"), avatarUpload.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image uploaded" });
      }
      
      const schema = z.object({
        name: z.string().max(50)
      });
      
      const { name } = schema.parse(req.body);
      
      // Get file URL
      const fileUrl = `/uploads/avatars/${path.basename(req.file.path)}`;
      
      const avatarData = {
        name,
        image_url: fileUrl,
        created_by: req.user!.id
      };
      
      const newAvatar = await storage.createAvatar(avatarData);
      
      // Activate the new avatar
      await storage.setActiveAvatar(newAvatar.id);
      
      // Log the action
      await logAction({
        userId: req.user!.id,
        action: "avatar_created",
        details: { name },
        ipAddress: req.ip
      });
      
      res.status(201).json(newAvatar);
    } catch (error) {
      // If there was an error, delete the uploaded file if it exists
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid request" });
    }
  });
  
  app.put("/api/admin/avatar/:id", isAuthenticated, checkRole("admin"), avatarUpload.single("image"), async (req, res) => {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }
    
    try {
      const schema = z.object({
        name: z.string().max(50)
      });
      
      const { name } = schema.parse(req.body);
      
      // Check if avatar exists
      const avatar = await storage.getAvatar(id);
      
      if (!avatar) {
        return res.status(404).json({ message: "Avatar not found" });
      }
      
      // Update data
      let updateData: Partial<typeof avatar> = { name };
      
      // If new image uploaded, update image_url
      if (req.file) {
        const fileUrl = `/uploads/avatars/${path.basename(req.file.path)}`;
        updateData.image_url = fileUrl;
        
        // Delete old avatar file if it's not the default
        if (!avatar.image_url.includes("default-avatar")) {
          const oldFilePath = path.join(UPLOADS_DIR, avatar.image_url.replace("/uploads/", ""));
          fs.unlink(oldFilePath, () => {});
        }
      }
      
      const updatedAvatar = await storage.updateAvatar(id, updateData);
      
      // Log the action
      await logAction({
        userId: req.user!.id,
        action: "avatar_updated",
        details: { id, name },
        ipAddress: req.ip
      });
      
      res.json(updatedAvatar);
    } catch (error) {
      // If there was an error, delete the uploaded file if it exists
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid request" });
    }
  });
  
  app.put("/api/admin/avatar/:id/activate", isAuthenticated, checkRole("admin"), async (req, res) => {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }
    
    const avatar = await storage.getAvatar(id);
    
    if (!avatar) {
      return res.status(404).json({ message: "Avatar not found" });
    }
    
    const activatedAvatar = await storage.setActiveAvatar(id);
    
    // Log the action
    await logAction({
      userId: req.user!.id,
      action: "avatar_activated",
      details: { id, name: avatar.name },
      ipAddress: req.ip
    });
    
    res.json(activatedAvatar);
  });
  
  app.post("/api/admin/avatar/reset", isAuthenticated, checkRole("admin"), async (req, res) => {
    // Create default avatar if none exists
    const defaultAvatar = {
      name: "Bot ToledoIA",
      image_url: "/default-avatar.svg",
      created_by: req.user!.id
    };
    
    const newAvatar = await storage.createAvatar(defaultAvatar);
    await storage.setActiveAvatar(newAvatar.id);
    
    // Log the action
    await logAction({
      userId: req.user!.id,
      action: "avatar_reset",
      details: {},
      ipAddress: req.ip
    });
    
    res.json(newAvatar);
  });
  
  // User management (admin)
  app.get("/api/admin/users", isAuthenticated, checkRole("admin"), async (req, res) => {
    // Get all users (in a real DB you'd want pagination)
    const allUsers = Array.from(Object.values(await storage.getUsers()));
    
    // Filter out sensitive information
    const safeUsers = allUsers.map(user => {
      const { password, twofa_secret, ...safeUser } = user;
      return safeUser;
    });
    
    res.json(safeUsers);
  });
  
  app.put("/api/admin/users/:id/unblock", isAuthenticated, checkRole("admin"), async (req, res) => {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }
    
    const user = await storage.getUser(id);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const unblockedUser = await storage.unblockUser(id);
    
    // Log the action
    await logAction({
      userId: req.user!.id,
      action: "user_unblocked",
      details: { targetUserId: id, email: user.email },
      ipAddress: req.ip
    });
    
    // Return safe user
    const { password, twofa_secret, ...safeUser } = unblockedUser!;
    res.json(safeUser);
  });
  
  // Rotas de assinatura
  
  // Endpoint para criar uma sessão de checkout do Stripe
  app.post("/api/subscription/checkout", isAuthenticated, async (req, res) => {
    try {
      const schema = z.object({
        plan: z.enum(["basic", "intermediate"])
      });
      
      const { plan } = schema.parse(req.body);
      
      // Obter o preço do plano selecionado
      const priceId = plan === "basic"
        ? STRIPE_PRICE_IDS.BASIC
        : STRIPE_PRICE_IDS.INTERMEDIATE;
      
      // Obter ou criar o cliente no Stripe
      const stripeCustomerId = await getOrCreateStripeCustomer(
        req.user!.id.toString(),
        req.user!.email
      );
      
      // Criar a sessão de checkout
      const checkoutUrl = await createCheckoutSession(
        stripeCustomerId,
        priceId,
        req.user!.id.toString()
      );
      
      // Log da ação
      await logAction({
        userId: req.user!.id,
        action: "subscription_checkout_started",
        details: { plan },
        ipAddress: req.ip
      });
      
      res.json({ checkoutUrl });
    } catch (error) {
      console.error('Erro ao criar sessão de checkout:', error);
      res.status(500).json({
        message: 'Erro ao criar sessão de checkout',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  // Endpoint para processar o sucesso do checkout
  app.get("/api/subscription/success", isAuthenticated, async (req, res) => {
    try {
      const sessionId = req.query.session_id as string;
      
      if (!sessionId) {
        return res.status(400).json({ message: 'ID da sessão não fornecido' });
      }
      
      // Obter a sessão do Stripe
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['subscription']
      });
      
      if (!session) {
        return res.status(404).json({ message: 'Sessão não encontrada' });
      }
      
      // Verificar se o usuário da sessão corresponde ao usuário autenticado
      if (session.metadata?.userId !== req.user!.id.toString()) {
        return res.status(403).json({ message: 'Acesso não autorizado a esta sessão' });
      }
      
      // Obter a assinatura
      const subscription = session.subscription as Stripe.Subscription;
      
      if (!subscription) {
        return res.status(400).json({ message: 'Assinatura não encontrada na sessão' });
      }
      
      // Determinar o plano com base no preço
      const priceId = subscription.items.data[0].price.id;
      const tier = priceId === STRIPE_PRICE_IDS.BASIC ? 'basic' : 'intermediate';
      
      // Atualizar o plano do usuário no banco de dados
      await updateUserSubscriptionTier(
        req.user!.id.toString(),
        tier,
        subscription.id
      );
      
      // Log da ação
      await logAction({
        userId: req.user!.id,
        action: "subscription_activated",
        details: { tier, subscriptionId: subscription.id },
        ipAddress: req.ip
      });
      
      // Redirecionar para a página de sucesso
      res.redirect('/subscription/success');
    } catch (error) {
      console.error('Erro ao processar sucesso da assinatura:', error);
      res.status(500).json({
        message: 'Erro ao processar a assinatura',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  // Endpoint para cancelar uma assinatura existente
  app.post("/api/subscription/cancel", isAuthenticated, async (req, res) => {
    try {
      // Verificar se o usuário tem uma assinatura ativa
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('stripe_subscription_id, subscription_tier')
        .eq('id', req.user!.id.toString())
        .single();
      
      if (userError || !userData?.stripe_subscription_id) {
        return res.status(400).json({ message: 'Nenhuma assinatura ativa encontrada' });
      }
      
      // Cancelar a assinatura no Stripe
      await cancelSubscription(userData.stripe_subscription_id);
      
      // Atualizar o usuário no banco de dados
      const { error: updateError } = await supabase
        .from('users')
        .update({
          subscription_tier: 'none',
          stripe_subscription_id: null,
        })
        .eq('id', req.user!.id.toString());
      
      if (updateError) {
        throw new Error(`Erro ao atualizar dados do usuário: ${updateError.message}`);
      }
      
      // Log da ação
      await logAction({
        userId: req.user!.id,
        action: "subscription_cancelled",
        details: { 
          previous_tier: userData.subscription_tier,
          subscription_id: userData.stripe_subscription_id
        },
        ipAddress: req.ip
      });
      
      res.json({ message: 'Assinatura cancelada com sucesso' });
    } catch (error) {
      console.error('Erro ao cancelar assinatura:', error);
      res.status(500).json({
        message: 'Erro ao cancelar assinatura',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  });
  
  // Chat sessions
  app.get("/api/chat/sessions", isAuthenticated, checkRole("technician"), async (req, res) => {
    const sessions = await storage.getUserChatSessions(req.user!.id);
    res.json(sessions);
  });
  
  app.post("/api/chat/sessions", isAuthenticated, checkRole("technician"), async (req, res) => {
    try {
      const data = insertChatSessionSchema.parse({
        user_id: req.user!.id,
        language: req.body.language || req.user!.language
      });
      
      const newSession = await storage.createChatSession(data);
      
      // Add welcome message from bot
      const welcomeMessage = req.user!.language === "pt" 
        ? "Olá! Sou o Bot ToledoIA. Como posso ajudar com sua manutenção hoje? Você pode enviar imagens ou arquivos da placa de circuito para análise."
        : "Hello! I'm the ToledoIA Bot. How can I help with your maintenance today? You can send images or files of the circuit board for analysis.";
      
      await storage.createChatMessage({
        session_id: newSession.id,
        user_id: req.user!.id,
        message_type: "text",
        content: welcomeMessage,
        is_user: false
      });
      
      res.status(201).json(newSession);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid request" });
    }
  });
  
  app.put("/api/chat/sessions/:id/end", isAuthenticated, checkRole("technician"), async (req, res) => {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }
    
    const session = await storage.getChatSession(id);
    
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    
    // Ensure the session belongs to the user
    if (session.user_id !== req.user!.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    
    const endedSession = await storage.endChatSession(id);
    res.json(endedSession);
  });
  
  // Chat messages
  app.get("/api/chat/sessions/:id/messages", isAuthenticated, checkRole("technician"), async (req, res) => {
    const sessionId = parseInt(req.params.id);
    
    if (isNaN(sessionId)) {
      return res.status(400).json({ message: "Invalid session ID" });
    }
    
    const session = await storage.getChatSession(sessionId);
    
    if (!session) {
      return res.status(404).json({ message: "Session not found" });
    }
    
    // Ensure the session belongs to the user
    if (session.user_id !== req.user!.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }
    
    const messages = await storage.getSessionMessages(sessionId);
    res.json(messages);
  });
  
  app.post("/api/chat/sessions/:id/messages", isAuthenticated, checkRole("technician"), upload.single("file"), async (req, res) => {
    const sessionId = parseInt(req.params.id);
    
    if (isNaN(sessionId)) {
      // Delete uploaded file if it exists
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      
      return res.status(400).json({ message: "Invalid session ID" });
    }
    
    const session = await storage.getChatSession(sessionId);
    
    if (!session) {
      // Delete uploaded file if it exists
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      
      return res.status(404).json({ message: "Session not found" });
    }
    
    // Ensure the session belongs to the user
    if (session.user_id !== req.user!.id) {
      // Delete uploaded file if it exists
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      
      return res.status(403).json({ message: "Unauthorized" });
    }
    
    try {
      let messageType = "text";
      let content = req.body.content;
      let fileUrl = null;
      
      // If file uploaded
      if (req.file) {
        messageType = req.file.mimetype.startsWith("image/") ? "image" : "file";
        fileUrl = `/uploads/files/${path.basename(req.file.path)}`;
        content = req.file.originalname;
      }
      
      // Create user message
      const messageData = {
        session_id: sessionId,
        user_id: req.user!.id,
        message_type: messageType,
        content,
        file_url: fileUrl,
        is_user: true
      };
      
      const userMessage = await storage.createChatMessage(messageData);
      
      // Process with LLM if file uploaded
      if (req.file) {
        let botResponse;
        
        if (messageType === "image") {
          botResponse = await analyzeImage(req.file.path, session.language);
        } else {
          botResponse = await analyzeFile(req.file.path, session.language);
        }
        
        // Create bot response message
        await storage.createChatMessage({
          session_id: sessionId,
          user_id: req.user!.id,
          message_type: "text",
          content: botResponse,
          is_user: false
        });
      }
      
      res.status(201).json(userMessage);
    } catch (error) {
      // Delete uploaded file if it exists and there was an error
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid request" });
    }
  });
  
  // Audit logs (admin only)
  app.get("/api/admin/audit", isAuthenticated, checkRole("admin"), async (req, res) => {
    const logs = await storage.getAuditLogs();
    res.json(logs);
  });
  
  // Serve uploaded files
  app.use("/uploads", express.static(UPLOADS_DIR));
  
  // Error handling middleware
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err);
    
    // Handle multer errors
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ 
          message: req.path.includes("/avatar") 
            ? "Avatar image too large. Maximum size is 5MB." 
            : "File too large. Maximum size is 50MB."
        });
      }
      return res.status(400).json({ message: err.message });
    }
    
    res.status(500).json({ message: "Internal server error" });
  });

  const httpServer = createServer(app);

  return httpServer;
}
