import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, checkRole } from "./auth";
import { analyzeImage, analyzeFile, processTextMessage, testConnection, getActiveLlmInfo, fetchOpenAIDirectly, fetchAnthropicDirectly } from "./llm";
import { processChatWithTrainedDocuments } from "./trained-chat-processor";
import { testDocumentKnowledge } from "./training-test";
import { testTopicsLearning, addTechnicalTopic } from "./external-search";
import { logAction } from "./audit";
import { systemMaintenanceService } from "./system-maintenance";
import { registerSecurityRoutes } from "./security-settings";
import multer from "multer";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { db } from "./db";
import { sql } from "drizzle-orm";
import pdfParse from "pdf-parse";

/**
 * Utilitário para dividir mensagens longas em partes menores
 * para melhor legibilidade e experiência do usuário.
 * 
 * @param text Texto a ser dividido
 * @param options Opções de configuração
 * @returns Array com as partes do texto
 */
function splitLongMessage(text: string, options: {
  maxParagraphsPerPart?: number,
  maxCharsPerPart?: number,
  maxPartsTotal?: number
} = {}): string[] {
  // Configurações padrão
  const maxParagraphsPerPart = options.maxParagraphsPerPart || 3;
  const maxCharsPerPart = options.maxCharsPerPart || 600;
  const maxPartsTotal = options.maxPartsTotal || 5;

  // Texto muito curto não precisa ser dividido
  if (text.length <= maxCharsPerPart) {
    return [text];
  }

  // Dividir o texto em parágrafos (por quebras de linha)
  let paragraphs = text.split(/\n\s*\n/);
  
  // Se houver apenas um parágrafo muito longo, dividir por sentenças
  if (paragraphs.length === 1 && text.length > maxCharsPerPart) {
    // Dividir por sentenças (ponto seguido de espaço ou nova linha)
    const sentences = text.split(/(?<=[.!?])\s+/);
    
    const parts: string[] = [];
    let currentPart = '';
    
    for (const sentence of sentences) {
      // Se a sentença for muito longa sozinha, incluir mesmo que exceda o limite
      if (sentence.length > maxCharsPerPart) {
        if (currentPart) {
          parts.push(currentPart);
          currentPart = '';
        }
        parts.push(sentence);
        continue;
      }
      
      // Verificar se adicionar essa sentença excederia o limite
      if (currentPart && (currentPart.length + sentence.length > maxCharsPerPart)) {
        parts.push(currentPart);
        currentPart = sentence;
      } else {
        currentPart += (currentPart ? ' ' : '') + sentence;
      }
    }
    
    // Adicionar a última parte se existir
    if (currentPart) {
      parts.push(currentPart);
    }
    
    // Limitar o número total de partes
    return parts.slice(0, maxPartsTotal);
  }
  
  // Dividir em grupos de parágrafos
  const parts: string[] = [];
  let currentPart: string[] = [];
  let currentPartLength = 0;
  
  for (const paragraph of paragraphs) {
    // Se esse parágrafo sozinho exceder o limite, tratá-lo como uma parte própria
    if (paragraph.length > maxCharsPerPart) {
      if (currentPart.length > 0) {
        parts.push(currentPart.join('\n\n'));
        currentPart = [];
        currentPartLength = 0;
      }
      parts.push(paragraph);
      continue;
    }
    
    // Verificar se adicionar esse parágrafo excederia os limites
    if (currentPart.length >= maxParagraphsPerPart || 
        currentPartLength + paragraph.length > maxCharsPerPart) {
      parts.push(currentPart.join('\n\n'));
      currentPart = [paragraph];
      currentPartLength = paragraph.length;
    } else {
      currentPart.push(paragraph);
      currentPartLength += paragraph.length;
    }
  }
  
  // Adicionar a última parte se existir
  if (currentPart.length > 0) {
    parts.push(currentPart.join('\n\n'));
  }
  
  // Limitar o número total de partes
  return parts.slice(0, maxPartsTotal);
}

// Função utilitária para extrair texto de um arquivo PDF
async function extractTextFromPDF(filePath: string): Promise<string | null> {
  try {
    console.log(`Tentando extrair texto do PDF: ${filePath}`);
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    console.log(`PDF processado com sucesso: ${data.text.length} caracteres extraídos`);
    return data.text;
  } catch (error) {
    console.error(`Erro ao extrair texto do PDF: ${filePath}`, error);
    return null;
  }
}

// Função utilitária para extrair texto de arquivo TXT
async function extractTextFromTXT(filePath: string): Promise<string | null> {
  try {
    console.log(`Tentando ler arquivo de texto: ${filePath}`);
    const text = fs.readFileSync(filePath, 'utf-8');
    console.log(`Arquivo de texto processado com sucesso: ${text.length} caracteres`);
    return text;
  } catch (error) {
    console.error(`Erro ao ler arquivo de texto: ${filePath}`, error);
    return null;
  }
}

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
    // Chat uploads: PNG, JPG, PDF, TXT, DOC, DOCX
    if (
      file.mimetype === "image/jpeg" || 
      file.mimetype === "image/png" || 
      file.mimetype === "application/pdf" || 
      file.mimetype === "text/plain" ||
      file.mimetype === "application/msword" || // .doc
      file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" // .docx
    ) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file format. Please upload PNG, JPG, PDF, TXT, DOC, or DOCX."));
    }
  }
};

// Create multer upload instance with higher limits for training documents
const upload = multer({ 
  storage: storageConfig, 
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max para uploads gerais e documentos de treinamento
    files: 1, // Limitar a um arquivo por vez para evitar sobrecarga de memória
  }
});

// Instância dedicada para documentos de treinamento grandes com limites adequados
const trainingDocumentUpload = multer({
  storage: storageConfig,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB para documentos de treinamento
    files: 1, // Apenas um arquivo por vez
  }
});

