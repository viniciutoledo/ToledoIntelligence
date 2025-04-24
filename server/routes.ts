import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, checkRole } from "./auth";
import { analyzeImage, analyzeFile, processTextMessage, testConnection } from "./llm";
import { logAction } from "./audit";
import multer from "multer";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { z } from "zod";

// Função utilitária para converter URLs relativas para absolutas
function ensureAbsoluteUrl(url: string, req: Request): string {
  if (url && url.startsWith('/')) {
    const protocol = req.secure ? 'https://' : 'http://';
    const host = req.get('host') || 'localhost:5000';
    return `${protocol}${host}${url}`;
  }
  return url;
}
import { 
  insertLlmConfigSchema,
  insertAvatarSchema,
  insertChatSessionSchema,
  insertChatMessageSchema,
  insertPlanFeatureSchema,
  insertPlanPricingSchema,
  insertChatWidgetSchema,
  insertWidgetChatSessionSchema,
  insertWidgetChatMessageSchema
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
  // Servir arquivos estáticos da pasta public
  app.use(express.static(path.join(process.cwd(), 'public')));
  
  // Exibir o caminho dos uploads para facilitar acesso através da URL
  console.log(`Servindo arquivos estáticos de ${UPLOADS_DIR} na rota /uploads`);
  app.use('/uploads', express.static(UPLOADS_DIR));
  
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
  
  // Rotas para gerenciamento de planos e recursos
  app.get("/api/plans/features", async (req, res) => {
    try {
      const subscriptionTier = req.query.tier as string || 'none';
      const features = await storage.getPlanFeatures(subscriptionTier);
      res.json(features);
    } catch (error) {
      console.error("Erro ao obter recursos dos planos:", error);
      res.status(500).json({ message: "Erro ao obter recursos dos planos" });
    }
  });
  
  // Rota de admin para gerenciar recursos dos planos
  app.post("/api/admin/plans/features", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const schema = z.object({
        subscription_tier: z.enum(["none", "basic", "intermediate"]),
        feature_key: z.string().min(1),
        feature_name: z.string().min(1),
        feature_description: z.string().nullable().optional(),
        is_enabled: z.boolean().optional()
      });
      
      const featureData = schema.parse(req.body);
      
      const newFeature = await storage.createPlanFeature({
        ...featureData,
        feature_description: featureData.feature_description || null,
        is_enabled: featureData.is_enabled ?? true
      });
      
      // Log da ação
      await logAction({
        userId: req.user!.id,
        action: "plan_feature_created",
        details: { feature_key: featureData.feature_key, tier: featureData.subscription_tier },
        ipAddress: req.ip
      });
      
      res.status(201).json(newFeature);
    } catch (error) {
      console.error("Erro ao criar recurso do plano:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Dados inválidos" });
    }
  });
  
  app.put("/api/admin/plans/features/:id", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }
      
      const schema = z.object({
        subscription_tier: z.enum(["none", "basic", "intermediate"]).optional(),
        feature_key: z.string().min(1).optional(),
        feature_name: z.string().min(1).optional(),
        feature_description: z.string().nullable().optional(),
        is_enabled: z.boolean().optional()
      });
      
      const updateData = schema.parse(req.body);
      
      // Verificar se o recurso existe
      const feature = await storage.getPlanFeature(id);
      if (!feature) {
        return res.status(404).json({ message: "Recurso não encontrado" });
      }
      
      const updatedFeature = await storage.updatePlanFeature(id, updateData);
      
      // Log da ação
      await logAction({
        userId: req.user!.id,
        action: "plan_feature_updated",
        details: { id, ...updateData },
        ipAddress: req.ip
      });
      
      res.json(updatedFeature);
    } catch (error) {
      console.error("Erro ao atualizar recurso do plano:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Dados inválidos" });
    }
  });
  
  app.delete("/api/admin/plans/features/:id", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }
      
      // Verificar se o recurso existe
      const feature = await storage.getPlanFeature(id);
      if (!feature) {
        return res.status(404).json({ message: "Recurso não encontrado" });
      }
      
      await storage.deletePlanFeature(id);
      
      // Log da ação
      await logAction({
        userId: req.user!.id,
        action: "plan_feature_deleted",
        details: { id, feature_key: feature.feature_key },
        ipAddress: req.ip
      });
      
      res.status(204).send();
    } catch (error) {
      console.error("Erro ao excluir recurso do plano:", error);
      res.status(500).json({ message: "Erro ao excluir recurso do plano" });
    }
  });
  
  // Rotas para gerenciamento de preços de planos
  app.get("/api/plans/pricing", async (req, res) => {
    try {
      const subscriptionTier = req.query.tier as string;
      
      if (subscriptionTier) {
        const pricing = await storage.getPlanPricingByTier(subscriptionTier);
        if (!pricing) {
          return res.status(404).json({ message: "Preço para o plano especificado não encontrado" });
        }
        return res.json(pricing);
      } else {
        const allPricing = await storage.getAllPlanPricing();
        return res.json(allPricing);
      }
    } catch (error) {
      console.error("Erro ao obter preços dos planos:", error);
      res.status(500).json({ message: "Erro ao obter preços dos planos" });
    }
  });
  
  app.post("/api/admin/plans/pricing", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const schema = insertPlanPricingSchema.extend({
        subscription_tier: z.enum(["none", "basic", "intermediate"]),
        price: z.number().int().min(0),
        currency: z.enum(["USD", "BRL"]),
      });
      
      const pricingData = schema.parse(req.body);
      
      // Verificar se já existe um preço para este plano
      const existingPricing = await storage.getPlanPricingByTier(pricingData.subscription_tier);
      if (existingPricing) {
        return res.status(409).json({ 
          message: "Já existe um preço configurado para este plano. Use o método PUT para atualizar." 
        });
      }
      
      const newPricing = await storage.createPlanPricing({
        ...pricingData,
        description: pricingData.description || null
      });
      
      // Log da ação
      await logAction({
        userId: req.user!.id,
        action: "plan_pricing_created",
        details: { 
          tier: pricingData.subscription_tier, 
          price: pricingData.price,
          currency: pricingData.currency 
        },
        ipAddress: req.ip
      });
      
      res.status(201).json(newPricing);
    } catch (error) {
      console.error("Erro ao criar preço do plano:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Dados inválidos" });
    }
  });
  
  app.put("/api/admin/plans/pricing/:id", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID inválido" });
      }
      
      const schema = z.object({
        subscription_tier: z.enum(["none", "basic", "intermediate"]).optional(),
        name: z.string().min(1).optional(),
        price: z.number().int().min(0).optional(),
        currency: z.enum(["USD", "BRL"]).optional(),
        description: z.string().nullable().optional()
      });
      
      const updateData = schema.parse(req.body);
      
      // Verificar se o preço existe
      const pricing = await storage.getPlanPricing(id);
      if (!pricing) {
        return res.status(404).json({ message: "Preço não encontrado" });
      }
      
      // Se estiver alterando o tier, verificar se já existe outro para o mesmo tier
      if (updateData.subscription_tier && updateData.subscription_tier !== pricing.subscription_tier) {
        const existingPricing = await storage.getPlanPricingByTier(updateData.subscription_tier);
        if (existingPricing && existingPricing.id !== id) {
          return res.status(409).json({ 
            message: "Já existe um preço configurado para este plano." 
          });
        }
      }
      
      const updatedPricing = await storage.updatePlanPricing(id, updateData);
      
      // Log da ação
      await logAction({
        userId: req.user!.id,
        action: "plan_pricing_updated",
        details: { 
          pricing_id: id, 
          updates: updateData 
        },
        ipAddress: req.ip
      });
      
      res.json(updatedPricing);
    } catch (error) {
      console.error("Erro ao atualizar preço do plano:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Dados inválidos" });
    }
  });
  
  // Resetar contador de mensagens
  app.post("/api/admin/users/:id/reset-message-count", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "ID de usuário inválido" });
      }
      
      // Verificar se o usuário existe
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      const updatedUser = await storage.updateUser(userId, { message_count: 0 });
      
      // Log da ação
      await logAction({
        userId: req.user!.id,
        action: "user_message_count_reset",
        details: { target_user_id: userId, email: user.email },
        ipAddress: req.ip
      });
      
      // Remove dados sensíveis
      const { password, twofa_secret, ...safeUser } = updatedUser!;
      
      res.json(safeUser);
    } catch (error) {
      console.error("Erro ao resetar contador de mensagens:", error);
      res.status(500).json({ message: "Erro ao resetar contador de mensagens" });
    }
  });
  
  // Atualizar plano do usuário
  app.put("/api/admin/users/:id/subscription", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "ID de usuário inválido" });
      }
      
      const schema = z.object({
        subscription_tier: z.enum(["none", "basic", "intermediate"])
      });
      
      const { subscription_tier } = schema.parse(req.body);
      
      // Verificar se o usuário existe
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      // Determinar o novo limite de mensagens com base no plano
      let max_messages = 50; // plano gratuito
      
      if (subscription_tier === "basic") {
        max_messages = 2500;
      } else if (subscription_tier === "intermediate") {
        max_messages = 5000;
      }
      
      const updatedUser = await storage.updateUser(userId, { 
        subscription_tier,
        max_messages
      });
      
      // Log da ação
      await logAction({
        userId: req.user!.id,
        action: "user_subscription_updated",
        details: { 
          target_user_id: userId, 
          email: user.email, 
          old_tier: user.subscription_tier, 
          new_tier: subscription_tier 
        },
        ipAddress: req.ip
      });
      
      // Remove dados sensíveis
      const { password, twofa_secret, ...safeUser } = updatedUser!;
      
      res.json(safeUser);
    } catch (error) {
      console.error("Erro ao atualizar plano do usuário:", error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Dados inválidos" });
    }
  });
  
  app.get("/api/user/check-feature-access/:featureKey", isAuthenticated, async (req, res) => {
    try {
      const { featureKey } = req.params;
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      // Verificar se o usuário tem acesso a esta funcionalidade
      const hasAccess = await storage.checkFeatureAccess(user.id, featureKey);
      res.json({ hasAccess });
    } catch (error) {
      console.error("Erro ao verificar acesso a recurso:", error);
      res.status(500).json({ message: "Erro ao verificar acesso a recurso" });
    }
  });
  
  // Verificação de limite de mensagens
  app.get("/api/user/check-message-limit", isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      const hasReachedLimit = user.message_count >= user.max_messages;
      
      res.json({
        hasReachedLimit,
        messageCount: user.message_count,
        maxMessages: user.max_messages,
        remainingMessages: Math.max(0, user.max_messages - user.message_count)
      });
    } catch (error) {
      console.error("Erro ao verificar limite de mensagens:", error);
      res.status(500).json({ message: "Erro ao verificar limite de mensagens" });
    }
  });
  
  // Incrementar contador de mensagens
  app.post("/api/user/increment-message-count", isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      // Verificar se o usuário já atingiu o limite
      if (user.message_count >= user.max_messages) {
        return res.status(403).json({ 
          message: "Limite de mensagens atingido",
          messageCount: user.message_count,
          maxMessages: user.max_messages,
          hasReachedLimit: true
        });
      }
      
      // Incrementar o contador de mensagens
      const updatedUser = await storage.updateUser(user.id, {
        message_count: user.message_count + 1
      });
      
      if (!updatedUser) {
        return res.status(500).json({ message: "Erro ao atualizar contador de mensagens" });
      }
      
      const hasReachedLimit = updatedUser.message_count >= updatedUser.max_messages;
      
      res.json({
        messageCount: updatedUser.message_count,
        maxMessages: updatedUser.max_messages,
        hasReachedLimit,
        remainingMessages: Math.max(0, updatedUser.max_messages - updatedUser.message_count)
      });
    } catch (error) {
      console.error("Erro ao incrementar contador de mensagens:", error);
      res.status(500).json({ message: "Erro ao incrementar contador de mensagens" });
    }
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
      
      // Test connection using both OpenAI and Anthropic APIs
      const isValid = await testConnection(api_key, model_name);
      
      res.json({ success: isValid });
    } catch (error) {
      console.error('Error testing LLM connection:', error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid configuration" });
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
        name: z.string().max(50),
        welcomeMessage: z.string().max(200).optional(),
      });
      
      const { name, welcomeMessage } = schema.parse(req.body);
      
      // Get file URL
      const fileUrl = `/uploads/avatars/${path.basename(req.file.path)}`;
      
      const avatarData = {
        name,
        image_url: fileUrl,
        welcome_message: welcomeMessage,
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
        name: z.string().max(50),
        welcomeMessage: z.string().max(200).optional(),
      });
      
      const { name, welcomeMessage } = schema.parse(req.body);
      
      // Check if avatar exists
      const avatar = await storage.getAvatar(id);
      
      if (!avatar) {
        return res.status(404).json({ message: "Avatar not found" });
      }
      
      // Update data
      let updateData: Partial<typeof avatar> = { 
        name,
        welcome_message: welcomeMessage
      };
      
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
      welcome_message: "Olá! Eu sou o assistente de IA que irá ajudar você a analisar placas de circuito.",
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
  
  // Dashboard stats (admin)
  app.get("/api/admin/stats", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const allUsers = await storage.getUsers();
      
      // Obter estatísticas de chat
      const chatSessions = await storage.getChatSessions();
      const activeSessions = chatSessions.filter(session => !session.ended_at);
      const chatMessages = await storage.getAllChatMessages();
      
      // Obter estatísticas de widgets
      const widgets = await storage.getAllChatWidgets();
      const activeWidgets = widgets.filter(widget => widget.is_active);
      const widgetSessions = await storage.getAllWidgetChatSessions();
      const widgetMessages = await storage.getAllWidgetChatMessages();
      
      // Calcular usuários impactados pelos widgets (visitantes únicos)
      const uniqueVisitorIds = new Set(widgetSessions.map(session => session.visitor_id));
      
      // Calcular tempo médio de resposta
      const aiResponseTimes = chatMessages
        .filter(msg => !msg.is_user && msg.response_time)
        .map(msg => msg.response_time || 0);
      
      const avgResponseTime = aiResponseTimes.length > 0 
        ? aiResponseTimes.reduce((acc, time) => acc + time, 0) / aiResponseTimes.length 
        : 0;
      
      // Calculate dashboard stats
      const stats = {
        userCount: allUsers.length,
        technicianCount: allUsers.filter(user => user.role === "technician").length,
        adminCount: allUsers.filter(user => user.role === "admin").length,
        activeUsers: allUsers.filter(user => !user.is_blocked).length,
        blockedUsers: allUsers.filter(user => user.is_blocked).length,
        totalChatSessions: chatSessions.length,
        activeChatSessions: activeSessions.length,
        messageCount: chatMessages.length,
        averageResponseTime: avgResponseTime,
        
        // Estatísticas de widgets
        widgetCount: widgets.length,
        activeWidgets: activeWidgets.length,
        widgetSessions: widgetSessions.length,
        widgetMessages: widgetMessages.length,
        widgetUsersImpacted: uniqueVisitorIds.size,
      };
      
      res.json(stats);
    } catch (error) {
      console.error("Erro ao obter estatísticas:", error);
      res.status(500).json({ 
        message: "Erro ao obter estatísticas",
        error: error.message
      });
    }
  });

  // Audit logs (admin)
  app.get("/api/admin/logs", isAuthenticated, checkRole("admin"), async (req, res) => {
    const logs = await storage.getAuditLogs();
    res.json(logs);
  });
  
  // Endpoint para gerar logs de auditoria para exemplo
  app.post("/api/admin/create-example-logs", isAuthenticated, checkRole("admin"), async (req, res) => {
    // Cria logs de exemplo para visualização no painel administrativo
    const actions = [
      "user_login",
      "user_registered", 
      "llm_config_updated",
      "avatar_updated",
      "chat_session_started",
      "subscription_activated"
    ];
    
    const userId = req.user!.id;
    
    for (const action of actions) {
      await logAction({
        userId,
        action,
        details: { example: true, timestamp: new Date().toISOString() },
        ipAddress: req.ip
      });
    }
    
    res.json({ success: true, count: actions.length });
  });
  
  // User management (admin)
  app.get("/api/admin/users", isAuthenticated, checkRole("admin"), async (req, res) => {
    // Get all users (in a real DB you'd want pagination)
    const allUsers = await storage.getUsers();
    
    // Filter out sensitive information
    const safeUsers = allUsers.map(user => {
      const { password, twofa_secret, ...safeUser } = user;
      return safeUser;
    });
    
    res.json(safeUsers);
  });
  
  app.put("/api/admin/users/:id/block", isAuthenticated, checkRole("admin"), async (req, res) => {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }
    
    const user = await storage.getUser(id);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const blockedUser = await storage.blockUser(id);
    
    // Log the action
    await logAction({
      userId: req.user!.id,
      action: "user_blocked",
      details: { targetUserId: id, email: user.email },
      ipAddress: req.ip
    });
    
    // Return safe user
    const { password, twofa_secret, ...safeUser } = blockedUser!;
    res.json(safeUser);
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
  
  // Atualização de usuário pelo administrador
  app.put("/api/admin/users/:id", isAuthenticated, checkRole("admin"), async (req, res) => {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }
    
    try {
      const schema = z.object({
        email: z.string().email().optional(),
        role: z.enum(["technician", "admin"]).optional(),
        language: z.enum(["pt", "en"]).optional(),
        subscription_tier: z.enum(["none", "basic", "intermediate"]).optional(),
        max_messages: z.number().optional(),
        message_count: z.number().optional(),
      });
      
      const data = schema.parse(req.body);
      const user = await storage.getUser(id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Evitar que o usuário bloqueie a si mesmo
      if (id === req.user!.id && data.role && data.role !== user.role) {
        return res.status(400).json({ message: "Cannot change your own role" });
      }
      
      const updatedUser = await storage.updateUser(id, data);
      
      // Log da ação
      await logAction({
        userId: req.user!.id,
        action: "user_updated",
        details: { targetUserId: id, email: user.email, changes: data },
        ipAddress: req.ip
      });
      
      // Retornar usuário sem dados sensíveis
      const { password, twofa_secret, ...safeUser } = updatedUser;
      res.json(safeUser);
    } catch (error) {
      return res.status(400).json({ message: error instanceof Error ? error.message : "Invalid data" });
    }
  });
  
  // Deletar usuário (apenas admin pode fazer isso)
  app.delete("/api/admin/users/:id", isAuthenticated, checkRole("admin"), async (req, res) => {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }
    
    // Evitar que o admin exclua a si mesmo
    if (id === req.user!.id) {
      return res.status(400).json({ message: "Cannot delete your own account" });
    }
    
    const user = await storage.getUser(id);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    await storage.deleteUser(id);
    
    // Log da ação
    await logAction({
      userId: req.user!.id,
      action: "user_deleted",
      details: { targetUserId: id, email: user.email },
      ipAddress: req.ip
    });
    
    res.status(200).json({ success: true });
  });
  
  // Rotas de assinatura
  
  // Endpoint para criar uma assinatura diretamente pela API
  app.post("/api/create-subscription", isAuthenticated, async (req, res) => {
    try {
      const schema = z.object({
        priceId: z.string()
      });
      
      const { priceId } = schema.parse(req.body);
      
      // Validar se o priceId é um dos planos válidos
      const isValidPriceId = Object.values(STRIPE_PRICE_IDS).includes(priceId);
      if (!isValidPriceId) {
        return res.status(400).json({ message: "Invalid price ID" });
      }
      
      // Obter ou criar cliente Stripe
      const stripeCustomerId = await getOrCreateStripeCustomer(
        req.user!.id.toString(),
        req.user!.email
      );
      
      // Criar assinatura com pagamento incompleto
      const subscription = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
      });
      
      // Atualizar usuário com as informações da assinatura
      await updateUserSubscriptionTier(
        req.user!.id.toString(),
        stripeCustomerId,
        subscription.id,
        priceId === STRIPE_PRICE_IDS.BASIC ? 'basic' : 'intermediate'
      );
      
      // Log da ação
      await logAction({
        userId: req.user!.id,
        action: "subscription_started",
        details: { 
          priceId,
          subscriptionId: subscription.id
        },
        ipAddress: req.ip
      });
      
      // Obter detalhes do plano para exibição
      const planName = priceId === STRIPE_PRICE_IDS.BASIC ? 
        "Plano Básico" : "Plano Intermediário";
      
      const planPrice = priceId === STRIPE_PRICE_IDS.BASIC ? 
        "R$29,90/mês" : "R$39,90/mês";
        
      const planDescription = priceId === STRIPE_PRICE_IDS.BASIC ? 
        "2.500 interações por mês" : "5.000 interações por mês";
      
      // Retornar as informações necessárias para o checkout
      const invoice = subscription.latest_invoice as any;
      const clientSecret = invoice.payment_intent.client_secret;
      
      res.json({
        subscriptionId: subscription.id,
        clientSecret,
        planName,
        planPrice,
        planDescription
      });
    } catch (error) {
      console.error("Erro ao criar assinatura:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Error creating subscription" 
      });
    }
  });
  
  // Endpoint para criar uma sessão de checkout do Stripe (método antigo)
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
      const subscription = session.subscription as any;
      
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
      
      // Obter o avatar ativo e usar sua mensagem de boas-vindas personalizada
      const activeAvatar = await storage.getActiveAvatar();
      
      // Add welcome message from bot
      let welcomeMessage = "";
      
      // Usar a mensagem de boas-vindas personalizada do avatar se estiver disponível
      if (activeAvatar && activeAvatar.welcome_message) {
        welcomeMessage = activeAvatar.welcome_message;
      } else {
        // Mensagem padrão como fallback
        welcomeMessage = req.user!.language === "pt" 
          ? "Olá! Sou o Bot ToledoIA. Como posso ajudar com sua manutenção hoje? Você pode enviar imagens ou arquivos da placa de circuito para análise."
          : "Hello! I'm the ToledoIA Bot. How can I help with your maintenance today? You can send images or files of the circuit board for analysis.";
      }
      
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
        message_type: messageType as "text" | "image" | "file",
        content,
        file_url: fileUrl,
        is_user: true
      };
      
      const userMessage = await storage.createChatMessage(messageData);
      
      // Process content with LLM - both files and text messages
      let botResponse;
      
      if (req.file) {
        // Process file
        console.log("Arquivo enviado:", {
          originalName: req.file.originalname,
          filename: req.file.filename,
          path: req.file.path,
          mimetype: req.file.mimetype,
          size: req.file.size
        });
        
        let filePath = req.file.path;
        
        // Verificar se o arquivo existe
        if (!fs.existsSync(filePath)) {
          console.error(`Arquivo não encontrado: ${filePath}`);
          
          // Tentar diferentes caminhos
          const possiblePaths = [
            path.join(process.cwd(), 'uploads', 'files', path.basename(req.file.path)),
            path.join('/home/runner/workspace/uploads/files', path.basename(req.file.path)),
            path.join(UPLOADS_DIR, 'files', path.basename(req.file.path))
          ];
          
          console.log("Tentando caminhos alternativos:");
          for (const altPath of possiblePaths) {
            console.log(`- ${altPath} (existe: ${fs.existsSync(altPath)})`);
            if (fs.existsSync(altPath)) {
              filePath = altPath;
              console.log(`Usando caminho alternativo: ${filePath}`);
              break;
            }
          }
        }
        
        try {
          console.log(`Processando arquivo ${filePath} com LLM (tipo: ${messageType})`);
          
          if (messageType === "image") {
            botResponse = await analyzeImage(filePath, session.language);
          } else {
            botResponse = await analyzeFile(filePath, session.language);
          }
        } catch (llmError) {
          console.error("Erro ao processar arquivo com LLM:", llmError);
          botResponse = session.language === 'pt' 
            ? "Desculpe, houve um erro ao processar este arquivo. Por favor, tente novamente."
            : "Sorry, there was an error processing this file. Please try again.";
        }
      } else if (content && content.trim() !== '') {
        // Process text message
        try {
          console.log("Processando mensagem de texto:", {
            length: content.length,
            preview: content.substring(0, 100) + (content.length > 100 ? "..." : "")
          });
          
          botResponse = await processTextMessage(content, session.language);
          
          console.log("Resposta da LLM recebida para mensagem de texto:", {
            length: botResponse.length,
            preview: botResponse.substring(0, 100) + "..."
          });
        } catch (textError) {
          console.error("Erro ao processar mensagem de texto com LLM:", textError);
          botResponse = session.language === 'pt'
            ? "Desculpe, houve um erro ao processar sua mensagem. Por favor, tente novamente."
            : "Sorry, there was an error processing your message. Please try again.";
        }
      }
      
      // Create bot response message if we have one
      if (botResponse) {
        console.log("Resposta da LLM recebida:", {
          length: botResponse.length,
          preview: botResponse.substring(0, 100) + "..."
        });
        
        await storage.createChatMessage({
          session_id: sessionId,
          user_id: req.user!.id,
          message_type: "text" as "text",
          content: botResponse,
          is_user: false
        });
      }
      
      res.status(201).json(userMessage);
    } catch (error) {
      console.error("Erro ao processar upload:", error);
      
      // Delete uploaded file if it exists and there was an error
      if (req.file) {
        try {
          if (fs.existsSync(req.file.path)) {
            fs.unlink(req.file.path, () => {
              console.log(`Arquivo excluído após erro: ${req.file.path}`);
            });
          }
        } catch (unlinkError) {
          console.error("Erro ao tentar excluir arquivo:", unlinkError);
        }
      }
      
      res.status(400).json({ 
        message: error instanceof Error ? error.message : "Invalid request",
        errorDetails: error instanceof Error ? error.stack : null
      });
    }
  });
  
  // Audit logs (admin only)
  app.get("/api/admin/audit", isAuthenticated, checkRole("admin"), async (req, res) => {
    const logs = await storage.getAuditLogs();
    res.json(logs);
  });
  
  // Training document routes
  app.get("/api/training/documents", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      console.log("Buscando documentos de treinamento. Usuário:", req.user?.id, req.user?.email);
      const documents = await storage.getTrainingDocuments();
      console.log(`Encontrados ${documents.length} documentos de treinamento`);
      res.json(documents);
    } catch (error) {
      console.error("Erro ao buscar documentos de treinamento:", error);
      res.status(500).json({ message: "Error fetching training documents", error: error.message });
    }
  });
  
  app.get("/api/training/documents/:id", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      console.log("Buscando documento de treinamento específico. ID:", req.params.id);
      const document = await storage.getTrainingDocument(parseInt(req.params.id));
      if (!document) {
        console.log("Documento não encontrado:", req.params.id);
        return res.status(404).json({ message: "Document not found" });
      }
      res.json(document);
    } catch (error) {
      console.error("Erro ao buscar documento de treinamento:", error);
      res.status(500).json({ message: "Error fetching training document", error: error.message });
    }
  });
  
  app.post("/api/training/documents", isAuthenticated, checkRole("admin"), upload.single("file"), async (req, res) => {
    try {
      console.log("Criando novo documento de treinamento. Usuário:", req.user?.id, req.user?.email);
      console.log("Body recebido:", req.body);
      console.log("Arquivo recebido:", req.file);
      
      const { name, description, document_type } = req.body;
      
      let content = null;
      let file_url = null;
      let website_url = null;
      
      if (document_type === "text") {
        content = req.body.content;
      } else if (document_type === "file" && req.file) {
        file_url = `/uploads/${req.file.filename}`;
      } else if (document_type === "website") {
        website_url = req.body.website_url;
      }
      
      console.log("Dados para criação do documento:", {
        name,
        description,
        document_type,
        content: content ? "Conteúdo existe" : null,
        file_url,
        website_url,
        created_by: req.user?.id
      });
      
      const document = await storage.createTrainingDocument({
        name,
        description,
        document_type: document_type as any,
        content,
        file_url,
        website_url,
        created_by: req.user!.id
      });
      
      // Add to categories if specified
      const categories = req.body.categories ? JSON.parse(req.body.categories) : [];
      for (const categoryId of categories) {
        await storage.addDocumentToCategory(document.id, parseInt(categoryId));
      }
      
      // Process document asynchronously based on type
      // This would be implemented separately in a worker thread or queue
      
      res.status(201).json(document);
    } catch (error) {
      res.status(500).json({ message: "Error creating training document" });
    }
  });
  
  app.put("/api/training/documents/:id", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, description } = req.body;
      
      const document = await storage.updateTrainingDocument(id, {
        name,
        description,
        updated_at: new Date()
      });
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      res.json(document);
    } catch (error) {
      res.status(500).json({ message: "Error updating training document" });
    }
  });
  
  app.delete("/api/training/documents/:id", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteTrainingDocument(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Error deleting training document" });
    }
  });
  
  // Training category routes
  app.get("/api/training/categories", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const categories = await storage.getTrainingCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Error fetching training categories" });
    }
  });
  
  app.get("/api/training/categories/:id", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const category = await storage.getTrainingCategory(parseInt(req.params.id));
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      res.status(500).json({ message: "Error fetching training category" });
    }
  });
  
  app.post("/api/training/categories", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const { name, description } = req.body;
      
      const category = await storage.createTrainingCategory({
        name,
        description,
        created_by: req.user!.id
      });
      
      res.status(201).json(category);
    } catch (error) {
      res.status(500).json({ message: "Error creating training category" });
    }
  });
  
  app.put("/api/training/categories/:id", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, description } = req.body;
      
      const category = await storage.updateTrainingCategory(id, {
        name,
        description,
        updated_at: new Date()
      });
      
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }
      
      res.json(category);
    } catch (error) {
      res.status(500).json({ message: "Error updating training category" });
    }
  });
  
  app.delete("/api/training/categories/:id", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteTrainingCategory(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Error deleting training category" });
    }
  });
  
  // Document-category association routes
  app.post("/api/training/documents/:documentId/categories/:categoryId", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const documentId = parseInt(req.params.documentId);
      const categoryId = parseInt(req.params.categoryId);
      
      const association = await storage.addDocumentToCategory(documentId, categoryId);
      res.status(201).json(association);
    } catch (error) {
      res.status(500).json({ message: "Error adding document to category" });
    }
  });
  
  app.delete("/api/training/documents/:documentId/categories/:categoryId", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const documentId = parseInt(req.params.documentId);
      const categoryId = parseInt(req.params.categoryId);
      
      await storage.removeDocumentFromCategory(documentId, categoryId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Error removing document from category" });
    }
  });
  
  app.get("/api/training/documents/:documentId/categories", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const documentId = parseInt(req.params.documentId);
      const categories = await storage.getDocumentCategories(documentId);
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Error fetching document categories" });
    }
  });
  
  app.get("/api/training/categories/:categoryId/documents", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const categoryId = parseInt(req.params.categoryId);
      const documents = await storage.getCategoryDocuments(categoryId);
      res.json(documents);
    } catch (error) {
      res.status(500).json({ message: "Error fetching category documents" });
    }
  });
  
  // Rotas para relatórios de análise (exclusivos do plano intermediário)
  app.get("/api/reports", isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      // Verificar se o usuário tem acesso a relatórios avançados
      const hasAccessToReports = await storage.checkFeatureAccess(user.subscription_tier, "reports");
      if (!hasAccessToReports) {
        return res.status(403).json({ 
          message: "Esta funcionalidade não está disponível no seu plano atual"
        });
      }
      
      // Buscar relatórios do usuário
      const reports = await storage.getUserReports(user.id);
      res.json(reports);
    } catch (error) {
      console.error("Erro ao buscar relatórios:", error);
      res.status(500).json({ message: "Erro ao buscar relatórios" });
    }
  });
  
  app.post("/api/reports", isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      // Verificar se o usuário tem acesso a relatórios avançados
      const hasAccessToReports = await storage.checkFeatureAccess(user.subscription_tier, "reports");
      if (!hasAccessToReports) {
        return res.status(403).json({ 
          message: "Esta funcionalidade não está disponível no seu plano atual"
        });
      }
      
      const schema = z.object({
        title: z.string().min(1).max(100),
        content: z.string().min(1),
        report_type: z.enum(["basic", "advanced"]),
        message_id: z.number().optional(),
        image_url: z.string().optional()
      });
      
      const reportData = schema.parse(req.body);
      
      // Criar relatório
      const newReport = await storage.createReport({
        ...reportData,
        user_id: user.id
      });
      
      // Log da ação
      await logAction({
        userId: user.id,
        action: "report_created",
        details: { report_id: newReport.id, report_type: reportData.report_type },
        ipAddress: req.ip
      });
      
      res.status(201).json(newReport);
    } catch (error) {
      console.error("Erro ao criar relatório:", error);
      res.status(500).json({ message: "Erro ao criar relatório" });
    }
  });
  
  app.post("/api/reports/:id/export", isAuthenticated, async (req, res) => {
    try {
      const reportId = parseInt(req.params.id);
      if (isNaN(reportId)) {
        return res.status(400).json({ message: "ID de relatório inválido" });
      }
      
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      // Verificar se o usuário tem acesso a exportação de relatórios
      const hasAccessToExports = await storage.checkFeatureAccess(user.subscription_tier, "report_exports");
      if (!hasAccessToExports) {
        return res.status(403).json({ 
          message: "Esta funcionalidade não está disponível no seu plano atual"
        });
      }
      
      const schema = z.object({
        format: z.enum(["pdf", "html", "docx"])
      });
      
      const { format } = schema.parse(req.body);
      
      // Verificar se o relatório existe e pertence ao usuário
      const report = await storage.getReport(reportId);
      if (!report || report.user_id !== user.id) {
        return res.status(404).json({ message: "Relatório não encontrado" });
      }
      
      // Exportar relatório (simulado por enquanto)
      const exportUrl = `/exports/reports/${reportId}_${Date.now()}.${format}`;
      
      // Atualizar relatório com informações de exportação
      const updatedReport = await storage.updateReport(reportId, {
        is_exported: true,
        export_format: format,
        exported_at: new Date(),
        exported_url: exportUrl
      });
      
      // Log da ação
      await logAction({
        userId: user.id,
        action: "report_exported",
        details: { report_id: reportId, format },
        ipAddress: req.ip
      });
      
      res.json({
        success: true,
        report: updatedReport,
        export_url: exportUrl
      });
    } catch (error) {
      console.error("Erro ao exportar relatório:", error);
      res.status(500).json({ message: "Erro ao exportar relatório" });
    }
  });
  
  // Suporte prioritário (exclusivo do plano intermediário)
  app.post("/api/support/tickets", isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      const schema = z.object({
        subject: z.string().min(1).max(100),
        message: z.string().min(1).max(1000),
        priority: z.enum(["normal", "high"]).optional()
      });
      
      const ticketData = schema.parse(req.body);
      
      // Se solicitou alta prioridade, verificar acesso premium
      if (ticketData.priority === "high") {
        const hasPrioritySupport = await storage.checkFeatureAccess(user.subscription_tier, "priority_support");
        if (!hasPrioritySupport) {
          // Permitir o ticket, mas forçar prioridade normal
          ticketData.priority = "normal";
        }
      }
      
      // Criar ticket
      const newTicket = await storage.createSupportTicket({
        ...ticketData,
        priority: ticketData.priority || "normal",
        user_id: user.id,
        status: "pending"
      });
      
      // Log da ação
      await logAction({
        userId: user.id,
        action: "support_ticket_created",
        details: { ticket_id: newTicket.id, priority: newTicket.priority },
        ipAddress: req.ip
      });
      
      res.status(201).json(newTicket);
    } catch (error) {
      console.error("Erro ao criar ticket de suporte:", error);
      res.status(500).json({ message: "Erro ao criar ticket de suporte" });
    }
  });
  
  // Rota especial para verificar e listar usuários (temporária para diagnóstico)
  app.get("/api/users-check", isAuthenticated, async (req, res) => {
    try {
      const users = await storage.getUsers();
      
      // Retorna apenas informações básicas e seguras
      const safeUsers = users.map(user => ({
        id: user.id,
        email: user.email,
        role: user.role,
        subscription_tier: user.subscription_tier
      }));
      
      res.json(safeUsers);
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
      res.status(500).json({ message: "Erro ao buscar usuários" });
    }
  });
  
  // Rota especial para corrigir papel do usuário específico 
  // Rota pública para diagnóstico
  app.post("/api/fix-user-role", async (req, res) => {
    try {
      const email = req.body.email;
      const newRole = req.body.role;
      
      if (!email || !newRole || (newRole !== "technician" && newRole !== "admin")) {
        return res.status(400).json({ message: "Email e papel válido (technician ou admin) são obrigatórios" });
      }
      
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      // Atualiza o papel do usuário
      const updatedUser = await storage.updateUser(user.id, { role: newRole });
      
      // Log da ação (sem userId pois é rota pública)
      await logAction({
        action: "user_role_updated_diagnostic",
        details: { userId: user.id, email: user.email, oldRole: user.role, newRole },
        ipAddress: req.ip
      });
      
      res.json({ 
        message: `Papel do usuário ${email} atualizado para ${newRole}`,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          role: updatedUser.role
        }
      });
    } catch (error) {
      console.error("Erro ao atualizar papel do usuário:", error);
      res.status(500).json({ message: "Erro ao atualizar papel do usuário" });
    }
  });
  
  // Serve uploaded files
  app.use("/uploads", express.static(UPLOADS_DIR));
  console.log(`Servindo arquivos estáticos de ${UPLOADS_DIR} na rota /uploads`);
  
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

  // ===== ROTAS PARA WIDGETS =====
  
  // Rota para listar todos os widgets do usuário logado
  app.get("/api/widgets", isAuthenticated, async (req, res) => {
    try {
      const widgets = await storage.getUserChatWidgets(req.user!.id);
      res.json(widgets);
    } catch (error) {
      console.error("Erro ao obter widgets:", error);
      res.status(500).json({ message: "Erro ao obter widgets" });
    }
  });
  
  // Rota para obter um widget específico
  app.get("/api/widgets/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const widget = await storage.getChatWidget(id);
      
      if (!widget) {
        return res.status(404).json({ message: "Widget não encontrado" });
      }
      
      // Verificar se o widget pertence ao usuário logado
      if (widget.user_id !== req.user!.id && req.user!.role !== "admin") {
        return res.status(403).json({ message: "Sem permissão para acessar este widget" });
      }
      
      res.json(widget);
    } catch (error) {
      console.error("Erro ao obter widget:", error);
      res.status(500).json({ message: "Erro ao obter widget" });
    }
  });
  
  // Rota para criar um novo widget
  app.post("/api/widgets", isAuthenticated, upload.single('avatar_image'), async (req, res) => {
    try {
      // Debug do corpo da requisição
      console.log("Body da requisição de criação de widget:", req.body);
      console.log("Arquivo enviado:", req.file);
      
      // Esquema de validação mais flexível
      const schema = z.object({
        name: z.string().min(1).max(100),
        greeting: z.string().optional().default("Olá! Como posso ajudar?"),
        avatar_url: z.string().optional().default("https://ui-avatars.com/api/?name=T&background=6366F1&color=fff"),
        theme_color: z.string().optional().default("#6366F1"),
        allowed_domains: z.union([
          z.array(z.string()),
          z.string().transform(str => {
            try {
              return JSON.parse(str);
            } catch {
              return [];
            }
          })
        ]).optional().default([]),
      });
      
      // Validar os dados enviados pelo cliente
      try {
        // Garantir que req.body.name não seja undefined
        if (!req.body.name) {
          req.body.name = "Meu Widget";
        }
        
        var validatedData = schema.parse(req.body);
        console.log("Dados validados:", validatedData);
      } catch (validationError) {
        console.error("Erro de validação:", validationError);
        throw validationError;
      }
      
      // Criar objeto com os dados do widget, incluindo o user_id do usuário autenticado
      const widgetData = {
        user_id: req.user!.id,
        name: validatedData.name,
        greeting: validatedData.greeting,
        theme_color: validatedData.theme_color,
        allowed_domains: Array.isArray(validatedData.allowed_domains) ? validatedData.allowed_domains : []
      };
      
      // Se tiver arquivo de avatar, processar e armazenar em base64
      if (req.file) {
        // Ler o arquivo e converter para base64
        const fs = require('fs');
        const filePath = req.file.path;
        
        try {
          // Ler o arquivo
          const fileData = fs.readFileSync(filePath);
          // Converter para base64
          const base64Data = fileData.toString('base64');
          
          // Armazenar os dados da imagem e o tipo MIME
          widgetData.avatar_data = base64Data;
          widgetData.avatar_mime_type = req.file.mimetype;
          
          // Configurar a URL para a rota que servirá a imagem
          widgetData.avatar_url = `/api/widgets/${widgetData.id}/avatar`;
          
          // Remover arquivo temporário do sistema de arquivos
          fs.unlinkSync(filePath);
        } catch (e) {
          console.error("Erro ao processar arquivo de avatar:", e);
          // Em caso de erro, usar avatar padrão
          const firstLetter = widgetData.name.charAt(0).toUpperCase();
          widgetData.avatar_url = `https://ui-avatars.com/api/?name=${firstLetter}&background=6366F1&color=fff`;
        }
      } else if (validatedData.avatar_url) {
        widgetData.avatar_url = validatedData.avatar_url;
      } else {
        // Usar um avatar padrão com a primeira letra do nome
        const firstLetter = widgetData.name.charAt(0).toUpperCase();
        widgetData.avatar_url = `https://ui-avatars.com/api/?name=${firstLetter}&background=6366F1&color=fff`;
      }
      
      // Verificar limite de mensagens
      const canSendMessages = await storage.checkMessageLimit(req.user!.id);
      if (!canSendMessages) {
        return res.status(403).json({ 
          message: "Você atingiu o limite de mensagens do seu plano. Faça upgrade para continuar." 
        });
      }
      
      console.log("Dados finais para criar widget:", widgetData);
      
      // Criar o widget
      const newWidget = await storage.createChatWidget(widgetData);
      
      // Log da ação
      await logAction({
        userId: req.user!.id,
        action: "widget_created",
        details: { widget_id: newWidget.id, widget_name: newWidget.name },
        ipAddress: req.ip
      });
      
      res.status(201).json(newWidget);
    } catch (error) {
      console.error("Erro ao criar widget:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Dados inválidos", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Erro ao criar widget" });
    }
  });
  
  // Rota para atualizar um widget existente
  app.put("/api/widgets/:id", isAuthenticated, upload.single('avatar_image'), async (req, res) => {
    try {
      const { id } = req.params;
      
      // Debug do corpo da requisição
      console.log("Body da requisição de atualização de widget:", req.body);
      console.log("Arquivo enviado:", req.file);
      
      // Verificar se o widget existe
      const widget = await storage.getChatWidget(id);
      if (!widget) {
        return res.status(404).json({ message: "Widget não encontrado" });
      }
      
      // Verificar se o widget pertence ao usuário logado
      if (widget.user_id !== req.user!.id && req.user!.role !== "admin") {
        return res.status(403).json({ message: "Sem permissão para editar este widget" });
      }
      
      // Esquema de validação mais flexível
      const schema = z.object({
        name: z.string().min(1).max(100).optional(),
        greeting: z.string().optional(),
        avatar_url: z.string().optional(),
        theme_color: z.string().optional(),
        is_active: z.boolean().optional(),
        allowed_domains: z.union([
          z.array(z.string()),
          z.string().transform(str => {
            try {
              return JSON.parse(str);
            } catch {
              return [];
            }
          })
        ]).optional()
      });
      
      // Validar os dados
      let updateData = schema.parse(req.body);
      
      // Se tiver arquivo de avatar, processar e armazenar em base64
      if (req.file) {
        // Ler o arquivo e converter para base64
        const filePath = req.file.path;
        
        try {
          // Ler o arquivo usando fs/promises que é compatível com ES modules
          const fileData = await fs.promises.readFile(filePath);
          // Converter para base64
          const base64Data = fileData.toString('base64');
          
          // Armazenar os dados da imagem e o tipo MIME
          updateData.avatar_data = base64Data;
          updateData.avatar_mime_type = req.file.mimetype;
          
          // Configurar a URL para a rota que servirá a imagem
          updateData.avatar_url = `/api/widgets/${id}/avatar`;
          
          // Remover arquivo temporário do sistema de arquivos
          await fs.promises.unlink(filePath);
        } catch (e) {
          console.error("Erro ao processar arquivo de avatar:", e);
          // Em caso de erro, manter a URL original
          updateData.avatar_url = widget.avatar_url;
        }
      }
      
      // Converter allowed_domains para array se for string JSON
      if (updateData.allowed_domains && typeof updateData.allowed_domains === 'string') {
        try {
          updateData.allowed_domains = JSON.parse(updateData.allowed_domains);
        } catch (e) {
          console.error("Erro ao parsear allowed_domains:", e);
          updateData.allowed_domains = [];
        }
      }
      
      console.log("Dados de atualização validados:", updateData);
      
      // Atualizar o widget
      const updatedWidget = await storage.updateChatWidget(id, updateData);
      
      // Log da ação
      await logAction({
        userId: req.user!.id,
        action: "widget_updated",
        details: { widget_id: id, updates: updateData },
        ipAddress: req.ip
      });
      
      res.json(updatedWidget);
    } catch (error) {
      console.error("Erro ao atualizar widget:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Dados inválidos", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Erro ao atualizar widget" });
    }
  });
  
  // Rota para excluir um widget
  app.delete("/api/widgets/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Verificar se o widget existe
      const widget = await storage.getChatWidget(id);
      if (!widget) {
        return res.status(404).json({ message: "Widget não encontrado" });
      }
      
      // Verificar se o widget pertence ao usuário logado
      if (widget.user_id !== req.user!.id && req.user!.role !== "admin") {
        return res.status(403).json({ message: "Sem permissão para excluir este widget" });
      }
      
      // Excluir o widget
      await storage.deleteChatWidget(id);
      
      // Log da ação
      await logAction({
        userId: req.user!.id,
        action: "widget_deleted",
        details: { widget_id: id, widget_name: widget.name },
        ipAddress: req.ip
      });
      
      res.status(204).send();
    } catch (error) {
      console.error("Erro ao excluir widget:", error);
      res.status(500).json({ message: "Erro ao excluir widget" });
    }
  });
  
  // Rota para servir a imagem do avatar a partir dos dados armazenados
  app.get("/api/widgets/:id/avatar", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Obter o widget
      const widget = await storage.getChatWidget(id);
      
      if (!widget) {
        return res.status(404).json({ message: "Widget não encontrado" });
      }
      
      // Verificar se o widget tem dados de imagem
      if (!widget.avatar_data || !widget.avatar_mime_type) {
        // Se não tiver, pode redirecionar para o avatar_url
        if (widget.avatar_url && (widget.avatar_url.startsWith('http') || widget.avatar_url.startsWith('/uploads/'))) {
          return res.redirect(widget.avatar_url);
        }
        return res.status(404).json({ message: "Avatar não encontrado" });
      }
      
      // Converter de base64 para Buffer
      const imageBuffer = Buffer.from(widget.avatar_data, 'base64');
      
      // Definir o tipo de conteúdo
      res.setHeader('Content-Type', widget.avatar_mime_type);
      // Permitir cache no cliente
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 horas
      
      // Enviar a imagem
      res.send(imageBuffer);
    } catch (error) {
      console.error("Erro ao servir avatar:", error);
      res.status(500).json({ message: "Erro ao servir avatar" });
    }
  });
  
  // Rota para validar um domínio para um widget
  app.post("/api/widgets/:id/validate-domain", async (req, res) => {
    try {
      const { id } = req.params;
      const { domain } = req.body;
      
      if (!domain) {
        return res.status(400).json({ message: "Domínio não fornecido" });
      }
      
      const isValid = await storage.validateWidgetDomain(id, domain);
      
      res.json({ isValid });
    } catch (error) {
      console.error("Erro ao validar domínio:", error);
      res.status(500).json({ message: "Erro ao validar domínio" });
    }
  });
  
  // Rota para obter um widget via API key (pública) - usando header
  app.get("/api/public/widgets", async (req, res) => {
    try {
      const apiKey = req.headers["x-api-key"] as string;
      
      if (!apiKey) {
        return res.status(401).json({ message: "API key não fornecida" });
      }
      
      const widget = await storage.getChatWidgetByApiKey(apiKey);
      
      if (!widget) {
        return res.status(404).json({ message: "Widget não encontrado ou inativo" });
      }
      
      // Verificar o referrer para validar o domínio
      const referrer = req.headers.referer || req.headers.origin;
      if (referrer) {
        try {
          const url = new URL(referrer);
          const domain = url.hostname;
          
          const isValidDomain = await storage.validateWidgetDomain(widget.id, domain);
          if (!isValidDomain) {
            return res.status(403).json({ 
              message: "Domínio não autorizado para este widget",
              error: "domain_not_allowed"
            });
          }
        } catch (e) {
          console.error("Erro ao validar referrer:", e);
        }
      }
      
      // Remover a API key da resposta
      const { api_key, ...safeWidget } = widget;
      
      res.json(safeWidget);
    } catch (error) {
      console.error("Erro ao obter widget público via header:", error);
      res.status(500).json({ message: "Erro ao obter widget" });
    }
  });
    
  // Rota alternativa específica para embed - nova versão que evita problemas com o widget público
  app.get("/api/embed/widget", async (req, res) => {
    try {
      const apiKey = req.query.key as string;
      
      if (!apiKey) {
        return res.status(401).json({ message: "API key não fornecida. Use o parâmetro 'key'." });
      }
      
      console.log(`[EMBED] Buscando widget com API key: ${apiKey}`);
      const widget = await storage.getChatWidgetByApiKey(apiKey);
      
      if (!widget) {
        console.log(`[EMBED] Widget não encontrado para key: ${apiKey}`);
        return res.status(404).json({ message: "Widget não encontrado ou inativo" });
      }
      
      console.log(`[EMBED] Widget encontrado: ${widget.id}, nome: ${widget.name}`);
      
      // Em ambiente de desenvolvimento, não validamos domínio para facilitar testes
      if (process.env.NODE_ENV === 'development') {
        console.log('[EMBED] Ambiente de desenvolvimento - ignorando validação de domínio');
        const { api_key, ...safeWidget } = widget;
        return res.json(safeWidget);
      }
      
      const referrer = req.headers.referer || req.headers.origin;
      console.log(`[EMBED] Referrer: ${referrer}`);
      
      // Remover a API key da resposta
      const { api_key, ...safeWidget } = widget;
      
      // Converter URLs relativas para absolutas usando a função utilitária
      if (safeWidget.avatar_url) {
        safeWidget.avatar_url = ensureAbsoluteUrl(safeWidget.avatar_url, req);
      }
      
      return res.json(safeWidget);
    } catch (error) {
      console.error("[EMBED] Erro ao obter widget:", error);
      res.status(500).json({ message: "Erro ao obter widget" });
    }
  });

  // Rota para obter um widget via API key (pública) - usando query parameter
  app.get("/api/widgets/public", async (req, res) => {
    try {
      const apiKey = req.query.key as string;
      
      if (!apiKey) {
        return res.status(401).json({ message: "API key não fornecida. Use o parâmetro 'key'." });
      }
      
      console.log(`Buscando widget com API key: ${apiKey}`);
      const widget = await storage.getChatWidgetByApiKey(apiKey);
      
      if (!widget) {
        return res.status(404).json({ message: "Widget não encontrado ou inativo" });
      }
      
      // Verificar o referrer para validar o domínio
      const referrer = req.headers.referer || req.headers.origin;
      if (referrer) {
        try {
          const url = new URL(referrer);
          const domain = url.hostname;
          
          const isValidDomain = await storage.validateWidgetDomain(widget.id, domain);
          if (!isValidDomain) {
            return res.status(403).json({ 
              message: "Domínio não autorizado para este widget",
              error: "domain_not_allowed"
            });
          }
        } catch (e) {
          console.error("Erro ao validar referrer:", e);
        }
      }
      
      // Remover a API key da resposta
      const { api_key, ...safeWidget } = widget;
      
      res.json(safeWidget);
    } catch (error) {
      console.error("Erro ao obter widget público:", error);
      res.status(500).json({ message: "Erro ao obter widget" });
    }
  });
  
  // Rota para iniciar uma sessão de chat com um widget (pública)
  app.post("/api/public/widgets/sessions", async (req, res) => {
    try {
      const apiKey = req.headers["x-api-key"] as string;
      
      if (!apiKey) {
        return res.status(401).json({ message: "API key não fornecida" });
      }
      
      const widget = await storage.getChatWidgetByApiKey(apiKey);
      
      if (!widget) {
        return res.status(404).json({ message: "Widget não encontrado ou inativo" });
      }
      
      // Verificar o referrer para validar o domínio
      const referrer = req.headers.referer || req.headers.origin;
      if (referrer) {
        try {
          const url = new URL(referrer);
          const domain = url.hostname;
          
          const isValidDomain = await storage.validateWidgetDomain(widget.id, domain);
          if (!isValidDomain) {
            return res.status(403).json({ message: "Domínio não autorizado para este widget" });
          }
        } catch (e) {
          console.error("Erro ao validar referrer:", e);
        }
      }
      
      // Verificar limite de mensagens do usuário dono do widget
      const canSendMessages = await storage.checkMessageLimit(widget.user_id);
      if (!canSendMessages) {
        return res.status(403).json({ 
          message: "O proprietário deste widget atingiu o limite de mensagens do plano",
          error: "message_limit_reached"
        });
      }
      
      // Criar a sessão
      const session = await storage.createWidgetChatSession({
        widget_id: widget.id,
        client_info: JSON.stringify({
          referrer,
          userAgent: req.headers["user-agent"],
          ip: req.ip
        })
      });
      
      // Criar mensagem de boas-vindas
      if (widget.greeting) {
        await storage.createWidgetChatMessage({
          session_id: session.id,
          content: widget.greeting,
          is_from_ai: true
        });
      }
      
      res.status(201).json(session);
    } catch (error) {
      console.error("Erro ao criar sessão de widget:", error);
      res.status(500).json({ message: "Erro ao criar sessão de chat" });
    }
  });
  
  // Rota para enviar mensagem para uma sessão de widget (pública)
  app.post("/api/public/widgets/sessions/:id/messages", async (req, res) => {
    try {
      const { id } = req.params;
      const apiKey = req.headers["x-api-key"] as string;
      
      if (!apiKey) {
        return res.status(401).json({ message: "API key não fornecida" });
      }
      
      // Verificar se a sessão existe
      const session = await storage.getWidgetChatSession(parseInt(id));
      if (!session) {
        return res.status(404).json({ message: "Sessão não encontrada" });
      }
      
      // Verificar se a sessão foi encerrada
      if (session.ended_at) {
        return res.status(403).json({ message: "Sessão encerrada" });
      }
      
      // Verificar se o widget existe e está ativo
      const widget = await storage.getChatWidget(session.widget_id);
      if (!widget) {
        return res.status(404).json({ message: "Widget não encontrado" });
      }
      
      if (!widget.is_active) {
        return res.status(403).json({ message: "Widget está inativo" });
      }
      
      // Verificar se a API key corresponde ao widget
      if (widget.api_key !== apiKey) {
        return res.status(403).json({ message: "API key inválida para este widget" });
      }
      
      // Verificar limite de mensagens do usuário dono do widget
      const canSendMessages = await storage.checkMessageLimit(widget.user_id);
      if (!canSendMessages) {
        return res.status(403).json({ 
          message: "O proprietário deste widget atingiu o limite de mensagens do plano",
          error: "message_limit_reached"
        });
      }
      
      const schema = z.object({
        content: z.string().min(1).max(10000)
      });
      
      const { content } = schema.parse(req.body);
      
      // Criar a mensagem do usuário
      const userMessage = await storage.createWidgetChatMessage({
        session_id: parseInt(id),
        content,
        is_from_ai: false
      });
      
      // Obter configuração LLM ativa
      const llmConfig = await storage.getActiveLlmConfig();
      if (!llmConfig) {
        return res.status(500).json({ message: "Configuração LLM não encontrada" });
      }
      
      // Obter avatar ativo
      const avatar = await storage.getActiveAvatar();
      
      // Processar a resposta da IA
      let aiResponse: string;
      try {
        // Obter o histórico de mensagens da sessão
        const messages = await storage.getWidgetSessionMessages(parseInt(id));
        
        // Processar a mensagem com o LLM
        aiResponse = await processTextMessage(
          content,
          messages.filter(m => m.id !== userMessage.id).map(m => ({
            content: m.content || "",
            role: m.is_from_ai ? "assistant" : "user"
          })),
          llmConfig
        );
      } catch (error) {
        console.error("Erro ao processar mensagem com LLM:", error);
        aiResponse = "Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.";
      }
      
      // Criar a mensagem da IA
      const aiMessage = await storage.createWidgetChatMessage({
        session_id: parseInt(id),
        content: aiResponse,
        is_from_ai: true
      });
      
      // Incrementar contagem de mensagens para o usuário
      await storage.incrementMessageCount(widget.user_id);
      
      res.json({
        userMessage,
        aiMessage
      });
    } catch (error) {
      console.error("Erro ao enviar mensagem para widget:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Dados inválidos", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Erro ao enviar mensagem" });
    }
  });
  
  // Rota para encerrar uma sessão de widget (pública)
  app.post("/api/public/widgets/sessions/:id/end", async (req, res) => {
    try {
      const { id } = req.params;
      const apiKey = req.headers["x-api-key"] as string;
      
      if (!apiKey) {
        return res.status(401).json({ message: "API key não fornecida" });
      }
      
      // Verificar se a sessão existe
      const session = await storage.getWidgetChatSession(parseInt(id));
      if (!session) {
        return res.status(404).json({ message: "Sessão não encontrada" });
      }
      
      // Verificar se a sessão já foi encerrada
      if (session.ended_at) {
        return res.status(400).json({ message: "Sessão já encerrada" });
      }
      
      // Verificar se o widget existe
      const widget = await storage.getChatWidget(session.widget_id);
      if (!widget) {
        return res.status(404).json({ message: "Widget não encontrado" });
      }
      
      // Verificar se a API key corresponde ao widget
      if (widget.api_key !== apiKey) {
        return res.status(403).json({ message: "API key inválida para este widget" });
      }
      
      // Encerrar a sessão
      const updatedSession = await storage.endWidgetChatSession(parseInt(id));
      
      res.json(updatedSession);
    } catch (error) {
      console.error("Erro ao encerrar sessão de widget:", error);
      res.status(500).json({ message: "Erro ao encerrar sessão" });
    }
  });
  
  // Rota para obter o histórico de mensagens de uma sessão (pública)
  app.get("/api/public/widgets/sessions/:id/messages", async (req, res) => {
    try {
      const { id } = req.params;
      const apiKey = req.headers["x-api-key"] as string;
      
      if (!apiKey) {
        return res.status(401).json({ message: "API key não fornecida" });
      }
      
      // Verificar se a sessão existe
      const session = await storage.getWidgetChatSession(parseInt(id));
      if (!session) {
        return res.status(404).json({ message: "Sessão não encontrada" });
      }
      
      // Verificar se o widget existe
      const widget = await storage.getChatWidget(session.widget_id);
      if (!widget) {
        return res.status(404).json({ message: "Widget não encontrado" });
      }
      
      // Verificar se a API key corresponde ao widget
      if (widget.api_key !== apiKey) {
        return res.status(403).json({ message: "API key inválida para este widget" });
      }
      
      // Obter mensagens da sessão
      const messages = await storage.getWidgetSessionMessages(parseInt(id));
      
      res.json(messages);
    } catch (error) {
      console.error("Erro ao obter mensagens de sessão de widget:", error);
      res.status(500).json({ message: "Erro ao obter mensagens" });
    }
  });
  
  // ===== FIM DAS ROTAS DE WIDGETS =====

  const httpServer = createServer(app);

  return httpServer;
}