// Create avatar upload instance with 5MB limit
const avatarUpload = multer({
  storage: storageConfig,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max for avatars
    files: 1,
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Rota especial para permitir embedding do widget
  app.get('/embed/*', (req, res, next) => {
    // Remover X-Frame-Options para permitir embedding
    res.removeHeader('X-Frame-Options');
    
    // Configurar Content-Security-Policy para permitir que o widget seja embedado
    res.setHeader(
      'Content-Security-Policy',
      "frame-ancestors 'self' *"
    );
    
    next();
  });
  
  // Rota específica para iframe embed (compatível com Curseduca e outras plataformas)
  app.get('/embed/iframe', (req, res, next) => {
    // Headers adicionais específicos para embedding em iframe
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Configurar cache para melhor performance de iframe
    res.setHeader('Cache-Control', 'public, max-age=300');
    
    next();
  });
  // Servir arquivos estáticos da pasta public
  app.use(express.static(path.join(process.cwd(), 'public')));
  
  // Exibir o caminho dos uploads para facilitar acesso através da URL
  console.log(`Servindo arquivos estáticos de ${UPLOADS_DIR} na rota /uploads`);
  app.use('/uploads', express.static(UPLOADS_DIR));
  
  // Setup authentication routes
  setupAuth(app);
  
  // Configuração de rotas de segurança avançada
  registerSecurityRoutes(app);
  
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
  
  // Rota para obter os limites de mensagens dos planos
  app.get("/api/admin/plans/message-limits", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      // Limites padrão para cada plano
      const defaultLimits = {
        none: 50,
        basic: 2500,
        intermediate: 5000
      };
      
      // Obter todos os usuários para verificar seus limites reais
      const allUsers = await storage.getUsers();
      
      // Verificar os limites reais configurados para usuários de cada plano
      // Se não houver usuários de um plano específico, usar o valor padrão
      const realLimits = {
        none: allUsers.filter(u => u.subscription_tier === "none").length > 0 ?
          Math.max(...allUsers.filter(u => u.subscription_tier === "none").map(u => u.max_messages || 0)) : 
          defaultLimits.none,
          
        basic: allUsers.filter(u => u.subscription_tier === "basic").length > 0 ?
          Math.max(...allUsers.filter(u => u.subscription_tier === "basic").map(u => u.max_messages || 0)) : 
          defaultLimits.basic,
          
        intermediate: allUsers.filter(u => u.subscription_tier === "intermediate").length > 0 ?
          Math.max(...allUsers.filter(u => u.subscription_tier === "intermediate").map(u => u.max_messages || 0)) : 
          defaultLimits.intermediate
      };
      
      // Formatar resposta
      const plans = [
        { tier: "none", limit: realLimits.none, defaultLimit: defaultLimits.none },
        { tier: "basic", limit: realLimits.basic, defaultLimit: defaultLimits.basic },
        { tier: "intermediate", limit: realLimits.intermediate, defaultLimit: defaultLimits.intermediate }
      ];
      
      res.json(plans);
    } catch (error) {
      console.error("Erro ao obter limites de mensagens:", error);
      res.status(500).json({ message: "Erro ao obter limites de mensagens dos planos" });
    }
  });
  
  // Rota para atualizar o limite de mensagens de um plano
  app.put("/api/admin/plans/message-limits/:tier", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const tier = req.params.tier as "none" | "basic" | "intermediate";
      const { limit } = req.body;
      
      if (!tier || !["none", "basic", "intermediate"].includes(tier)) {
        return res.status(400).json({ message: "Plano inválido" });
      }
      
      if (typeof limit !== 'number' || limit < 0) {
        return res.status(400).json({ message: "Limite inválido" });
      }
      
      // Atualizar max_messages para todos os usuários deste plano
      // Buscar todos os usuários deste plano
      const usersToUpdate = await storage.getUsersBySubscriptionTier(tier);
      
      // Atualizar cada usuário com o novo limite
      const updatedUsers = await Promise.all(
        usersToUpdate.map(user => 
          storage.updateUser(user.id, { max_messages: limit })
        )
      );
      
      // Log da ação
      await logAction({
        userId: req.user!.id,
        action: "plan_message_limit_updated",
        details: { tier, limit, affectedUsers: updatedUsers.length },
        ipAddress: req.ip
      });
      
      res.json({ 
        tier, 
        limit, 
        message: `Limite de mensagens atualizado para ${updatedUsers.length} usuários`,
        affectedUsers: updatedUsers.length
      });
    } catch (error) {
      console.error("Erro ao atualizar limite de mensagens:", error);
      res.status(500).json({ message: "Erro ao atualizar limite de mensagens do plano" });
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
  
  // Sistema de manutenção e configuração (admin only)
  app.post("/api/admin/system/verify-db", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const result = await systemMaintenanceService.verifyDatabaseIntegrity();
      
      // Log da ação
      await logAction({
        userId: req.user!.id,
        action: "system_db_integrity_check",
        details: { success: result.success },
        ipAddress: req.ip
      });
      
      res.json(result);
    } catch (error) {
      console.error("Erro ao verificar integridade do banco de dados:", error);
      res.status(500).json({ 
        success: false, 
        message: "Erro ao verificar integridade do banco de dados" 
      });
    }
  });
  
  app.post("/api/admin/system/optimize-indexes", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const result = await systemMaintenanceService.optimizeIndexes();
      
      // Log da ação
      await logAction({
        userId: req.user!.id,
        action: "system_optimize_indexes",
        details: { success: result.success },
        ipAddress: req.ip
      });
      
      res.json(result);
    } catch (error) {
      console.error("Erro ao otimizar índices:", error);
      res.status(500).json({ 
        success: false, 
        message: "Erro ao otimizar índices" 
      });
    }
  });
  
  app.post("/api/admin/system/clear-cache", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const result = await systemMaintenanceService.clearCache();
      
      // Log da ação
      await logAction({
        userId: req.user!.id,
        action: "system_clear_cache",
        details: { success: result.success },
        ipAddress: req.ip
      });
      
      res.json(result);
    } catch (error) {
      console.error("Erro ao limpar cache:", error);
      res.status(500).json({ 
        success: false, 
        message: "Erro ao limpar cache" 
      });
    }
  });
  
  app.post("/api/admin/system/rebuild-indexes", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const result = await systemMaintenanceService.rebuildIndexes();
      
      // Log da ação
      await logAction({
        userId: req.user!.id,
        action: "system_rebuild_indexes",
        details: { success: result.success },
        ipAddress: req.ip
      });
      
      res.json(result);
    } catch (error) {
      console.error("Erro ao reconstruir índices:", error);
      res.status(500).json({ 
        success: false, 
        message: "Erro ao reconstruir índices" 
      });
    }
  });
  
  app.post("/api/admin/system/log-level", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const { level } = req.body;
      
      if (!level || !['low', 'medium', 'high'].includes(level)) {
        return res.status(400).json({ 
          success: false, 
          message: "Nível de log inválido" 
        });
      }
      
      const result = await systemMaintenanceService.setLogLevel(level, req.user!.id);
      res.json(result);
    } catch (error) {
      console.error("Erro ao definir nível de log:", error);
      res.status(500).json({ 
        success: false, 
        message: "Erro ao definir nível de log" 
      });
    }
  });
  
  app.post("/api/admin/system/log-retention", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const { days } = req.body;
      
      if (!days || ![30, 90, 180, 365].includes(Number(days))) {
        return res.status(400).json({ 
          success: false, 
          message: "Período de retenção inválido" 
        });
      }
      
      const result = await systemMaintenanceService.setLogRetention(Number(days), req.user!.id);
      res.json(result);
    } catch (error) {
      console.error("Erro ao definir período de retenção:", error);
      res.status(500).json({ 
        success: false, 
        message: "Erro ao definir período de retenção" 
      });
    }
  });
  
  app.get("/api/admin/system/settings", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      // Buscar configurações do sistema (nível de log, período de retenção, etc.)
      const logLevel = await db.execute(sql`
        SELECT value FROM system_settings WHERE key = 'log_level'
      `);
      
      const logRetention = await db.execute(sql`
        SELECT value FROM system_settings WHERE key = 'log_retention_days'
      `);
      
      const autoRegisterTechnicians = await db.execute(sql`
        SELECT value FROM system_settings WHERE key = 'autoRegisterTechnicians'
      `);
      
      const require2FA = await db.execute(sql`
        SELECT value FROM system_settings WHERE key = 'require2FA'
      `);
      
      res.json({
        logLevel: logLevel.rows && logLevel.rows.length > 0 ? logLevel.rows[0].value : 'medium',
        logRetention: logRetention.rows && logRetention.rows.length > 0 ? logRetention.rows[0].value : '90',
        autoRegisterTechnicians: autoRegisterTechnicians.rows && autoRegisterTechnicians.rows.length > 0 
          ? autoRegisterTechnicians.rows[0].value === 'true' : false,
        require2FA: require2FA.rows && require2FA.rows.length > 0 
          ? require2FA.rows[0].value === 'true' : false,
      });
    } catch (error) {
      console.error("Erro ao buscar configurações do sistema:", error);
      res.status(500).json({ 
        logLevel: 'medium',
        logRetention: '90',
        autoRegisterTechnicians: false,
        require2FA: false
      });
    }
  });
  
  app.post("/api/admin/system/toggle-auto-register", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const { enabled } = req.body;
      
      // Atualizar configuração no banco de dados
      await db.execute(sql`
        INSERT INTO system_settings (key, value, updated_by, updated_at)
        VALUES ('autoRegisterTechnicians', ${enabled ? 'true' : 'false'}, ${req.user!.id}, NOW())
        ON CONFLICT (key) DO UPDATE
        SET value = ${enabled ? 'true' : 'false'}, updated_by = ${req.user!.id}, updated_at = NOW()
      `);
      
      // Log da ação
      await logAction({
        userId: req.user!.id,
        action: "system_config_update",
        details: { 
          setting: 'autoRegisterTechnicians', 
          value: enabled ? 'true' : 'false' 
        },
        ipAddress: req.ip
      });
      
      res.json({ 
        success: true, 
        message: `Auto-registro de técnicos ${enabled ? 'ativado' : 'desativado'}` 
      });
    } catch (error) {
      console.error("Erro ao alterar configuração de auto-registro:", error);
      res.status(500).json({ 
        success: false, 
        message: "Erro ao alterar configuração de auto-registro" 
      });
    }
  });
  
  app.post("/api/admin/system/toggle-require-2fa", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const { enabled } = req.body;
      
      // Atualizar configuração no banco de dados
      await db.execute(sql`
        INSERT INTO system_settings (key, value, updated_by, updated_at)
        VALUES ('require2FA', ${enabled ? 'true' : 'false'}, ${req.user!.id}, NOW())
        ON CONFLICT (key) DO UPDATE
        SET value = ${enabled ? 'true' : 'false'}, updated_by = ${req.user!.id}, updated_at = NOW()
      `);
      
      // Log da ação
      await logAction({
        userId: req.user!.id,
        action: "system_config_update",
        details: { 
          setting: 'require2FA', 
          value: enabled ? 'true' : 'false' 
        },
        ipAddress: req.ip
      });
      
      res.json({ 
        success: true, 
        message: `Autenticação de dois fatores ${enabled ? 'exigida' : 'opcional'} para administradores` 
      });
    } catch (error) {
      console.error("Erro ao alterar configuração de 2FA:", error);
      res.status(500).json({ 
        success: false, 
        message: "Erro ao alterar configuração de autenticação de dois fatores" 
      });
    }
  });
  
  // Technical topics testing routes
  app.post("/api/admin/technical-topics/test", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const { query } = req.body;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ message: "Uma consulta de texto válida é necessária" });
      }
      
      // Testar a identificação de tópicos técnicos
      const result = await testTopicsLearning(query);
      
      // Retornar o resultado completo
      res.json(result);
      
    } catch (error) {
      console.error("Erro ao testar sistema de tópicos técnicos:", error);
      res.status(500).json({ message: "Erro interno ao processar a consulta" });
    }
  });
  
  // Rota para listar todos os tópicos técnicos
  app.get("/api/admin/technical-topics", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const topics = await storage.getTechnicalTopics();
      res.json(topics);
    } catch (error) {
      console.error("Erro ao buscar tópicos técnicos:", error);
      res.status(500).json({ message: "Erro ao buscar tópicos técnicos" });
    }
  });
  
  // Rota para adicionar manualmente um tópico técnico
  app.post("/api/admin/technical-topics", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const { topic } = req.body;
      
      if (!topic || typeof topic !== 'string') {
        return res.status(400).json({ message: "Um tópico válido é necessário" });
      }
      
      const success = await storage.addTechnicalTopic(topic);
      
      if (success) {
        res.status(201).json({ message: "Tópico técnico adicionado com sucesso" });
      } else {
        res.status(500).json({ message: "Não foi possível adicionar o tópico técnico" });
      }
      
    } catch (error) {
      console.error("Erro ao adicionar tópico técnico:", error);
      res.status(500).json({ message: "Erro ao adicionar tópico técnico" });
    }
  });
  
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
      // Limpar o prefixo "Bearer " da API key antes de salvar no banco
      let apiKey = req.body.api_key;
      if (apiKey && typeof apiKey === 'string' && apiKey.toLowerCase().startsWith('bearer ')) {
        apiKey = apiKey.substring(7).trim();
        req.body.api_key = apiKey;
      }
      
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
  
  // Rotas para gestão de aprendizado de interações
  app.post("/api/training/interactions/process", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const { daysAgo = 7, maxInteractions = 50 } = req.body;
      
      // Importar funções de processamento de interações
      // Importar usando dynamic import (ES Modules)
      const interactionLearning = await import('./interaction-learning');
      
      // Criar ou obter categoria específica para interações
      const categoryId = await interactionLearning.createInteractionCategory(req.user!.id);
      
      // Processar interações recentes
      const processedCount = await interactionLearning.processRecentInteractions(
        Number(daysAgo), 
        Number(maxInteractions),
        categoryId
      );
      
      // Registrar no log de auditoria
      await logAction({
        userId: req.user!.id,
        action: "processed_interactions_for_training",
        details: { daysAgo, maxInteractions, processedCount },
        ipAddress: req.ip
      });
      
      res.json({ 
        success: true, 
        message: `Processadas ${processedCount} interações como documentos de treinamento`, 
        processedCount,
        categoryId
      });
    } catch (error: any) {
      console.error("Erro ao processar interações para treinamento:", error);
      res.status(500).json({ 
        success: false, 
        message: "Erro ao processar interações", 
        error: error.message 
      });
    }
  });
  
  app.get("/api/training/interactions/recent-sessions", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const daysAgo = parseInt(req.query.daysAgo as string) || 7;
      
      // Calcular a data limite
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
      
      // Importar função auxiliar para buscar sessões recentes usando dynamic import
      const interactionLearning = await import('./interaction-learning');
      
      // Buscar sessões recentes usando a função auxiliar
      const recentSessions = await interactionLearning.fetchRecentSessions(cutoffDate);
      
      res.json({
        sessions: recentSessions,
        count: recentSessions.length,
        cutoffDate
      });
    } catch (error: any) {
      console.error("Erro ao buscar sessões recentes:", error);
      res.status(500).json({ 
        message: "Erro ao buscar sessões recentes", 
        error: error.message 
      });
    }
  });
  
  app.post("/api/admin/llm/test", isAuthenticated, checkRole("admin"), async (req, res) => {
    const schema = z.object({
      model_name: z.string(),
      api_key: z.string()
    });
    
    try {
      let { model_name, api_key } = schema.parse(req.body);
      
      // Limpar o prefixo "Bearer " da API key antes de testar a conexão
      if (api_key && typeof api_key === 'string' && api_key.toLowerCase().startsWith('bearer ')) {
        api_key = api_key.substring(7).trim();
      }
      
      console.log(`Testando conexão LLM com modelo ${model_name} (API key com comprimento ${api_key.length})`);
      
      // Test connection using both OpenAI and Anthropic APIs
      const isValid = await testConnection(api_key, model_name);
      
      res.json({ success: isValid });
    } catch (error) {
      console.error('Error testing LLM connection:', error);
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid configuration" });
    }
  });
  
  // Endpoint específico para teste de compatibilidade entre modelos Claude
  app.post("/api/admin/llm/claude-compatibility-test", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const { apiKey } = req.body;
      
      if (!apiKey) {
        return res.status(400).json({ success: false, message: "API key is required" });
      }
      
      const results = {
        claude2_prompt_format: false,
        claude3_messages_format: false,
        claude2_with_messages_format: false,
        claude3_with_prompt_format: false,
        errors: {} as Record<string, string>
      };
      
      // Teste 1: Claude 2 com formato prompt
      try {
        const claude2PromptParams = {
          model: "claude-2",
          max_tokens: 5,
          prompt: "\n\nHuman: Say hello for testing purposes only\n\nAssistant: "
        };
        
        const response1 = await fetchAnthropicDirectly('messages', claude2PromptParams, apiKey);
        results.claude2_prompt_format = !!response1.completion;
      } catch (error) {
        results.errors.claude2_prompt_format = error instanceof Error ? error.message : 'Unknown error';
      }
      
      // Teste 2: Claude 3 com formato messages
      try {
        const claude3MessagesParams = {
          model: "claude-3-opus-20240229",
          max_tokens: 5,
          messages: [{ role: "user", content: "Say hello for testing purposes only" }]
        };
        
        const response2 = await fetchAnthropicDirectly('messages', claude3MessagesParams, apiKey);
        results.claude3_messages_format = !!response2.content;
      } catch (error) {
        results.errors.claude3_messages_format = error instanceof Error ? error.message : 'Unknown error';
      }
      
      // Teste 3: Claude 2 com formato messages (incompatível)
      try {
        const claude2MessagesParams = {
          model: "claude-2",
          max_tokens: 5,
          messages: [{ role: "user", content: "Say hello for testing purposes only" }]
        };
        
        const response3 = await fetchAnthropicDirectly('messages', claude2MessagesParams, apiKey);
        results.claude2_with_messages_format = !!response3.content || !!response3.completion;
      } catch (error) {
        results.errors.claude2_with_messages_format = error instanceof Error ? error.message : 'Unknown error';
      }
      
      // Teste 4: Claude 3 com formato prompt (incompatível)
      try {
        const claude3PromptParams = {
          model: "claude-3-opus-20240229",
          max_tokens: 5,
          prompt: "\n\nHuman: Say hello for testing purposes only\n\nAssistant: "
        };
        
        const response4 = await fetchAnthropicDirectly('messages', claude3PromptParams, apiKey);
        results.claude3_with_prompt_format = !!response4.completion || !!response4.content;
      } catch (error) {
        results.errors.claude3_with_prompt_format = error instanceof Error ? error.message : 'Unknown error';
      }
      
      return res.json({ 
        success: true, 
        results,
        compatibility_summary: {
          claude2_preferred_format: results.claude2_prompt_format ? "prompt" : 
                                   results.claude2_with_messages_format ? "messages" : "unknown",
          claude3_preferred_format: results.claude3_messages_format ? "messages" : 
                                   results.claude3_with_prompt_format ? "prompt" : "unknown",
          recommendation: "Use appropriate format conversion in the fetchAnthropicDirectly function based on model"
        }
      });
    } catch (error) {
      console.error('Erro ao testar compatibilidade Claude:', error);
      return res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Rota de diagnóstico para depuração das chaves API - apenas em desenvolvimento
  app.get("/api/debug/llm-diagnostics", isAuthenticated, async (req, res) => {
    try {
      // Criar objeto de resultado para debug
      const debugResult: any = {
        env_keys: {
          openai_present: !!process.env.OPENAI_API_KEY,
          openai_length: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0,
          openai_first_chars: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 3) : '',
          anthropic_present: !!process.env.ANTHROPIC_API_KEY,
          anthropic_length: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.length : 0,
          anthropic_first_chars: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.substring(0, 3) : '',
        },
        db_config: null,
        active_config: null,
        test_results: {
          openai_direct: false,
          anthropic_direct: false
        }
      };
      
      // Obter configuração ativa do banco
      const activeConfig = await storage.getActiveLlmConfig();
      if (activeConfig) {
        debugResult.db_config = {
          id: activeConfig.id,
          model_name: activeConfig.model_name,
          is_active: activeConfig.is_active,
          api_key_length: activeConfig.api_key ? activeConfig.api_key.length : 0,
          api_key_first_chars: activeConfig.api_key ? activeConfig.api_key.substring(0, 3) : '',
          tone: activeConfig.tone,
          created_at: activeConfig.created_at
        };
      }
      
      // Testar obtenção das configurações
      try {
        const llmConfig = await getActiveLlmInfo();
        debugResult.active_config = {
          provider: llmConfig.provider,
          modelName: llmConfig.modelName,
          apiKey_length: llmConfig.apiKey ? llmConfig.apiKey.length : 0,
          apiKey_first_chars: llmConfig.apiKey ? llmConfig.apiKey.substring(0, 3) : '',
          tone: llmConfig.tone
        };
      } catch (configError) {
        debugResult.active_config_error = configError instanceof Error ? configError.message : 'Unknown error';
      }
      
      // Testar OpenAI diretamente - Versão detalhada com registro de headers
      try {
        if (process.env.OPENAI_API_KEY) {
          const openaiParams = {
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: "Say hello for testing purposes only" }],
            max_tokens: 5
          };
          
          // Diagnóstico detalhado para OpenAI
          // Verificar a chave - mascarar para debug
          const openaiKey = process.env.OPENAI_API_KEY;
          const cleanedOpenaiKey = openaiKey.replace(/^bearer\s+/i, '').replace(/["']/g, '').trim();
          
          debugResult.openai_diagnostic = {
            key_original_length: openaiKey.length,
            key_cleaned_length: cleanedOpenaiKey.length,
            key_starts_with: cleanedOpenaiKey.substring(0, 3),
            key_clean_diff: openaiKey.length - cleanedOpenaiKey.length,
            key_valid_format: cleanedOpenaiKey.startsWith('sk-'),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + '•'.repeat(4) + '...' + '•'.repeat(4)
            }
          };
          
          // Tentar chamar a API
          await fetchOpenAIDirectly('chat/completions', openaiParams, process.env.OPENAI_API_KEY);
          debugResult.test_results.openai_direct = true;
        }
      } catch (openaiError) {
        debugResult.test_results.openai_error = openaiError instanceof Error ? openaiError.message : 'Unknown error';
        // Adicionar stack trace para debug
        if (openaiError instanceof Error && openaiError.stack) {
          debugResult.test_results.openai_stack = openaiError.stack;
        }
      }
      
      // Testar Anthropic diretamente - Versão detalhada com diagnóstico para ambos os formatos de API
      try {
        if (process.env.ANTHROPIC_API_KEY) {
          // Testar para Claude 2 (prompt format)
          const anthropicParams2 = {
            model: "claude-2",
            max_tokens: 5,
            prompt: "\n\nHuman: Say hello for testing purposes only\n\nAssistant: "
          };
          
          // Diagnóstico detalhado para Anthropic
          const anthropicKey = process.env.ANTHROPIC_API_KEY;
          const cleanedAnthropicKey = anthropicKey.replace(/^bearer\s+/i, '').replace(/["']/g, '').trim();
          
          debugResult.anthropic_diagnostic = {
            key_original_length: anthropicKey.length,
            key_cleaned_length: cleanedAnthropicKey.length,
            key_starts_with: cleanedAnthropicKey.substring(0, 7),
            key_clean_diff: anthropicKey.length - cleanedAnthropicKey.length,
            key_valid_format: cleanedAnthropicKey.startsWith('sk-ant-'),
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': '•'.repeat(4) + '...' + '•'.repeat(4),
              'anthropic-version': '2023-06-01'
            }
          };
          
          // Tentar o formato Claude 2
          try {
            const resultC2 = await fetchAnthropicDirectly('messages', anthropicParams2, process.env.ANTHROPIC_API_KEY);
            debugResult.test_results.anthropic_direct_claude2 = true;
            debugResult.test_results.anthropic_claude2_response = { 
              has_completion: !!resultC2.completion,
              completion_length: resultC2.completion ? resultC2.completion.length : 0
            };
          } catch (c2Error) {
            debugResult.test_results.anthropic_claude2_error = c2Error instanceof Error ? c2Error.message : 'Unknown error';
          }
          
          // Testar para Claude 3 (messages format)
          const anthropicParams3 = {
            model: "claude-3-opus-20240229",
            max_tokens: 5,
            messages: [{ role: "user", content: "Say hello for testing purposes only" }]
          };
          
          try {
            const resultC3 = await fetchAnthropicDirectly('messages', anthropicParams3, process.env.ANTHROPIC_API_KEY);
            debugResult.test_results.anthropic_direct_claude3 = true;
            debugResult.test_results.anthropic_claude3_response = { 
              has_content: !!resultC3.content,
              content_length: resultC3.content ? resultC3.content.length : 0
            };
          } catch (c3Error) {
            debugResult.test_results.anthropic_claude3_error = c3Error instanceof Error ? c3Error.message : 'Unknown error';
          }
          
          // Se algum dos formatos funcionou, considerar sucesso
          debugResult.test_results.anthropic_direct = 
            debugResult.test_results.anthropic_direct_claude2 || 
            debugResult.test_results.anthropic_direct_claude3;
        }
      } catch (anthropicError) {
        debugResult.test_results.anthropic_error = anthropicError instanceof Error ? anthropicError.message : 'Unknown error';
        // Adicionar stack trace para debug
        if (anthropicError instanceof Error && anthropicError.stack) {
          debugResult.test_results.anthropic_stack = anthropicError.stack;
        }
      }
      
      return res.json({ success: true, debug: debugResult });
    } catch (error) {
      console.error('Erro no diagnóstico de API keys:', error);
      return res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error'
      });
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
      // Obter usuários
      const allUsers = await storage.getUsers();
      
      // Obter estatísticas de widgets
      let widgets = [];
      let widgetSessions = [];
      let widgetMessages = [];
      
      try {
        widgets = await storage.getAllChatWidgets();
        // Buscar apenas as sessões dos widgets (evita inconsistências)
        const widgetIds = widgets.map(widget => widget.id);
        widgetSessions = [];
        
        // Para cada widget, buscar suas sessões
        for (const widgetId of widgetIds) {
          const sessions = await storage.getWidgetChatSessions(widgetId);
          widgetSessions = [...widgetSessions, ...sessions];
        }
        
        // Para cada sessão, buscar suas mensagens
        widgetMessages = [];
        for (const session of widgetSessions) {
          const messages = await storage.getWidgetSessionMessages(session.id);
          widgetMessages = [...widgetMessages, ...messages];
        }
      } catch (err) {
        console.error("Erro ao obter dados de widgets:", err);
      }
      
      // Calcular estatísticas de chat
      let chatSessions = [];
      let chatMessages = [];
      
      try {
        // Buscar sessões de cada usuário
        for (const user of allUsers) {
          const userSessions = await storage.getUserChatSessions(user.id);
          chatSessions = [...chatSessions, ...userSessions];
          
          // Para cada sessão, buscar suas mensagens
          for (const session of userSessions) {
            const messages = await storage.getSessionMessages(session.id);
            chatMessages = [...chatMessages, ...messages];
          }
        }
      } catch (err) {
        console.error("Erro ao obter dados de chat:", err);
      }
      
      const activeSessions = chatSessions.filter(session => !session.ended_at);
      const activeWidgets = widgets.filter(widget => widget.is_active);
      
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
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Audit logs (admin)
  app.get("/api/admin/logs", isAuthenticated, checkRole("admin"), async (req, res) => {
    const logs = await storage.getAuditLogs();
    res.json(logs);
  });
  
  // Rota para exportar logs de auditoria
  app.get("/api/admin/export/audit-logs", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      // Parâmetros de filtragem opcionais
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const actionType = req.query.actionType as string || undefined;
      const userId = req.query.userId ? Number(req.query.userId) : undefined;
      
      // Buscar logs de auditoria
      let query = sql`SELECT a.id, a.action, a.details, a.ip_address, a.created_at, 
                              u.id as user_id, u.email, u.role
                       FROM audit_logs a
                       LEFT JOIN users u ON a.user_id = u.id
                       WHERE 1=1`;
      
      if (startDate) {
        query = sql`${query} AND a.created_at >= ${startDate.toISOString()}`;
      }
      
      if (endDate) {
        query = sql`${query} AND a.created_at <= ${endDate.toISOString()}`;
      }
      
      if (actionType) {
        query = sql`${query} AND a.action = ${actionType}`;
      }
      
      if (userId) {
        query = sql`${query} AND a.user_id = ${userId}`;
      }
      
      query = sql`${query} ORDER BY a.created_at DESC`;
      
      const result = await db.execute(query);
      
      // Transformar os dados para CSV
      let csvContent = "ID,Ação,Detalhes,Endereço IP,Data,Usuário ID,Email,Perfil\n";
      
      for (const row of result.rows) {
        const details = row.details ? JSON.stringify(row.details).replace(/"/g, '""') : '';
        const email = row.email || 'Sistema';
        const role = row.role || 'N/A';
        
        csvContent += `${row.id},"${row.action}","${details}","${row.ip_address}","${new Date(row.created_at).toISOString()}",${row.user_id || 'N/A'},"${email}","${role}"\n`;
      }
      
      // Configurar cabeçalhos para download
      res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
      res.setHeader('Content-Type', 'text/csv');
      
      // Enviar o arquivo CSV
      res.send(csvContent);
      
      // Log da exportação
      await logAction({
        userId: req.user!.id,
        action: "export_audit_logs",
        details: { 
          count: result.rows.length,
          filters: { startDate, endDate, actionType, userId }
        },
        ipAddress: req.ip
      });
      
    } catch (error: any) {
      console.error("Erro ao exportar logs de auditoria:", error);
      res.status(500).json({ 
        success: false, 
        message: "Erro ao exportar logs de auditoria", 
        error: error.message
      });
    }
  });
  
  // Rota para exportar estatísticas de uso do sistema
  app.get("/api/admin/export/system-stats", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      // Período para estatísticas: últimos 30 dias por padrão, ou personalizado
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
      
      // 1. Estatísticas de uso de LLM por dia
      const llmStatsByDayQuery = sql`
        SELECT 
          DATE_TRUNC('day', created_at) as day,
          model,
          COUNT(*) as request_count,
          SUM(input_tokens) as input_tokens,
          SUM(output_tokens) as output_tokens,
          SUM(total_tokens) as total_tokens
        FROM llm_usage_logs
        WHERE created_at BETWEEN ${startDate.toISOString()} AND ${endDate.toISOString()}
        GROUP BY DATE_TRUNC('day', created_at), model
        ORDER BY day ASC, model
      `;
      
      const llmStatsByDay = await db.execute(llmStatsByDayQuery);
      
      // 2. Estatísticas de uso por usuário
      const userStatsQuery = sql`
        SELECT 
          u.id as user_id,
          u.email,
          u.role,
          COUNT(l.id) as request_count,
          SUM(l.input_tokens) as input_tokens,
          SUM(l.output_tokens) as output_tokens,
          SUM(l.total_tokens) as total_tokens
        FROM llm_usage_logs l
        JOIN users u ON l.user_id = u.id
        WHERE l.created_at BETWEEN ${startDate.toISOString()} AND ${endDate.toISOString()}
        GROUP BY u.id, u.email, u.role
        ORDER BY SUM(l.total_tokens) DESC
      `;
      
      const userStats = await db.execute(userStatsQuery);
      
      // 3. Estatísticas de uso por widget
      const widgetStatsQuery = sql`
        SELECT 
          w.id as widget_id,
          w.name as widget_name,
          COUNT(l.id) as request_count,
          SUM(l.input_tokens) as input_tokens,
          SUM(l.output_tokens) as output_tokens,
          SUM(l.total_tokens) as total_tokens
        FROM llm_usage_logs l
        JOIN widgets w ON l.widget_id = w.id
        WHERE l.created_at BETWEEN ${startDate.toISOString()} AND ${endDate.toISOString()}
        GROUP BY w.id, w.name
        ORDER BY SUM(l.total_tokens) DESC
      `;
      
      const widgetStats = await db.execute(widgetStatsQuery);
      
      // 4. Estatísticas de documentos
      const documentStatsQuery = sql`
        SELECT 
          status,
          COUNT(*) as count,
          AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_processing_time_seconds
        FROM documents
        WHERE created_at BETWEEN ${startDate.toISOString()} AND ${endDate.toISOString()}
        GROUP BY status
      `;
      
      const documentStats = await db.execute(documentStatsQuery);
      
      // 5. Atividade de sessões por dia
      const sessionStatsQuery = sql`
        SELECT 
          DATE_TRUNC('day', created_at) as day,
          COUNT(*) as session_count,
          'chat' as type
        FROM chat_sessions
        WHERE created_at BETWEEN ${startDate.toISOString()} AND ${endDate.toISOString()}
        GROUP BY DATE_TRUNC('day', created_at)
        
        UNION ALL
        
        SELECT 
          DATE_TRUNC('day', created_at) as day,
          COUNT(*) as session_count,
          'widget' as type
        FROM widget_sessions
        WHERE created_at BETWEEN ${startDate.toISOString()} AND ${endDate.toISOString()}
        GROUP BY DATE_TRUNC('day', created_at)
        
        ORDER BY day ASC, type
      `;
      
      const sessionStats = await db.execute(sessionStatsQuery);
      
      // Preparar CSV com várias seções
      let csvContent = "RELATÓRIO DE ESTATÍSTICAS DO SISTEMA\n";
      csvContent += `Período: ${startDate.toISOString()} até ${endDate.toISOString()}\n\n`;
      
      // Seção 1: Estatísticas de LLM por dia
      csvContent += "ESTATÍSTICAS DE USO DE LLM POR DIA\n";
      csvContent += "Data,Modelo,Requisições,Tokens de Entrada,Tokens de Saída,Total de Tokens\n";
      
      for (const row of llmStatsByDay.rows) {
        csvContent += `${new Date(row.day).toISOString().split('T')[0]},"${row.model}",${row.request_count},${row.input_tokens},${row.output_tokens},${row.total_tokens}\n`;
      }
      
      csvContent += "\n";
      
      // Seção 2: Estatísticas por usuário
      csvContent += "ESTATÍSTICAS DE USO POR USUÁRIO\n";
      csvContent += "ID,Email,Perfil,Requisições,Tokens de Entrada,Tokens de Saída,Total de Tokens\n";
      
      for (const row of userStats.rows) {
        csvContent += `${row.user_id},"${row.email}","${row.role}",${row.request_count},${row.input_tokens},${row.output_tokens},${row.total_tokens}\n`;
      }
      
      csvContent += "\n";
      
      // Seção 3: Estatísticas por widget
      csvContent += "ESTATÍSTICAS DE USO POR WIDGET\n";
      csvContent += "ID,Nome,Requisições,Tokens de Entrada,Tokens de Saída,Total de Tokens\n";
      
      for (const row of widgetStats.rows) {
        csvContent += `${row.widget_id},"${row.widget_name}",${row.request_count},${row.input_tokens},${row.output_tokens},${row.total_tokens}\n`;
      }
      
      csvContent += "\n";
      
      // Seção 4: Estatísticas de documentos
      csvContent += "ESTATÍSTICAS DE DOCUMENTOS\n";
      csvContent += "Status,Quantidade,Tempo Médio de Processamento (segundos)\n";
      
      for (const row of documentStats.rows) {
        csvContent += `"${row.status}",${row.count},${Math.round(row.avg_processing_time_seconds || 0)}\n`;
      }
      
      csvContent += "\n";
      
      // Seção 5: Atividade de sessões
      csvContent += "ATIVIDADE DE SESSÕES POR DIA\n";
      csvContent += "Data,Tipo,Quantidade\n";
      
      for (const row of sessionStats.rows) {
        csvContent += `${new Date(row.day).toISOString().split('T')[0]},"${row.type === 'chat' ? 'Chat Principal' : 'Widget Embedado'}",${row.session_count}\n`;
      }
      
      // Configurar cabeçalhos para download
      res.setHeader('Content-Disposition', 'attachment; filename=system-stats.csv');
      res.setHeader('Content-Type', 'text/csv');
      
      // Enviar o arquivo CSV
      res.send(csvContent);
      
      // Log da exportação
      await logAction({
        userId: req.user!.id,
        action: "export_system_stats",
        details: { 
          periodStart: startDate.toISOString(),
          periodEnd: endDate.toISOString()
        },
        ipAddress: req.ip
      });
      
    } catch (error: any) {
      console.error("Erro ao exportar estatísticas do sistema:", error);
      res.status(500).json({ 
        success: false, 
        message: "Erro ao exportar estatísticas do sistema", 
        error: error.message
      });
    }
  });
  
  // LLM Usage Logs (admin)
  app.get("/api/admin/llm/usage-logs", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      // Parse query parameters
      const options: any = {};
      
      if (req.query.startDate) {
        options.startDate = new Date(req.query.startDate as string);
      }
      
      if (req.query.endDate) {
        options.endDate = new Date(req.query.endDate as string);
      }
      
      if (req.query.provider && req.query.provider !== "all") {
        options.provider = req.query.provider as string;
      }
      
      if (req.query.userId) {
        options.userId = parseInt(req.query.userId as string);
      }
      
      if (req.query.widgetId) {
        // Widget ID é UUID, não necessita conversão para número
        options.widgetId = req.query.widgetId as string;
      }
      
      if (req.query.success !== undefined) {
        options.success = req.query.success === "true";
      }
      
      if (req.query.limit) {
        options.limit = parseInt(req.query.limit as string);
      } else {
        // Default limit
        options.limit = 100;
      }
      
      const logs = await storage.getLlmUsageLogs(options);
      
      return res.json(logs);
    } catch (error) {
      console.error("Error fetching LLM usage logs:", error);
      return res.status(500).json({ error: "Failed to fetch usage logs" });
    }
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
    
    // Para cada mensagem, adicionar um campo file_url que aponta para o endpoint dedicado
    // se a mensagem tiver arquivo
    const messagesWithEndpoints = messages.map(message => {
      if (message.message_type === "image" || message.message_type === "file") {
        return {
          ...message,
          file_url: `/api/chat/messages/${message.id}/file`
        };
      }
      return message;
    });
    
    res.json(messagesWithEndpoints);
  });
  
  // Rota para servir arquivos de mensagens de chat diretamente do banco de dados
  app.get("/api/chat/messages/:id/file", isAuthenticated, async (req, res) => {
    try {
      const messageId = parseInt(req.params.id);
      
      if (isNaN(messageId)) {
        return res.status(400).json({ message: "ID de mensagem inválido" });
      }
      
      // Obter a mensagem do banco de dados
      const message = await storage.getChatMessage(messageId);
      
      if (!message) {
        return res.status(404).json({ message: "Mensagem não encontrada" });
      }
      
      // Verificar se o usuário tem permissão para acessar a mensagem
      const session = await storage.getChatSession(message.session_id);
      if (!session || (session.user_id !== req.user!.id && req.user!.role !== "admin")) {
        return res.status(403).json({ message: "Acesso não autorizado" });
      }
      
      // Verificar se a mensagem tem dados de arquivo
      if (!message.file_data || !message.file_mime_type) {
        // Se não tiver dados no banco, pode redirecionar para o file_url original
        if (message.file_url && (message.file_url.startsWith('http') || message.file_url.startsWith('/uploads/'))) {
          return res.redirect(message.file_url);
        }
        return res.status(404).json({ message: "Arquivo não encontrado" });
      }
      
      // Converter de base64 para Buffer
      const fileBuffer = Buffer.from(message.file_data, 'base64');
      
      // Definir o tipo de conteúdo
      res.setHeader('Content-Type', message.file_mime_type);
      // Permitir cache no cliente
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 horas
      
      // Enviar o arquivo
      res.send(fileBuffer);
    } catch (error) {
      console.error("Erro ao servir arquivo da mensagem:", error);
      res.status(500).json({ message: "Erro ao servir arquivo" });
    }
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
    
    // Verificar se o usuário pode enviar mensagens (limite do plano)
    const canSendMessage = await storage.checkMessageLimit(req.user!.id);
    if (!canSendMessage) {
      // Delete uploaded file if it exists
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      
      const user = await storage.getUser(req.user!.id);
      const language = user?.language || 'en';
      
      return res.status(403).json({
        message: language === 'pt' 
          ? "Você atingiu o limite de mensagens do seu plano. Atualize para um plano superior para continuar."
          : "You have reached your plan's message limit. Upgrade to a higher plan to continue.",
        limitReached: true
      });
    }
    
    try {
      let messageType = "text";
      let content = req.body.content;
      let fileUrl = null;
      
      // If file uploaded
      let fileBase64 = null;
      if (req.file) {
        const isImage = req.file.mimetype.startsWith("image/");
        messageType = isImage ? "image" : "file";
        fileUrl = `/uploads/files/${path.basename(req.file.path)}`;
        content = req.file.originalname;
        
        // Preparar dados para base64 (apenas para imagens como fallback)
        if (isImage) {
          try {
            // Converter imagem para base64 como fallback
            const fileData = fs.readFileSync(req.file.path);
            fileBase64 = `data:${req.file.mimetype};base64,${fileData.toString('base64')}`;
            console.log(`Imagem convertida para base64 (primeiros 50 caracteres): ${fileBase64.substring(0, 50)}...`);
          } catch (error) {
            console.error("Erro ao converter imagem para base64:", error);
            // Continuar mesmo se falhar, já que é apenas um fallback
          }
        }
      }
      
      // Create user message
      const messageData: any = {
        session_id: sessionId,
        user_id: req.user!.id,
        message_type: messageType as "text" | "image" | "file",
        content,
        file_url: fileUrl,
        is_user: true
      };
      
      // Se tiver arquivo, salvar dados de imagem em base64 e tipo MIME
      if (req.file) {
        try {
          // Ler o arquivo usando fs (já garantimos acima que o arquivo existe)
          const fileData = fs.readFileSync(req.file.path);
          
          // Salvar dados raw do arquivo
          messageData.file_data = fileData.toString('base64');
          messageData.file_mime_type = req.file.mimetype;
          
          console.log(`Arquivo convertido para base64 e armazenado no banco (tamanho: ${messageData.file_data.length} bytes)`);
        } catch (error) {
          console.error("Erro ao converter arquivo para base64:", error);
          // Continuar mesmo se falhar, já que ainda temos o file_url como fallback
        }
      }
      
      const userMessage = await storage.createChatMessage(messageData);
      
      // Incrementar contagem de mensagens (cada mensagem do usuário conta 1)
      await storage.incrementMessageCount(req.user!.id);
      
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
            botResponse = await analyzeImage(filePath, session.language, req.user?.id);
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
          
          // Usar o novo processador com documentos de treinamento
          console.log("Usando processador com documentos de treinamento para interface de técnicos");
          try {
            // Processar mensagem com documentos de treinamento
            botResponse = await processChatWithTrainedDocuments(content, req.user?.id);
          } catch (trainedError) {
            console.error("Erro ao processar com documentos de treinamento:", trainedError);
            
            // Fallback para processamento tradicional
            console.log("Usando processamento regular como fallback");
            const llmConfig = await getActiveLlmInfo();
            botResponse = await processTextMessage(content, session.language, llmConfig, [], req.user?.id);
          }
          
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
        
        // Incrementar contagem de mensagens (cada resposta do LLM também conta 1)
        await storage.incrementMessageCount(req.user!.id);
      }
      
      // Se for uma imagem e temos base64, incluí-lo no objeto da mensagem
      if (req.file && req.file.mimetype.startsWith("image/") && fileBase64) {
        // Criar uma cópia da mensagem com fileBase64 incorporado
        const messageWithBase64 = {
          ...userMessage,
          fileBase64
        };
        
        // Criar objeto de resposta completo
        const responseObj = {
          userMessage: messageWithBase64,
          // Se houver resposta do bot, incluir também
          ...(botResponse ? { aiMessage: { 
            session_id: sessionId,
            user_id: req.user!.id,
            message_type: "text",
            content: botResponse,
            file_url: null,
            is_user: false,
            // Adicionar outros campos que podem estar faltando
            id: -1, // Placeholder, será substituído quando buscarmos do banco
            created_at: new Date().toISOString()
          }} : {})
        };
        
        res.status(201).json(responseObj);
      } else {
        // Resposta regular (sem base64)
        const responseObj = {
          userMessage: userMessage,
          // Se houver resposta do bot, incluir também
          ...(botResponse ? { aiMessage: { 
            session_id: sessionId,
            user_id: req.user!.id,
            message_type: "text",
            content: botResponse,
            file_url: null,
            is_user: false,
            // Adicionar outros campos que podem estar faltando
            id: -1, // Placeholder, será substituído quando buscarmos do banco
            created_at: new Date().toISOString()
          }} : {})
        };
        
        res.status(201).json(responseObj);
      }
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
      res.status(500).json({ message: "Erro ao buscar documentos de treinamento", error: error.message });
    }
  });
  
  app.get("/api/training/documents/:id", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      console.log("Buscando documento de treinamento específico. ID:", req.params.id);
      const document = await storage.getTrainingDocument(parseInt(req.params.id));
      if (!document) {
        console.log("Documento não encontrado:", req.params.id);
        return res.status(404).json({ message: "Documento não encontrado" });
      }
      res.json(document);
    } catch (error) {
      console.error("Erro ao buscar documento de treinamento:", error);
      res.status(500).json({ message: "Erro ao buscar documento de treinamento", error: error.message });
    }
  });
  
  app.post("/api/training/documents", isAuthenticated, checkRole("admin"), trainingDocumentUpload.single("file"), async (req, res) => {
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
      } else if (document_type === "image" && req.file) {
        // Processar upload de imagem sem necessidade de conteúdo de texto
        file_url = `/uploads/${req.file.filename}`;
        console.log(`Processando imagem: ${file_url} - Tipo MIME: ${req.file.mimetype} - Tamanho: ${(req.file.size / (1024 * 1024)).toFixed(2)}MB`);
        
        try {
          // Importar o processador de documentos usando dynamic import
          const documentProcessors = await import('./document-processors');
          
          // Processar a imagem para extrair conteúdo usando LLM multimodal
          const filePath = path.join(process.cwd(), "uploads/files", req.file.filename);
          content = await documentProcessors.processDocumentContent("image", filePath);
          
          if (!content) {
            console.warn(`Não foi possível extrair o conteúdo da imagem ${req.file.originalname}`);
          } else {
            console.log(`Conteúdo extraído da imagem com sucesso: ${content.length} caracteres`);
          }
        } catch (extractionError) {
          console.error(`Erro ao processar imagem ${req.file.originalname}:`, extractionError);
          content = `[ERRO DE ANÁLISE] Não foi possível analisar a imagem: ${extractionError instanceof Error ? extractionError.message : 'Erro desconhecido'}`;
        }
      } else if (document_type === "file" && req.file) {
        file_url = `/uploads/${req.file.filename}`;
        
        // Extrair conteúdo do arquivo usando os processadores de documentos
        const filePath = path.join(process.cwd(), "uploads/files", req.file.filename);
        console.log(`Processando arquivo: ${filePath} - Tipo MIME: ${req.file.mimetype} - Tamanho: ${(req.file.size / (1024 * 1024)).toFixed(2)}MB`);
        
        try {
          // Importar o processador de documentos usando dynamic import
          const documentProcessors = await import('./document-processors');
          
          // Processar o documento com tratamento adequado de erros
          content = await documentProcessors.processDocumentContent("file", filePath);
          
          // Caso não tenha conseguido extrair o conteúdo
          if (!content) {
            console.warn(`Não foi possível extrair o conteúdo do arquivo ${req.file.originalname}`);
          } else {
            console.log(`Conteúdo extraído com sucesso: ${content.length} caracteres`);
          }
        } catch (extractionError) {
          console.error(`Erro ao extrair conteúdo do arquivo ${req.file.originalname}:`, extractionError);
          // Armazenar a mensagem de erro no conteúdo para que o documento ainda possa ser salvo
          content = `[ERRO DE EXTRAÇÃO] Não foi possível extrair o conteúdo do arquivo: ${extractionError instanceof Error ? extractionError.message : 'Erro desconhecido'}`;
        }
      } else if (document_type === "website") {
        website_url = req.body.website_url;
        
        // Se tiver URL, também extrair conteúdo do site
        if (website_url) {
          // Importar o processador de documentos usando dynamic import
          const documentProcessors = await import('./document-processors');
          
          try {
            content = await documentProcessors.extractTextFromWebsite(website_url);
            console.log(`Conteúdo extraído do site: ${content.length} caracteres`);
          } catch (webError) {
            console.error(`Erro ao extrair conteúdo do site ${website_url}:`, webError);
            content = `Não foi possível extrair conteúdo do site: ${webError.message}`;
          }
        }
      }
      
      console.log("Dados para criação do documento:", {
        name,
        description,
        document_type,
        content: content ? `${content.substring(0, 50)}... (${content.length} caracteres)` : null,
        file_url,
        website_url,
        created_by: req.user?.id
      });
      
      // Criar documento com status "processing" inicialmente
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
      
      // Processar documento imediatamente (em vez de assíncrono)
      console.log(`Processando documento de treinamento ID ${document.id}...`);
      
      try {
        // Processar embeddings para melhorar a pesquisa semântica usando dynamic import
        const documentEmbedding = await import('./document-embedding');
        
        console.log(`Iniciando processamento de embeddings para documento ${document.id}`);
        
        // Atualizar status para processamento
        await storage.updateTrainingDocument(document.id, {
          status: "processing",
          updated_at: new Date()
        });
        
        // Processar documento para gerar embeddings
        const embeddingSuccess = await documentEmbedding.processDocumentEmbeddings(document.id);
        
        if (!embeddingSuccess) {
          console.warn(`Falha no processamento de embeddings para documento ${document.id}. Continuando sem embeddings.`);
          
          // Mesmo com falha nos embeddings, o documento ainda é utilizável
          await storage.updateTrainingDocument(document.id, {
            status: "completed",
            updated_at: new Date()
          });
        }
        
        console.log(`Documento de treinamento ID ${document.id} processado com sucesso.`);
        
        // Buscar o documento atualizado para retornar na resposta
        const updatedDocument = await storage.getTrainingDocument(document.id);
        res.status(201).json(updatedDocument);
      } catch (processingError) {
        console.error(`Erro ao processar documento de treinamento ID ${document.id}:`, processingError);
        
        // Atualizar o status para "error" em caso de falha
        await storage.updateTrainingDocument(document.id, {
          status: "error",
          error_message: processingError instanceof Error ? processingError.message : "Erro desconhecido",
          updated_at: new Date()
        });
        
        // Ainda retorna 201 porque o documento foi criado, mesmo com erro no processamento
        const errorDocument = await storage.getTrainingDocument(document.id);
        res.status(201).json(errorDocument);
      }
    } catch (error) {
      console.error("Erro completo ao criar documento de treinamento:", error);
      res.status(500).json({ 
        message: "Erro ao criar documento de treinamento", 
        error: error instanceof Error ? error.message : "Erro desconhecido",
        details: "Verifique o console para mais informações"
      });
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
        return res.status(404).json({ message: "Documento não encontrado" });
      }
      
      res.json(document);
    } catch (error) {
      res.status(500).json({ message: "Erro ao atualizar documento de treinamento" });
    }
  });
  
  // Rota PATCH para atualização parcial com suporte a imagens
  app.patch("/api/training/documents/:id", isAuthenticated, checkRole("admin"), trainingDocumentUpload.single('image'), async (req, res) => {
    try {
      console.log("PATCH /api/training/documents/:id - Atualizando documento com imagem");
      const id = parseInt(req.params.id);
      
      // Obter documento atual
      const existingDoc = await storage.getTrainingDocument(id);
      if (!existingDoc) {
        return res.status(404).json({ message: "Documento não encontrado" });
      }
      
      // Preparar dados para atualização
      const updateData: any = {
        updated_at: new Date()
      };
      
      // Adicionar campos do body se presentes
      if (req.body.name) updateData.name = req.body.name;
      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (req.body.content) updateData.content = req.body.content;
      if (req.body.website_url) updateData.website_url = req.body.website_url;
      if (req.body.status) updateData.status = req.body.status;
      
      // Processar arquivo de imagem se enviado
      if (req.file) {
        console.log("Arquivo de imagem recebido:", req.file.filename);
        updateData.image_url = `/uploads/${req.file.filename}`;
        
        // Se documento já tinha uma imagem, excluir a antiga
        if (existingDoc.image_url) {
          try {
            const oldFilePath = path.join(UPLOADS_DIR, existingDoc.image_url.replace("/uploads/", ""));
            if (fs.existsSync(oldFilePath)) {
              fs.unlinkSync(oldFilePath);
              console.log(`Arquivo antigo excluído: ${oldFilePath}`);
            }
          } catch (err) {
            console.error("Erro ao excluir arquivo antigo:", err);
          }
        }
      }
      
      // Atualizar documento
      const updatedDoc = await storage.updateTrainingDocument(id, updateData);
      res.json(updatedDoc);
    } catch (error) {
      console.error("Erro ao atualizar documento:", error);
      res.status(500).json({ 
        message: "Erro ao atualizar documento de treinamento", 
        error: error instanceof Error ? error.message : "Erro desconhecido" 
      });
    }
  });
  
  app.delete("/api/training/documents/:id", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteTrainingDocument(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir documento de treinamento" });
    }
  });
  
  // Training category routes
  app.get("/api/training/categories", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const categories = await storage.getTrainingCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar categorias de treinamento" });
    }
  });
  
  app.get("/api/training/categories/:id", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const category = await storage.getTrainingCategory(parseInt(req.params.id));
      if (!category) {
        return res.status(404).json({ message: "Categoria não encontrada" });
      }
      res.json(category);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar categoria de treinamento" });
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
      res.status(500).json({ message: "Erro ao criar categoria de treinamento" });
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
        return res.status(404).json({ message: "Categoria não encontrada" });
      }
      
      res.json(category);
    } catch (error) {
      res.status(500).json({ message: "Erro ao atualizar categoria de treinamento" });
    }
  });
  
  app.delete("/api/training/categories/:id", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteTrainingCategory(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir categoria de treinamento" });
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
  
  // Rota para testar o conhecimento do documento
  app.post("/api/training/test", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const { query, documentId } = req.body;
      
      if (!query || !documentId) {
        return res.status(400).json({ 
          message: "A consulta e o ID do documento são obrigatórios" 
        });
      }
      
      const result = await testDocumentKnowledge(query, parseInt(documentId));
      
      // Registrar o teste no log de auditoria
      await logAction({
        userId: req.user!.id,
        action: "training_document_tested",
        details: { documentId, usedDocument: result.usedDocument },
        ipAddress: req.ip
      });
      
      res.json(result);
    } catch (error) {
      console.error("Erro ao testar conhecimento do documento:", error);
      res.status(500).json({ 
        message: "Erro ao testar conhecimento do documento", 
        error: error instanceof Error ? error.message : "Erro desconhecido" 
      });
    }
  });
  
  // Rota para resetar o status de documentos com erro ou pendentes
  app.post("/api/training/reset-document-status", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const { documentId } = req.body;
      
      if (!documentId) {
        return res.status(400).json({
          success: false,
          message: "ID do documento é obrigatório"
        });
      }
      
      console.log(`Resetando status do documento ID: ${documentId}`);
      
      // Verificar se o documento existe
      const document = await storage.getTrainingDocument(parseInt(documentId));
      if (!document) {
        return res.status(404).json({
          success: false,
          message: `Documento com ID ${documentId} não encontrado`
        });
      }
      
      // Atualizar o status do documento para "completed" para permitir reprocessamento
      await storage.updateTrainingDocument(parseInt(documentId), {
        status: 'completed',
        error_message: null,
        updated_at: new Date()
      });
      
      // Registrar a ação no log de auditoria
      await logAction({
        userId: req.user!.id,
        action: "document_status_reset",
        details: { documentId, previousStatus: document.status },
        ipAddress: req.ip
      });
      
      return res.json({
        success: true,
        message: `Status do documento ${documentId} resetado com sucesso`
      });
    } catch (error) {
      console.error("Erro ao resetar status do documento:", error);
      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });
  
  // Rota para gerar embeddings para documentos existentes
  app.post("/api/training/process-embeddings", isAuthenticated, checkRole("admin"), async (req, res) => {
    try {
      const { documentId } = req.body;
      
      // Processar um documento específico
      if (documentId) {
        console.log(`Processando embeddings para documento específico ID: ${documentId}`);
        
        // Verificar se o documento existe antes de tentar processar
        const document = await storage.getTrainingDocument(parseInt(documentId));
        if (!document) {
          return res.status(404).json({
            success: false,
            message: `Documento com ID ${documentId} não encontrado`
          });
        }
        
        // Iniciar processamento do documento - atualizar status imediatamente
        await storage.updateTrainingDocument(parseInt(documentId), {
          status: 'processing',
          progress: 0,
          error_message: null
        });
          
        // Verificar se o documento tem conteúdo para processar
        if ((!document.content || document.content.trim().length === 0) && 
            (!document.file_path || document.file_path.trim().length === 0)) {
          
          // Atualizar o status do documento para indicar o erro
          await storage.updateTrainingDocument(parseInt(documentId), {
            status: 'error',
            progress: 0,
            error_message: 'Documento sem conteúdo para processamento'
          });
          
          return res.status(400).json({
            success: false,
            message: `Documento ${documentId} não possui conteúdo para processamento de embeddings`
          });
        }
        
        // Importar o processador de embeddings
        // Usando importação dinâmica para ES Modules
        const documentEmbedding = await import('./document-embedding.js');
        const success = await documentEmbedding.processDocumentEmbeddings(parseInt(documentId));
        
        // Registrar a ação no log de auditoria
        await logAction({
          userId: req.user!.id,
          action: "document_embeddings_processed",
          details: { documentId, success },
          ipAddress: req.ip
        });
        
        if (success) {
          return res.json({ 
            success: true, 
            message: `Embeddings gerados com sucesso para o documento ${documentId}` 
          });
        } else {
          // Buscar o documento novamente para obter a mensagem de erro
          const updatedDoc = await storage.getTrainingDocument(parseInt(documentId));
          return res.status(500).json({ 
            success: false, 
            message: updatedDoc?.error_message || `Falha ao gerar embeddings para o documento ${documentId}` 
          });
        }
      } 
      // Processar todos os documentos
      else {
        // Buscar todos os documentos ativos
        const documents = await storage.getTrainingDocuments();
        const activeDocuments = documents.filter(doc => doc.is_active && doc.status === "completed");
        
        if (activeDocuments.length === 0) {
          return res.status(404).json({ 
            success: false, 
            message: "Nenhum documento ativo encontrado para processamento" 
          });
        }
        
        // Registrar a ação no log de auditoria
        await logAction({
          userId: req.user!.id,
          action: "all_documents_embeddings_processing",
          details: { documentCount: activeDocuments.length },
          ipAddress: req.ip
        });
        
        // Iniciar processamento em background
        res.json({ 
          success: true, 
          message: `Iniciando processamento de embeddings para ${activeDocuments.length} documentos`,
          totalDocuments: activeDocuments.length
        });
        
        // Processar documentos em segundo plano
        (async () => {
          const documentEmbedding = await import('./document-embedding.js');
          const { processDocumentEmbeddings } = documentEmbedding;
          let successCount = 0;
          let failCount = 0;
          
          console.log(`Iniciando processamento de embeddings para ${activeDocuments.length} documentos`);
          
          for (const doc of activeDocuments) {
            try {
              console.log(`Processando embeddings para documento ${doc.id}: ${doc.name}`);
              const success = await processDocumentEmbeddings(doc.id);
              
              if (success) {
                successCount++;
                console.log(`Documento ${doc.id} processado com sucesso (${successCount}/${activeDocuments.length})`);
              } else {
                failCount++;
                console.error(`Falha ao processar documento ${doc.id} (${failCount} falhas até agora)`);
              }
            } catch (error) {
              failCount++;
              console.error(`Erro no processamento do documento ${doc.id}:`, error);
            }
          }
          
          console.log(`Processamento de embeddings concluído: ${successCount} sucessos, ${failCount} falhas`);
        })();
      }
    } catch (error) {
      console.error("Erro ao processar embeddings:", error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro desconhecido"
      });
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
      const widgetData: any = {
        user_id: req.user!.id,
        name: validatedData.name,
        greeting: validatedData.greeting,
        theme_color: validatedData.theme_color,
        allowed_domains: Array.isArray(validatedData.allowed_domains) ? validatedData.allowed_domains : [],
        avatar_url: validatedData.avatar_url
      };
      
      // Se tiver arquivo de avatar, processar e armazenar em base64
      if (req.file) {
        // Ler o arquivo e converter para base64
        // Importar fs usando dynamic import (ES Modules)
        const fs = await import('fs');
        const filePath = req.file.path;
        
        try {
          // Ler o arquivo usando fs.promises para ES Modules
          const fileData = await fs.promises.readFile(filePath);
          // Converter para base64
          const base64Data = fileData.toString('base64');
          
          // Armazenar os dados da imagem e o tipo MIME
          widgetData.avatar_data = base64Data;
          widgetData.avatar_mime_type = req.file.mimetype;
          
          // Usamos uma URL genérica inicialmente - o ID será atualizado após a criação
          widgetData.avatar_url = "/api/widgets/avatar";
          
          // Remover arquivo temporário do sistema de arquivos usando fs.promises
          await fs.promises.unlink(filePath);
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
        // Campos de estilo personalizados
        background_color: z.string().optional(),
        font_size: z.string().optional(),
        font_color: z.string().optional(),
        bot_message_bg_color: z.string().optional(),
        user_message_bg_color: z.string().optional(),
        allowed_domains: z.union([
          z.array(z.string()),
          z.string().transform(str => {
            try {
              return JSON.parse(str);
            } catch {
              return [];
            }
          })
        ]).optional(),
        // Adicionando suporte para as opções de iframe
        hide_minimize_button: z.union([
          z.boolean(),
          z.string().transform(val => val === 'true')
        ]).optional(),
        hide_close_button: z.union([
          z.boolean(),
          z.string().transform(val => val === 'true')
        ]).optional(),
        default_height: z.string().optional(),
        default_width: z.string().optional(),
        custom_css: z.string().optional()
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
          // Usando os campos definidos no schema
          updateData = {
            ...updateData,
            avatar_data: base64Data,
            avatar_mime_type: req.file.mimetype,
            avatar_url: `/api/widgets/${id}/avatar`
          };
          
          // A URL já foi configurada no objeto updateData acima
          
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
  
  // Endpoint especial para uso com iframe (compatível com Curseduca e outras plataformas)
  app.get("/api/embed/iframe-widget", async (req, res) => {
    try {
      const apiKey = req.query.key as string;
      
      if (!apiKey) {
        return res.status(401).json({ message: "API key não fornecida. Use o parâmetro 'key'." });
      }
      
      console.log(`[IFRAME] Buscando widget com API key: ${apiKey}`);
      const widget = await storage.getChatWidgetByApiKey(apiKey);
      
      if (!widget) {
        console.log(`[IFRAME] Widget não encontrado para key: ${apiKey}`);
        return res.status(404).json({ message: "Widget não encontrado ou inativo" });
      }
      
      console.log(`[IFRAME] Widget encontrado: ${widget.id}, nome: ${widget.name}`);
      
      // Configurar cabeçalhos adicionais para permitir iframe em qualquer domínio
      res.removeHeader('X-Frame-Options');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Content-Security-Policy', "frame-ancestors *");
      
      // Remover a API key da resposta
      const { api_key, ...safeWidget } = widget;
      
      // Converter URLs relativas para absolutas usando a função utilitária
      if (safeWidget.avatar_url) {
        safeWidget.avatar_url = ensureAbsoluteUrl(safeWidget.avatar_url, req);
      }
      
      return res.json(safeWidget);
    } catch (error) {
      console.error("[IFRAME] Erro ao obter widget:", error);
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
  
  // Rotas para widgets incorporáveis
  
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
          is_user: false
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
        is_user: true
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
        
        // Converter a configuração LLM para o formato esperado pela função processTextMessage
        const formattedLlmConfig: {
          provider: 'anthropic' | 'openai',
          modelName: string,
          apiKey: string,
          tone: 'formal' | 'normal' | 'casual',
          behaviorInstructions: string,
          shouldUseTrained: boolean
        } = {
          // Detecção de provider baseada no nome do modelo, não na chave API
          provider: llmConfig.model_name.startsWith('gpt') ? 'openai' : 'anthropic',
          modelName: llmConfig.model_name,
          apiKey: llmConfig.api_key, // Usa a chave API diretamente, limpeza será feita nas funções getXXXClient
          tone: (llmConfig.tone as 'formal' | 'normal' | 'casual') || 'normal',
          behaviorInstructions: llmConfig.behavior_instructions || '',
          shouldUseTrained: llmConfig.should_use_training !== false
        };
        
        // Processar a mensagem com o LLM
        // Converter mensagens para o formato que a função processTextMessage espera
        const messageHistory = messages.filter(m => m.id !== userMessage.id).map(m => ({
          content: m.content || "",
          role: m.is_user ? "user" : "assistant"
        }));
        
        aiResponse = await processTextMessage(
          content,
          messageHistory,
          formattedLlmConfig,
          undefined,
          widget.user_id,
          session.widget_id
        );
      } catch (error) {
        console.error("Erro ao processar mensagem com LLM:", error);
        aiResponse = "Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.";
      }
      
      // Criar a mensagem da IA
      const aiMessage = await storage.createWidgetChatMessage({
        session_id: parseInt(id),
        content: aiResponse,
        is_user: false
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
  
  // Novas rotas para compatibilidade com o widget (sem o prefixo 'public')
  
  // Rota para encerrar uma sessão de widget
  app.put("/api/widgets/sessions/:id/end", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Verificar se a sessão existe
      const session = await storage.getWidgetChatSession(parseInt(id));
      if (!session) {
        return res.status(404).json({ message: "Sessão não encontrada" });
      }
      
      // Verificar se a sessão já foi encerrada
      if (session.ended_at) {
        return res.status(400).json({ message: "Sessão já encerrada" });
      }
      
      // Encerrar a sessão
      const updatedSession = await storage.endWidgetChatSession(parseInt(id));
      
      res.json(updatedSession);
    } catch (error) {
      console.error("Erro ao encerrar sessão de widget:", error);
      res.status(500).json({ message: "Erro ao encerrar sessão" });
    }
  });
  
  // GET /api/widgets/sessions/active - Retorna a sessão ativa para um widget
  app.get("/api/widgets/sessions/active", async (req, res) => {
    try {
      const { widget_id, visitor_id } = req.query as { widget_id: string, visitor_id: string };
      
      if (!widget_id || !visitor_id) {
        return res.status(400).json({ 
          message: "Parâmetros widget_id e visitor_id são obrigatórios" 
        });
      }
      
      console.log('Buscando sessão ativa para widget:', widget_id, 'e visitante:', visitor_id);
      
      // Buscar widget para confirmar que existe
      const widget = await storage.getChatWidget(widget_id);
      if (!widget) {
        return res.status(404).json({ message: "Widget não encontrado" });
      }
      
      // Buscar sessão ativa
      const session = await storage.getActiveWidgetSession(widget_id, visitor_id);
      if (!session) {
        return res.status(404).json({ message: "Nenhuma sessão ativa encontrada" });
      }
      
      res.json(session);
    } catch (error) {
      console.error('Erro ao buscar sessão ativa:', error);
      res.status(500).json({ message: "Erro ao buscar sessão ativa" });
    }
  });
  
  // POST /api/widgets/sessions - Cria uma nova sessão
  app.post("/api/widgets/sessions", async (req, res) => {
    try {
      const { widget_id, visitor_id, language, referrer_url } = req.body;
      
      if (!widget_id || !visitor_id) {
        return res.status(400).json({ 
          message: "widget_id e visitor_id são obrigatórios" 
        });
      }
      
      console.log('Criando nova sessão para widget:', widget_id, 'e visitante:', visitor_id);
      
      // Buscar widget para confirmar que existe
      const widget = await storage.getChatWidget(widget_id);
      if (!widget) {
        return res.status(404).json({ message: "Widget não encontrado" });
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
        widget_id,
        visitor_id,
        language,
        referrer_url
      });
      
      // Criar mensagem de boas-vindas
      if (widget.greeting) {
        await storage.createWidgetChatMessage({
          session_id: session.id,
          content: widget.greeting,
          is_user: false
        });
      }
      
      res.status(201).json(session);
    } catch (error) {
      console.error("Erro ao criar sessão de widget:", error);
      res.status(500).json({ message: "Erro ao criar sessão de chat" });
    }
  });
  
  // GET /api/widgets-messages - Obtém mensagens de uma sessão (rota modificada para evitar conflito com /api/widgets/:id)
  app.get("/api/widgets-messages", async (req, res) => {
    try {
      const { session_id } = req.query as { session_id: string };
      
      if (!session_id) {
        return res.status(400).json({ message: "Parâmetro session_id é obrigatório" });
      }
      
      const sessionIdNumber = parseInt(session_id);
      
      // Verificar se a sessão existe
      const session = await storage.getWidgetChatSession(sessionIdNumber);
      if (!session) {
        return res.status(404).json({ message: "Sessão não encontrada" });
      }
      
      // Obter mensagens da sessão
      const messages = await storage.getWidgetSessionMessages(sessionIdNumber);
      
      // Para cada mensagem, adicionar um campo file_url que aponta para o endpoint dedicado
      // se a mensagem tiver arquivo
      const messagesWithEndpoints = messages.map(message => {
        if (message.message_type === "image" || message.message_type === "file") {
          return {
            ...message,
            file_url: `/api/widgets-messages/${message.id}/file`
          };
        }
        return message;
      });
      
      res.json(messagesWithEndpoints);
    } catch (error) {
      console.error("Erro ao obter mensagens de sessão de widget:", error);
      res.status(500).json({ message: "Erro ao obter mensagens" });
    }
  });
  
  // Manter a rota antiga por compatibilidade, mas retornando um erro claro
  app.get("/api/widgets/messages", async (req, res) => {
    return res.status(400).json({ 
      message: "Esta rota foi depreciada. Por favor, use /api/widgets-messages em vez disso." 
    });
  });
  
  // Rota para servir arquivos de mensagens de chat widget diretamente do banco de dados
  app.get("/api/widgets-messages/:id/file", async (req, res) => {
    try {
      const messageId = parseInt(req.params.id);
      
      if (isNaN(messageId)) {
        return res.status(400).json({ message: "ID de mensagem inválido" });
      }
      
      // Obter a mensagem do banco de dados
      const message = await storage.getWidgetChatMessage(messageId);
      
      if (!message) {
        return res.status(404).json({ message: "Mensagem não encontrada" });
      }
      
      // Verificar se a mensagem pertence a uma sessão ativa
      const session = await storage.getWidgetChatSession(message.session_id);
      if (!session) {
        return res.status(404).json({ message: "Sessão não encontrada" });
      }
      
      // Verificar se a mensagem tem dados de arquivo
      if (!message.file_data || !message.file_mime_type) {
        // Se não tiver dados no banco, pode redirecionar para o file_url original
        if (message.file_url && (message.file_url.startsWith('http') || message.file_url.startsWith('/uploads/'))) {
          return res.redirect(message.file_url);
        }
        return res.status(404).json({ message: "Arquivo não encontrado" });
      }
      
      // Converter de base64 para Buffer
      const fileBuffer = Buffer.from(message.file_data, 'base64');
      
      // Definir o tipo de conteúdo
      res.setHeader('Content-Type', message.file_mime_type);
      // Permitir cache no cliente
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 horas
      
      // Enviar o arquivo
      res.send(fileBuffer);
    } catch (error) {
      console.error("Erro ao servir arquivo da mensagem de widget:", error);
      res.status(500).json({ message: "Erro ao servir arquivo" });
    }
  });
  
  // POST /api/widgets-messages - Envia uma mensagem para uma sessão (rota modificada para evitar conflito)
  app.post("/api/widgets-messages", async (req, res) => {
    try {
      const { session_id, content, message_type = "text", is_user = true } = req.body;
      
      if (!session_id || content === undefined) {
        return res.status(400).json({ 
          message: "session_id e content são obrigatórios" 
        });
      }
      
      // Verificar se a sessão existe
      const session = await storage.getWidgetChatSession(session_id);
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
      
      // Verificar limite de mensagens do usuário dono do widget
      const canSendMessages = await storage.checkMessageLimit(widget.user_id);
      if (!canSendMessages) {
        return res.status(403).json({ 
          message: "O proprietário deste widget atingiu o limite de mensagens do plano",
          error: "message_limit_reached"
        });
      }
      
      // Criar a mensagem do usuário
      const userMessage = await storage.createWidgetChatMessage({
        session_id,
        content,
        message_type,
        is_user
      });
      
      // Incrementar contagem de mensagens para o usuário (mensagem do visitante)
      await storage.incrementMessageCount(widget.user_id);
      
      // Se a mensagem é do usuário, gerar resposta automática
      if (is_user) {
        // Obter configuração LLM ativa
        const llmConfig = await storage.getActiveLlmConfig();
        if (!llmConfig) {
          return res.status(500).json({ message: "Configuração LLM não encontrada" });
        }
        
        // Processar a resposta da IA
        let aiResponse: string;
        try {
          // Obter o histórico de mensagens da sessão
          const messages = await storage.getWidgetSessionMessages(session_id);
          
          // Converter a configuração LLM para o formato esperado pela função processTextMessage
          const formattedLlmConfig: {
            provider: 'anthropic' | 'openai',
            modelName: string,
            apiKey: string,
            tone: 'formal' | 'normal' | 'casual',
            behaviorInstructions: string,
            shouldUseTrained: boolean,
            temperature: string
          } = {
            provider: llmConfig.model_name.startsWith('gpt') ? "openai" : "anthropic",
            modelName: llmConfig.model_name,
            apiKey: llmConfig.api_key,
            tone: (llmConfig.tone as 'formal' | 'normal' | 'casual') || 'normal',
            behaviorInstructions: llmConfig.behavior_instructions || '',
            shouldUseTrained: llmConfig.should_use_training !== false,
            temperature: llmConfig.temperature || '0.3'
          };

          // Processar a mensagem com o novo processador que incorpora documentos de treinamento
          console.log("Usando processador com documentos de treinamento para processar mensagem do widget");
          try {
            // Processar a mensagem com o LLM e documentos de treinamento
            aiResponse = await processChatWithTrainedDocuments(
              content,
              widget.user_id,
              session.widget_id
            );
          } catch (error) {
            console.error("Erro ao processar mensagem com documentos de treinamento:", error);
            // Fallback para o processador original se houver algum erro
            console.log("Usando processador original como fallback");
            
            // Converter mensagens para o formato antigo
            const messageHistory = messages.filter(m => m.id !== userMessage.id).map(m => ({
              content: m.content || "",
              role: m.is_user ? "user" : "assistant"
            }));
            
            aiResponse = await processTextMessage(
              content,
              session.language || "pt",
              formattedLlmConfig,
              messageHistory,
              widget.user_id,
              session.widget_id
            );
          }
        } catch (error) {
          console.error("Erro ao processar mensagem com LLM:", error);
          aiResponse = "Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.";
        }
        
        // Verificar se o widget tem a opção de dividir respostas longas ativada
        const shouldSplitResponses = widget.split_responses === true;
        
        if (shouldSplitResponses && aiResponse.length > 300) {
          console.log("Dividindo resposta longa em partes menores...");
          
          // Dividir a resposta em partes
          const responseParts = splitLongMessage(aiResponse);
          
          // Criar uma mensagem para cada parte da resposta
          const aiMessages = [];
          
          for (let i = 0; i < responseParts.length; i++) {
            const part = responseParts[i];
            
            // Criar a mensagem da IA para esta parte
            const aiMessage = await storage.createWidgetChatMessage({
              session_id,
              content: part,
              message_type: "text",
              is_user: false
            });
            
            aiMessages.push(aiMessage);
            
            // Incrementar contagem de mensagens para o usuário (apenas uma vez por resposta)
            if (i === 0) {
              await storage.incrementMessageCount(widget.user_id);
            }
          }
          
          // Responder com a mensagem do usuário e a primeira parte da resposta da IA
          res.json({
            userMessage,
            aiMessage: aiMessages[0],
            hasMoreParts: aiMessages.length > 1
          });
        } else {
          // Comportamento padrão - resposta única
          // Criar a mensagem da IA
          const aiMessage = await storage.createWidgetChatMessage({
            session_id,
            content: aiResponse,
            message_type: "text",
            is_user: false
          });
          
          // Incrementar contagem de mensagens para o usuário
          await storage.incrementMessageCount(widget.user_id);
          
          res.json({
            userMessage,
            aiMessage
          });
        }
      } else {
        // Se não for do usuário, só retorna a mensagem criada
        res.json(userMessage);
      }
    } catch (error) {
      console.error("Erro ao enviar mensagem para widget:", error);
      res.status(500).json({ message: "Erro ao enviar mensagem" });
    }
  });
  
  // Rota para upload de arquivo do widget
  app.post("/api/widgets/upload", upload.single('file'), async (req, res) => {
    try {
      const sessionId = req.body.session_id;
      
      if (!sessionId) {
        return res.status(400).json({ message: "session_id é obrigatório" });
      }
      
      if (!req.file) {
        return res.status(400).json({ message: "Nenhum arquivo enviado" });
      }
      
      // Verificar se a sessão existe
      const session = await storage.getWidgetChatSession(parseInt(sessionId));
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
      
      // Verificar limite de mensagens do usuário dono do widget
      const canSendMessages = await storage.checkMessageLimit(widget.user_id);
      if (!canSendMessages) {
        return res.status(403).json({ 
          message: "O proprietário deste widget atingiu o limite de mensagens do plano",
          error: "message_limit_reached"
        });
      }
      
      // Processar arquivo
      const file = req.file;
      // Criar URL absoluta com hostname completo para garantir compatibilidade
      const hostname = req.get('host') || '';
      const protocol = req.protocol || 'http';
      const fileUrl = `${protocol}://${hostname}/uploads/${file.filename}`;
      const isImage = file.mimetype.startsWith('image/');
      const messageType = isImage ? 'image' : 'file';
      
      // Preparar dados para base64 (principal método para imagens)
      let fileBase64 = null;
      if (isImage) {
        try {
          // Converter imagem para base64 como método principal de exibição
          const fileData = fs.readFileSync(file.path);
          fileBase64 = `data:${file.mimetype};base64,${fileData.toString('base64')}`;
          console.log(`Imagem convertida para base64 (primeiros 50 caracteres): ${fileBase64.substring(0, 50)}...`);
          
          // Verificar e registrar tamanho do base64 para diagnóstico
          const base64Size = fileBase64.length;
          console.log(`Tamanho da string base64: ${base64Size} caracteres`);
          
          // Se o tamanho for muito grande (> 5MB), gerar aviso
          if (base64Size > 5 * 1024 * 1024) {
            console.warn(`AVISO: String base64 muito grande (${Math.round(base64Size/1024/1024)}MB). Pode causar problemas de desempenho.`);
          }
        } catch (error) {
          console.error("Erro ao converter imagem para base64:", error);
          // Falha na conversão para base64 é crítica para imagens
          return res.status(500).json({ 
            message: "Erro ao processar imagem, tente novamente com uma imagem menor",
            error: "image_processing_error" 
          });
        }
      }
      
      // Criar a mensagem do usuário com o arquivo
      const messageData: any = {
        session_id: parseInt(sessionId),
        content: file.originalname,
        message_type: messageType,
        file_url: fileUrl,
        is_user: true
      };
      
      // Salvar dados de imagem em base64 e tipo MIME
      if (file) {
        try {
          // Ler o arquivo usando fs
          const fileData = fs.readFileSync(file.path);
          
          // Salvar dados raw do arquivo
          messageData.file_data = fileData.toString('base64');
          messageData.file_mime_type = file.mimetype;
          
          console.log(`Arquivo convertido para base64 e armazenado no banco (tamanho: ${messageData.file_data.length} bytes)`);
        } catch (error) {
          console.error("Erro ao converter arquivo para base64:", error);
          // Continuar mesmo se falhar, já que ainda temos o file_url como fallback
        }
      }
      
      const userMessage = await storage.createWidgetChatMessage(messageData);
      
      // Incrementar contagem de mensagens para o usuário (enviada pelo visitante)
      await storage.incrementMessageCount(widget.user_id);
      
      // Se é uma imagem, analisar com IA
      let aiResponse = "";
      if (isImage) {
        try {
          // Usar a linguagem da sessão do widget em vez de tentar obter do llmConfig
          // que não tem essa propriedade
          aiResponse = await analyzeImage(file.path, session.language, undefined, session.widget_id);
        } catch (error) {
          console.error("Erro ao analisar imagem:", error);
          aiResponse = "Desculpe, não foi possível analisar essa imagem.";
        }
      } else {
        // Se não é imagem, verificar se é um tipo de arquivo que pode ser analisado
        try {
          if (file.mimetype === 'application/pdf' || file.mimetype === 'text/plain') {
            // Usar a linguagem da sessão do widget em vez de tentar obter do llmConfig
            aiResponse = await analyzeFile(file.path, session.language, undefined, widget.user_id, session.widget_id);
          } else {
            aiResponse = "Recebi seu arquivo. Como posso ajudar com ele?";
          }
        } catch (error) {
          console.error("Erro ao analisar arquivo:", error);
          aiResponse = "Recebi seu arquivo, mas não foi possível analisá-lo. Como posso ajudar?";
        }
      }
      
      // Verificar se o widget tem a opção de dividir respostas longas ativada
      const shouldSplitResponses = widget.split_responses === true;
      
      let aiMessages = [];
      
      if (shouldSplitResponses && aiResponse.length > 300) {
        console.log("Dividindo resposta longa em partes menores (upload de arquivo)...");
        
        // Dividir a resposta em partes
        const responseParts = splitLongMessage(aiResponse);
        
        // Criar uma mensagem para cada parte da resposta
        for (let i = 0; i < responseParts.length; i++) {
          const part = responseParts[i];
          
          // Criar a mensagem da IA para esta parte
          const aiMessage = await storage.createWidgetChatMessage({
            session_id: parseInt(sessionId),
            content: part,
            message_type: "text",
            is_user: false
          });
          
          aiMessages.push(aiMessage);
          
          // Incrementar contagem de mensagens para o usuário (apenas uma vez por resposta)
          if (i === 0) {
            await storage.incrementMessageCount(widget.user_id);
          }
        }
      } else {
        // Comportamento padrão - resposta única
        // Criar a mensagem da IA com a resposta
        const aiMessage = await storage.createWidgetChatMessage({
          session_id: parseInt(sessionId),
          content: aiResponse,
          message_type: "text",
          is_user: false
        });
        
        aiMessages.push(aiMessage);
        
        // Incrementar contagem de mensagens para o usuário
        await storage.incrementMessageCount(widget.user_id);
      }
      
      // Buscar as mensagens completas e atualizadas do banco
      const updatedUserMessage = await storage.getWidgetChatMessage(userMessage.id);
      
      // Para a mensagem da IA, pegar a primeira se houver várias
      const aiMessageId = aiMessages.length > 0 ? aiMessages[0].id : null;
      const updatedAiMessage = aiMessageId ? await storage.getWidgetChatMessage(aiMessageId) : null;
      
      // Criar objeto completo da mensagem do usuário para resposta
      // Assegurando que a URL do arquivo esteja sempre presente e correta
      const userMessageWithFile = {
        ...(updatedUserMessage || userMessage),
        // Garantir que a URL do arquivo seja preservada, mesmo se o banco 
        // retornar uma URL diferente ou nula
        file_url: fileUrl
      };
      
      // Certificar-se de que a mensagem AI tenha os campos corretos
      const aiMessageFinal = updatedAiMessage || (aiMessages.length > 0 ? aiMessages[0] : null);
      
      // Log para debug
      console.log("Enviando resposta com mensagem do usuário:", {
        id: userMessageWithFile.id,
        tipo: userMessageWithFile.message_type,
        url: userMessageWithFile.file_url,
        aiMessages: aiMessages.length
      });
      
      // Incluir base64 diretamente na mensagem do usuário se for uma imagem
      if (isImage && fileBase64) {
        userMessageWithFile.fileBase64 = fileBase64;
      }
      
      // Verificar se temos múltiplas partes da resposta
      const hasMoreParts = aiMessages.length > 1;
      
      // Montar objeto de resposta
      const responseObj = {
        userMessage: userMessageWithFile,
        aiMessage: aiMessageFinal,
        // Incluir URL do arquivo separadamente para garantir
        fileUrl: fileUrl,
        // Incluir base64 também no objeto principal para manter compatibilidade
        // com código que espera encontrá-lo aqui
        fileBase64: isImage ? fileBase64 : null,
        // Indicar se há mais partes da resposta
        hasMoreParts: hasMoreParts
      };
      
      res.json(responseObj);
    } catch (error) {
      console.error("Erro ao fazer upload de arquivo para widget:", error);
      res.status(500).json({ message: "Erro ao processar arquivo" });
    }
  });
  
  // Rota para obter partes adicionais de uma resposta longa
  app.get("/api/widgets/message-parts", async (req, res) => {
    try {
      const messageId = req.query.message_id as string;
      const sessionId = req.query.session_id as string;
      
      if (!messageId || !sessionId) {
        return res.status(400).json({ 
          message: "message_id e session_id são obrigatórios" 
        });
      }
      
      // Converter para números e verificar se são válidos
      const message_id = parseInt(messageId);
      const session_id = parseInt(sessionId);
      
      if (isNaN(message_id) || isNaN(session_id)) {
        return res.status(400).json({ 
          message: "message_id ou session_id inválidos" 
        });
      }
      
      // Buscar a mensagem original para verificar se é uma resposta da IA
      const originalMessage = await storage.getWidgetChatMessage(message_id);
      if (!originalMessage) {
        return res.status(404).json({ message: "Mensagem não encontrada" });
      }
      
      if (originalMessage.is_user) {
        return res.status(400).json({ 
          message: "Apenas mensagens da IA podem ter partes adicionais" 
        });
      }
      
      if (originalMessage.session_id !== session_id) {
        return res.status(403).json({ 
          message: "A mensagem não pertence à sessão informada" 
        });
      }
      
      // Buscar todas as mensagens da sessão
      const allMessages = await storage.getWidgetSessionMessages(session_id);
      
      // Filtrar para obter apenas as mensagens da IA que vieram DEPOIS da mensagem original
      const subsequentAiMessages = allMessages
        .filter(msg => 
          !msg.is_user && 
          msg.id > originalMessage.id && 
          msg.message_type === "text"
        )
        .sort((a, b) => a.id - b.id); // Ordenar por ID para garantir a sequência correta
      
      // Retornar as partes adicionais
      res.json({
        originalMessage,
        additionalParts: subsequentAiMessages,
        hasMoreParts: subsequentAiMessages.length > 0
      });
    } catch (error) {
      console.error("Erro ao buscar partes adicionais de mensagem:", error);
      res.status(500).json({ message: "Erro ao buscar partes adicionais" });
    }
  });
  
  // ===== FIM DAS ROTAS DE WIDGETS =====

  const httpServer = createServer(app);

  return httpServer;
}
