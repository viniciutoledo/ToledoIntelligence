import {
  users, User, InsertUser,
  llmConfigs, LlmConfig, InsertLlmConfig,
  avatars, Avatar, InsertAvatar,
  chatSessions, ChatSession, InsertChatSession,
  chatMessages, ChatMessage, InsertChatMessage,
  auditLogs, AuditLog, InsertAuditLog,
  otpTokens, OtpToken, InsertOtpToken,
  planFeatures, PlanFeature, InsertPlanFeature,
  planPricing, PlanPricing, InsertPlanPricing,
  analysisReports, AnalysisReport, InsertAnalysisReport,
  supportTickets, SupportTicket, InsertSupportTicket,
  chatWidgets, ChatWidget, InsertChatWidget,
  widgetChatSessions, WidgetChatSession, InsertWidgetChatSession,
  widgetChatMessages, WidgetChatMessage, InsertWidgetChatMessage,
  knowledgeBase, KnowledgeBase, InsertKnowledgeBase,
  llmUsageLogs, LlmUsageLog, InsertLlmUsageLog,
  documentChunks, DocumentChunk, InsertDocumentChunk
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import crypto from "crypto";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  // User management
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  getUsersBySubscriptionTier(tier: "none" | "basic" | "intermediate"): Promise<User[]>;
  
  // LLM model usage tracking
  logLlmUsage(log: InsertLlmUsageLog): Promise<void>;
  getLlmUsageLogs(options?: {
    startDate?: Date;
    endDate?: Date;
    provider?: string;
    userId?: number;
    widgetId?: string; // UUID para widget_id em vez de número
    limit?: number;
    success?: boolean;
  }): Promise<LlmUsageLog[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<User>): Promise<User | undefined>;
  updateLastLogin(id: number): Promise<User | undefined>;
  blockUser(id: number): Promise<User | undefined>;
  unblockUser(id: number): Promise<User | undefined>;
  deleteUser(id: number): Promise<void>;
  
  // Login security
  getRecentLoginAttempts(userId: number, minutes: number): Promise<number>;
  recordLoginAttempt(userId: number): Promise<void>;
  
  // LLM configuration
  getLlmConfig(id: number): Promise<LlmConfig | undefined>;
  getActiveLlmConfig(): Promise<LlmConfig | undefined>;
  createLlmConfig(config: InsertLlmConfig): Promise<LlmConfig>;
  updateLlmConfig(id: number, data: Partial<LlmConfig>): Promise<LlmConfig | undefined>;
  setActiveLlmConfig(id: number): Promise<LlmConfig | undefined>;
  
  // LLM usage logging - redundante com a declaração acima, será removida
  
  // Avatar management
  getAvatar(id: number): Promise<Avatar | undefined>;
  getActiveAvatar(): Promise<Avatar | undefined>;
  createAvatar(avatar: InsertAvatar): Promise<Avatar>;
  updateAvatar(id: number, data: Partial<Avatar>): Promise<Avatar | undefined>;
  setActiveAvatar(id: number): Promise<Avatar | undefined>;
  
  // Chat sessions
  getChatSession(id: number): Promise<ChatSession | undefined>;
  getUserChatSessions(userId: number): Promise<ChatSession[]>;
  createChatSession(session: InsertChatSession): Promise<ChatSession>;
  endChatSession(id: number): Promise<ChatSession | undefined>;
  
  // Chat messages
  getChatMessage(id: number): Promise<ChatMessage | undefined>;
  getSessionMessages(sessionId: number): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  
  // Audit logs
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(userId?: number): Promise<AuditLog[]>;
  
  // OTP management
  createOtpToken(token: InsertOtpToken): Promise<OtpToken>;
  getOtpToken(token: string, userId: number): Promise<OtpToken | undefined>;
  markOtpTokenUsed(id: number): Promise<OtpToken | undefined>;
  deleteExpiredOtpTokens(): Promise<void>;
  
  // Session store
  sessionStore: session.Store;
  
  // User sessions
  getUserActiveSession(userId: number): Promise<{ sessionId: string } | undefined>;
  setUserActiveSession(userId: number, sessionId: string): Promise<void>;
  removeUserActiveSession(userId: number): Promise<void>;
  
  // Training documents
  getTrainingDocument(id: number): Promise<TrainingDocument | undefined>;
  
  // Knowledge Base - Para embeddings e busca semântica
  getKnowledgeEntry(id: number): Promise<KnowledgeBase | undefined>;
  getKnowledgeEntries(language: string, limit?: number): Promise<KnowledgeBase[]>;
  getKnowledgeEntriesBySource(sourceType: string, sourceId: number): Promise<KnowledgeBase[]>;
  createKnowledgeEntry(entry: InsertKnowledgeBase): Promise<KnowledgeBase>;
  updateKnowledgeEntry(id: number, data: Partial<KnowledgeBase>): Promise<KnowledgeBase | undefined>;
  deleteKnowledgeEntry(id: number): Promise<void>;
  
  // Document Chunks - Para RAG (Retrieval Augmented Generation)
  createDocumentChunk(chunk: InsertDocumentChunk): Promise<DocumentChunk>;
  getDocumentChunk(id: number): Promise<DocumentChunk | undefined>;
  getDocumentChunksByDocument(documentId: number): Promise<DocumentChunk[]>;
  deleteDocumentChunk(id: number): Promise<void>;
  deleteDocumentChunksByDocument(documentId: number): Promise<void>;
  getTrainingDocuments(): Promise<TrainingDocument[]>;
  createTrainingDocument(document: InsertTrainingDocument): Promise<TrainingDocument>;
  updateTrainingDocument(id: number, data: Partial<TrainingDocument>): Promise<TrainingDocument | undefined>;
  deleteTrainingDocument(id: number): Promise<void>;
  updateTrainingDocumentStatus(id: number, status: string, errorMessage?: string): Promise<TrainingDocument | undefined>;
  searchTrainingDocuments(terms: string[]): Promise<TrainingDocument[]>;
  
  // Training categories
  getTrainingCategory(id: number): Promise<TrainingCategory | undefined>;
  getTrainingCategories(): Promise<TrainingCategory[]>;
  createTrainingCategory(category: InsertTrainingCategory): Promise<TrainingCategory>;
  updateTrainingCategory(id: number, data: Partial<TrainingCategory>): Promise<TrainingCategory | undefined>;
  deleteTrainingCategory(id: number): Promise<void>;
  
  // Document categories
  addDocumentToCategory(documentId: number, categoryId: number): Promise<DocumentCategory>;
  removeDocumentFromCategory(documentId: number, categoryId: number): Promise<void>;
  getDocumentCategories(documentId: number): Promise<TrainingCategory[]>;
  getCategoryDocuments(categoryId: number): Promise<TrainingDocument[]>;
  
  // Plan features management
  getPlanFeature(id: number): Promise<PlanFeature | undefined>;
  getPlanFeatures(subscriptionTier?: string): Promise<PlanFeature[]>;
  createPlanFeature(feature: InsertPlanFeature): Promise<PlanFeature>;
  updatePlanFeature(id: number, data: Partial<PlanFeature>): Promise<PlanFeature | undefined>;
  deletePlanFeature(id: number): Promise<void>;
  checkFeatureAccess(userId: number, featureKey: string): Promise<boolean>;
  
  // Analysis reports
  getAnalysisReport(id: number): Promise<AnalysisReport | undefined>;
  getUserAnalysisReports(userId: number): Promise<AnalysisReport[]>;
  createAnalysisReport(report: InsertAnalysisReport): Promise<AnalysisReport>;
  updateAnalysisReport(id: number, data: Partial<AnalysisReport>): Promise<AnalysisReport | undefined>;
  exportAnalysisReport(id: number, format: string): Promise<AnalysisReport | undefined>;
  
  // Support tickets
  getSupportTicket(id: number): Promise<SupportTicket | undefined>;
  getUserSupportTickets(userId: number): Promise<SupportTicket[]>;
  createSupportTicket(ticket: InsertSupportTicket): Promise<SupportTicket>;
  updateSupportTicket(id: number, data: Partial<SupportTicket>): Promise<SupportTicket | undefined>;
  assignSupportTicket(id: number, assignedTo: number): Promise<SupportTicket | undefined>;
  resolveSupportTicket(id: number): Promise<SupportTicket | undefined>;
  
  // Plan pricing
  getPlanPricing(id: number): Promise<PlanPricing | undefined>;
  getPlanPricingByTier(subscriptionTier: string): Promise<PlanPricing | undefined>;
  getAllPlanPricing(): Promise<PlanPricing[]>;
  createPlanPricing(pricing: InsertPlanPricing): Promise<PlanPricing>;
  updatePlanPricing(id: number, data: Partial<PlanPricing>): Promise<PlanPricing | undefined>;
  
  // Usage tracking
  incrementMessageCount(userId: number): Promise<User | undefined>;
  checkMessageLimit(userId: number): Promise<boolean>;
  resetMessageCounts(): Promise<void>;
  
  // Knowledge Base management
  createKnowledgeEntry(entry: InsertKnowledgeBase): Promise<KnowledgeBase>;
  getKnowledgeEntry(id: number): Promise<KnowledgeBase | undefined>;
  getKnowledgeEntries(language: string, limit?: number): Promise<KnowledgeBase[]>;
  getKnowledgeEntriesBySource(sourceType: string, sourceId: number): Promise<KnowledgeBase[]>;
  updateKnowledgeEntry(id: number, data: Partial<KnowledgeBase>): Promise<KnowledgeBase | undefined>;
  deleteKnowledgeEntry(id: number): Promise<void>;
  getKnowledgeEntriesBySourceType(sourceType: string, language: string): Promise<KnowledgeBase[]>;
  getVerifiedKnowledgeEntries(language: string): Promise<KnowledgeBase[]>;
  findSimilarKnowledge(embedding: number[], language: string, limit?: number): Promise<KnowledgeBase[]>;
  
  // Chat widgets management
  getChatWidget(id: string): Promise<ChatWidget | undefined>;
  getUserChatWidgets(userId: number): Promise<ChatWidget[]>;
  getAllChatWidgets(): Promise<ChatWidget[]>;
  createChatWidget(widget: InsertChatWidget): Promise<ChatWidget>;
  updateChatWidget(id: string, data: Partial<ChatWidget>): Promise<ChatWidget | undefined>;
  deleteChatWidget(id: string): Promise<void>;
  getChatWidgetByApiKey(apiKey: string): Promise<ChatWidget | undefined>;
  validateWidgetDomain(widgetId: string, domain: string): Promise<boolean>;
  
  // Widget chat sessions
  getWidgetChatSession(id: number): Promise<WidgetChatSession | undefined>;
  getWidgetChatSessions(widgetId: string): Promise<WidgetChatSession[]>;
  getAllWidgetChatSessions(): Promise<WidgetChatSession[]>;
  createWidgetChatSession(session: InsertWidgetChatSession): Promise<WidgetChatSession>;
  endWidgetChatSession(id: number): Promise<WidgetChatSession | undefined>;
  getActiveWidgetSession(widgetId: string, visitorId: string): Promise<WidgetChatSession | undefined>;
  
  // Widget chat messages
  getWidgetChatMessage(id: number): Promise<WidgetChatMessage | undefined>;
  getWidgetSessionMessages(sessionId: number): Promise<WidgetChatMessage[]>;
  getAllWidgetChatMessages(): Promise<WidgetChatMessage[]>;
  createWidgetChatMessage(message: InsertWidgetChatMessage): Promise<WidgetChatMessage>;
}

export class MemStorage implements IStorage {
  // LLM usage tracking
  async logLlmUsage(log: InsertLlmUsageLog): Promise<void> {
    const id = this.currentIds.llmUsageLogId++;
    const now = new Date();
    
    // Garanta que valores obrigatórios estejam presentes
    const usageLog: LlmUsageLog = {
      id,
      created_at: now,
      model_name: log.model_name,
      provider: log.provider,
      operation_type: log.operation_type,
      user_id: log.user_id || null,
      widget_id: log.widget_id || null,
      token_count: log.token_count || 0,
      success: log.success !== undefined ? log.success : true,
      error_message: log.error_message || null
    };
    
    this.llmUsageLogs.set(id, usageLog);
    console.log(`Registrado uso do LLM: ${log.model_name} - ${log.operation_type} - ${log.success ? 'Sucesso' : 'Falha'}`);
  }
  
  async getLlmUsageLogs(options?: {
    startDate?: Date;
    endDate?: Date;
    provider?: string;
    userId?: number;
    widgetId?: string; // Atualizado para usar UUID/string
    limit?: number;
    success?: boolean;
  }): Promise<LlmUsageLog[]> {
    let logs = Array.from(this.llmUsageLogs.values());
    
    // Aplicar filtros
    if (options) {
      if (options.startDate) {
        logs = logs.filter(log => log.created_at >= options.startDate!);
      }
      
      if (options.endDate) {
        logs = logs.filter(log => log.created_at <= options.endDate!);
      }
      
      if (options.provider) {
        logs = logs.filter(log => log.provider === options.provider);
      }
      
      if (options.userId !== undefined) {
        logs = logs.filter(log => log.user_id === options.userId);
      }
      
      if (options.widgetId !== undefined) {
        logs = logs.filter(log => String(log.widget_id) === options.widgetId);
      }
      
      if (options.success !== undefined) {
        logs = logs.filter(log => log.success === options.success);
      }
      
      // Ordenar por data (mais recente primeiro)
      logs.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
      
      // Aplicar limite se especificado
      if (options.limit) {
        logs = logs.slice(0, options.limit);
      }
    }
    
    return logs;
  }

  // Implementação do método deleteUser para MemStorage
  async deleteUser(id: number): Promise<void> {
    // Remover o usuário
    this.users.delete(id);
    
    // Limpar a sessão ativa do usuário
    this.removeUserActiveSession(id);
    
    // Em uma implementação real, você também removeria ou anonimizaria 
    // todos os dados associados ao usuário, como mensagens, logs, etc.
  }
  
  // Login security - controle de tentativas de login simultâneas
  private loginAttempts: Map<number, Date[]> = new Map();
  
  async getRecentLoginAttempts(userId: number, minutes: number): Promise<number> {
    const attempts = this.loginAttempts.get(userId) || [];
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
    
    // Limpar tentativas antigas e contar recentes
    const recentAttempts = attempts.filter(date => date > cutoffTime);
    this.loginAttempts.set(userId, recentAttempts);
    
    return recentAttempts.length;
  }
  
  async recordLoginAttempt(userId: number): Promise<void> {
    const attempts = this.loginAttempts.get(userId) || [];
    attempts.push(new Date());
    this.loginAttempts.set(userId, attempts);
  }
  
  async updateLastLogin(id: number): Promise<User | undefined> {
    return this.updateUser(id, { last_login: new Date() });
  }
  
  private users: Map<number, User>;
  private llmConfigs: Map<number, LlmConfig>;
  private avatars: Map<number, Avatar>;
  private chatSessions: Map<number, ChatSession>;
  private chatMessages: Map<number, ChatMessage>;
  private auditLogs: Map<number, AuditLog>;
  private otpTokens: Map<number, OtpToken>;
  private userActiveSessions: Map<number, string>;
  private trainingDocuments: Map<number, TrainingDocument>;
  private trainingCategories: Map<number, TrainingCategory>;
  private documentCategories: Map<number, DocumentCategory>;
  private planFeatures: Map<number, PlanFeature>;
  private planPricing: Map<number, PlanPricing>;
  private analysisReports: Map<number, AnalysisReport>;
  private supportTickets: Map<number, SupportTicket>;
  private chatWidgets: Map<string, ChatWidget>;
  private widgetChatSessions: Map<number, WidgetChatSession>;
  private widgetChatMessages: Map<number, WidgetChatMessage>;
  private knowledgeBase: Map<number, KnowledgeBase>;
  private llmUsageLogs: Map<number, LlmUsageLog>;
  
  sessionStore: session.Store;
  
  private currentIds: {
    userId: number;
    llmConfigId: number;
    avatarId: number;
    chatSessionId: number;
    chatMessageId: number;
    auditLogId: number;
    otpTokenId: number;
    trainingDocumentId: number;
    trainingCategoryId: number;
    documentCategoryId: number;
    planFeatureId: number;
    planPricingId: number;
    analysisReportId: number;
    supportTicketId: number;
    widgetChatSessionId: number;
    widgetChatMessageId: number;
    knowledgeBaseId: number;
    llmUsageLogId: number;
  };

  constructor() {
    this.users = new Map();
    this.llmConfigs = new Map();
    this.avatars = new Map();
    this.chatSessions = new Map();
    this.chatMessages = new Map();
    this.auditLogs = new Map();
    this.otpTokens = new Map();
    this.userActiveSessions = new Map();
    this.trainingDocuments = new Map();
    this.trainingCategories = new Map();
    this.documentCategories = new Map();
    this.planFeatures = new Map();
    this.planPricing = new Map();
    this.knowledgeBase = new Map();
    this.analysisReports = new Map();
    this.supportTickets = new Map();
    this.chatWidgets = new Map();
    this.widgetChatSessions = new Map();
    this.widgetChatMessages = new Map();
    this.llmUsageLogs = new Map();
    
    this.currentIds = {
      userId: 1,
      llmConfigId: 1,
      avatarId: 1,
      chatSessionId: 1,
      chatMessageId: 1,
      auditLogId: 1,
      otpTokenId: 1,
      trainingDocumentId: 1,
      trainingCategoryId: 1,
      documentCategoryId: 1,
      planFeatureId: 1,
      planPricingId: 1,
      analysisReportId: 1,
      supportTicketId: 1,
      widgetChatSessionId: 1,
      widgetChatMessageId: 1,
      knowledgeBaseId: 1,
      llmUsageLogId: 1
    };
    
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // 24 hours
    });
    
    // Create default avatar
    this.createDefaultAvatar();
  }
  
  private async createDefaultAvatar() {
    const defaultAvatar: InsertAvatar = {
      name: "Bot ToledoIA",
      image_url: "/default-avatar.svg",
      created_by: 0 // System ID
    };
    
    await this.createAvatar(defaultAvatar);
  }

  // User management
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email.toLowerCase() === email.toLowerCase(),
    );
  }

  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }
  
  async getUsersBySubscriptionTier(tier: "none" | "basic" | "intermediate"): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => user.subscription_tier === tier);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentIds.userId++;
    const now = new Date();
    const user: User = { 
      ...insertUser, 
      id,
      is_blocked: false,
      created_at: now,
      updated_at: now
    };
    this.users.set(id, user);
    return user;
  }
  
  async updateUser(id: number, data: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = {
      ...user,
      ...data,
      updated_at: new Date()
    };
    
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  async blockUser(id: number): Promise<User | undefined> {
    return this.updateUser(id, { is_blocked: true });
  }
  
  async unblockUser(id: number): Promise<User | undefined> {
    return this.updateUser(id, { is_blocked: false });
  }
  
  // LLM configuration
  async getLlmConfig(id: number): Promise<LlmConfig | undefined> {
    return this.llmConfigs.get(id);
  }
  
  async getActiveLlmConfig(): Promise<LlmConfig | undefined> {
    return Array.from(this.llmConfigs.values()).find(config => config.is_active);
  }
  
  async createLlmConfig(config: InsertLlmConfig): Promise<LlmConfig> {
    const id = this.currentIds.llmConfigId++;
    const now = new Date();
    
    // If this is the first config, make it active
    const isActive = this.llmConfigs.size === 0 ? true : false;
    
    // If setting a new active config, deactivate others
    if (isActive) {
      for (const [configId, llmConfig] of this.llmConfigs.entries()) {
        this.llmConfigs.set(configId, { ...llmConfig, is_active: false });
      }
    }
    
    const llmConfig: LlmConfig = {
      ...config,
      id,
      is_active: isActive,
      created_at: now,
      updated_at: now
    };
    
    this.llmConfigs.set(id, llmConfig);
    return llmConfig;
  }
  
  async updateLlmConfig(id: number, data: Partial<LlmConfig>): Promise<LlmConfig | undefined> {
    const config = this.llmConfigs.get(id);
    if (!config) return undefined;
    
    const updatedConfig = {
      ...config,
      ...data,
      updated_at: new Date()
    };
    
    this.llmConfigs.set(id, updatedConfig);
    return updatedConfig;
  }
  
  async setActiveLlmConfig(id: number): Promise<LlmConfig | undefined> {
    const config = this.llmConfigs.get(id);
    if (!config) return undefined;
    
    // Deactivate all configs
    for (const [configId, llmConfig] of this.llmConfigs.entries()) {
      this.llmConfigs.set(configId, { ...llmConfig, is_active: configId === id });
    }
    
    // Registrar a alteração do modelo ativo
    await this.logLlmUsage({
      model_name: config.model_name,
      provider: config.model_name.split('/')[0].toLowerCase(),
      operation_type: "test",
      success: true
    });
    
    return this.llmConfigs.get(id);
  }
  
  // LLM usage logging functions
  async logLlmUsage(log: InsertLlmUsageLog): Promise<void> {
    const id = this.currentIds.llmUsageLogId++;
    const now = new Date();
    
    const usageLog: LlmUsageLog = {
      ...log,
      id,
      created_at: now
    };
    
    this.llmUsageLogs.set(id, usageLog);
  }
  
  async getLlmUsageLogs(): Promise<LlmUsageLog[]> {
    return Array.from(this.llmUsageLogs.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  
  async getLlmUsageLogsByModel(modelName: string): Promise<LlmUsageLog[]> {
    return Array.from(this.llmUsageLogs.values())
      .filter(log => log.model_name === modelName)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  
  async getLlmUsageLogsByProvider(provider: string): Promise<LlmUsageLog[]> {
    return Array.from(this.llmUsageLogs.values())
      .filter(log => log.provider === provider)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  
  async getLlmUsageLogsByUser(userId: number): Promise<LlmUsageLog[]> {
    return Array.from(this.llmUsageLogs.values())
      .filter(log => log.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  
  // Avatar management
  async getAvatar(id: number): Promise<Avatar | undefined> {
    return this.avatars.get(id);
  }
  
  async getActiveAvatar(): Promise<Avatar | undefined> {
    return Array.from(this.avatars.values()).find(avatar => avatar.is_active);
  }
  
  async createAvatar(avatar: InsertAvatar): Promise<Avatar> {
    const id = this.currentIds.avatarId++;
    const now = new Date();
    
    // If this is the first avatar, make it active
    const isActive = this.avatars.size === 0 ? true : false;
    
    // If setting a new active avatar, deactivate others
    if (isActive) {
      for (const [avatarId, existingAvatar] of this.avatars.entries()) {
        this.avatars.set(avatarId, { ...existingAvatar, is_active: false });
      }
    }
    
    const newAvatar: Avatar = {
      ...avatar,
      id,
      is_active: isActive,
      created_at: now,
      updated_at: now
    };
    
    this.avatars.set(id, newAvatar);
    return newAvatar;
  }
  
  async updateAvatar(id: number, data: Partial<Avatar>): Promise<Avatar | undefined> {
    const avatar = this.avatars.get(id);
    if (!avatar) return undefined;
    
    const updatedAvatar = {
      ...avatar,
      ...data,
      updated_at: new Date()
    };
    
    this.avatars.set(id, updatedAvatar);
    return updatedAvatar;
  }
  
  async setActiveAvatar(id: number): Promise<Avatar | undefined> {
    const avatar = this.avatars.get(id);
    if (!avatar) return undefined;
    
    // Deactivate all avatars
    for (const [avatarId, existingAvatar] of this.avatars.entries()) {
      this.avatars.set(avatarId, { ...existingAvatar, is_active: avatarId === id });
    }
    
    return this.avatars.get(id);
  }
  
  // Chat sessions
  async getChatSession(id: number): Promise<ChatSession | undefined> {
    return this.chatSessions.get(id);
  }
  
  async getUserChatSessions(userId: number): Promise<ChatSession[]> {
    return Array.from(this.chatSessions.values())
      .filter(session => session.user_id === userId)
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
  }
  
  async createChatSession(session: InsertChatSession): Promise<ChatSession> {
    const id = this.currentIds.chatSessionId++;
    const now = new Date();
    
    const chatSession: ChatSession = {
      ...session,
      id,
      started_at: now,
      ended_at: null
    };
    
    this.chatSessions.set(id, chatSession);
    return chatSession;
  }
  
  async endChatSession(id: number): Promise<ChatSession | undefined> {
    const session = this.chatSessions.get(id);
    if (!session) return undefined;
    
    const updatedSession = {
      ...session,
      ended_at: new Date()
    };
    
    this.chatSessions.set(id, updatedSession);
    return updatedSession;
  }
  
  // Chat messages
  async getChatMessage(id: number): Promise<ChatMessage | undefined> {
    return this.chatMessages.get(id);
  }
  
  async getSessionMessages(sessionId: number): Promise<ChatMessage[]> {
    return Array.from(this.chatMessages.values())
      .filter(message => message.session_id === sessionId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }
  
  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const id = this.currentIds.chatMessageId++;
    const now = new Date();
    
    const chatMessage: ChatMessage = {
      ...message,
      id,
      created_at: now
    };
    
    this.chatMessages.set(id, chatMessage);
    return chatMessage;
  }
  
  // Audit logs
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const id = this.currentIds.auditLogId++;
    const now = new Date();
    
    const auditLog: AuditLog = {
      ...log,
      id,
      created_at: now
    };
    
    this.auditLogs.set(id, auditLog);
    return auditLog;
  }
  
  async getAuditLogs(userId?: number): Promise<AuditLog[]> {
    const logs = Array.from(this.auditLogs.values());
    
    if (userId) {
      return logs
        .filter(log => log.user_id === userId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    
    return logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  
  // OTP management
  async createOtpToken(tokenData: InsertOtpToken): Promise<OtpToken> {
    const id = this.currentIds.otpTokenId++;
    
    const otpToken: OtpToken = {
      ...tokenData,
      id,
      used: false
    };
    
    this.otpTokens.set(id, otpToken);
    return otpToken;
  }
  
  async getOtpToken(token: string, userId: number): Promise<OtpToken | undefined> {
    return Array.from(this.otpTokens.values()).find(
      t => t.token === token && t.user_id === userId && !t.used && new Date(t.expires_at) > new Date()
    );
  }
  
  async markOtpTokenUsed(id: number): Promise<OtpToken | undefined> {
    const token = this.otpTokens.get(id);
    if (!token) return undefined;
    
    const updatedToken = {
      ...token,
      used: true
    };
    
    this.otpTokens.set(id, updatedToken);
    return updatedToken;
  }
  
  async deleteExpiredOtpTokens(): Promise<void> {
    const now = new Date();
    
    for (const [id, token] of this.otpTokens.entries()) {
      if (new Date(token.expires_at) < now) {
        this.otpTokens.delete(id);
      }
    }
  }
  
  // Session management
  async getUserActiveSession(userId: number): Promise<{ sessionId: string } | undefined> {
    const sessionId = this.userActiveSessions.get(userId);
    if (!sessionId) return undefined;
    return { sessionId };
  }
  
  async setUserActiveSession(userId: number, sessionId: string): Promise<void> {
    this.userActiveSessions.set(userId, sessionId);
  }
  
  async removeUserActiveSession(userId: number): Promise<void> {
    this.userActiveSessions.delete(userId);
  }
  
  // Training documents
  async getTrainingDocument(id: number): Promise<TrainingDocument | undefined> {
    return this.trainingDocuments.get(id);
  }
  
  async getTrainingDocuments(): Promise<TrainingDocument[]> {
    return Array.from(this.trainingDocuments.values())
      .filter(doc => doc.is_active)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  
  async searchTrainingDocuments(terms: string[]): Promise<TrainingDocument[]> {
    console.log(`Pesquisando documentos com termos: ${terms.join(', ')}`);
    
    // Obter todos os documentos ativos
    const allDocuments = Array.from(this.trainingDocuments.values())
      .filter(doc => doc.is_active);
    
    // Se não tiver termos para filtrar, retorna todos os documentos
    if (!terms || terms.length === 0) {
      return allDocuments;
    }
    
    // Filtrar documentos que contêm pelo menos um dos termos fornecidos no conteúdo
    const matchingDocuments = allDocuments.filter(doc => {
      // Se não tiver conteúdo, não pode corresponder
      if (!doc.content) return false;
      
      // Verificar se algum dos termos está presente no conteúdo do documento
      return terms.some(term => 
        doc.content?.includes(term)
      );
    });
    
    console.log(`Encontrados ${matchingDocuments.length} documentos correspondentes aos termos de pesquisa`);
    
    return matchingDocuments;
  }
  
  async createTrainingDocument(document: InsertTrainingDocument): Promise<TrainingDocument> {
    const id = this.currentIds.trainingDocumentId++;
    const now = new Date();
    
    const newDocument: TrainingDocument = {
      ...document,
      id,
      is_active: true,
      created_at: now,
      updated_at: now
    };
    
    this.trainingDocuments.set(id, newDocument);
    return newDocument;
  }
  
  async updateTrainingDocument(id: number, data: Partial<TrainingDocument>): Promise<TrainingDocument | undefined> {
    const document = this.trainingDocuments.get(id);
    if (!document) return undefined;
    
    const updatedDocument = {
      ...document,
      ...data,
      updated_at: new Date()
    };
    
    this.trainingDocuments.set(id, updatedDocument);
    return updatedDocument;
  }
  
  async deleteTrainingDocument(id: number): Promise<void> {
    const document = this.trainingDocuments.get(id);
    if (document) {
      this.trainingDocuments.set(id, { ...document, is_active: false, updated_at: new Date() });
    }
  }
  
  async updateTrainingDocumentStatus(id: number, status: string, errorMessage?: string): Promise<TrainingDocument | undefined> {
    const document = this.trainingDocuments.get(id);
    if (!document) return undefined;
    
    const updatedDocument = {
      ...document,
      status: status as any,
      error_message: errorMessage,
      updated_at: new Date()
    };
    
    this.trainingDocuments.set(id, updatedDocument);
    return updatedDocument;
  }
  
  // Training categories
  async getTrainingCategory(id: number): Promise<TrainingCategory | undefined> {
    return this.trainingCategories.get(id);
  }
  
  async getTrainingCategories(): Promise<TrainingCategory[]> {
    return Array.from(this.trainingCategories.values())
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  
  async createTrainingCategory(category: InsertTrainingCategory): Promise<TrainingCategory> {
    const id = this.currentIds.trainingCategoryId++;
    const now = new Date();
    
    const newCategory: TrainingCategory = {
      ...category,
      id,
      created_at: now,
      updated_at: now
    };
    
    this.trainingCategories.set(id, newCategory);
    return newCategory;
  }
  
  async updateTrainingCategory(id: number, data: Partial<TrainingCategory>): Promise<TrainingCategory | undefined> {
    const category = this.trainingCategories.get(id);
    if (!category) return undefined;
    
    const updatedCategory = {
      ...category,
      ...data,
      updated_at: new Date()
    };
    
    this.trainingCategories.set(id, updatedCategory);
    return updatedCategory;
  }
  
  async deleteTrainingCategory(id: number): Promise<void> {
    // Remove all associations first
    for (const [docCatId, docCat] of this.documentCategories.entries()) {
      if (docCat.category_id === id) {
        this.documentCategories.delete(docCatId);
      }
    }
    
    // Then delete the category
    this.trainingCategories.delete(id);
  }
  
  // Document categories
  async addDocumentToCategory(documentId: number, categoryId: number): Promise<DocumentCategory> {
    const id = this.currentIds.documentCategoryId++;
    
    const association: DocumentCategory = {
      id,
      document_id: documentId,
      category_id: categoryId
    };
    
    this.documentCategories.set(id, association);
    return association;
  }
  
  async removeDocumentFromCategory(documentId: number, categoryId: number): Promise<void> {
    for (const [id, docCat] of this.documentCategories.entries()) {
      if (docCat.document_id === documentId && docCat.category_id === categoryId) {
        this.documentCategories.delete(id);
        break;
      }
    }
  }
  
  async getDocumentCategories(documentId: number): Promise<TrainingCategory[]> {
    const categoryIds = Array.from(this.documentCategories.values())
      .filter(docCat => docCat.document_id === documentId)
      .map(docCat => docCat.category_id);
    
    return Array.from(this.trainingCategories.values())
      .filter(category => categoryIds.includes(category.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  
  async getCategoryDocuments(categoryId: number): Promise<TrainingDocument[]> {
    const documentIds = Array.from(this.documentCategories.values())
      .filter(docCat => docCat.category_id === categoryId)
      .map(docCat => docCat.document_id);
    
    return Array.from(this.trainingDocuments.values())
      .filter(doc => doc.is_active && documentIds.includes(doc.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // Plan features management
  async getPlanFeature(id: number): Promise<PlanFeature | undefined> {
    return this.planFeatures.get(id);
  }
  
  async getPlanFeatures(subscriptionTier?: string): Promise<PlanFeature[]> {
    const features = Array.from(this.planFeatures.values());
    
    if (subscriptionTier) {
      return features.filter(feature => feature.subscription_tier === subscriptionTier);
    }
    
    return features;
  }
  
  async createPlanFeature(feature: InsertPlanFeature): Promise<PlanFeature> {
    const id = this.currentIds.planFeatureId++;
    const now = new Date();
    
    const planFeature: PlanFeature = {
      ...feature,
      id,
      created_at: now,
      updated_at: now
    };
    
    this.planFeatures.set(id, planFeature);
    return planFeature;
  }
  
  async updatePlanFeature(id: number, data: Partial<PlanFeature>): Promise<PlanFeature | undefined> {
    const feature = this.planFeatures.get(id);
    if (!feature) return undefined;
    
    const updatedFeature = {
      ...feature,
      ...data,
      updated_at: new Date()
    };
    
    this.planFeatures.set(id, updatedFeature);
    return updatedFeature;
  }
  
  async deletePlanFeature(id: number): Promise<void> {
    this.planFeatures.delete(id);
  }
  
  async checkFeatureAccess(userId: number, featureKey: string): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user) return false;
    
    // Se o usuário for admin, sempre tem acesso a todas as funcionalidades
    if (user.role === "admin") return true;
    
    // Se o usuário estiver bloqueado, não tem acesso a nenhuma funcionalidade
    if (user.is_blocked) return false;
    
    // Usuários sem assinatura não têm acesso às funcionalidades premium
    if (user.subscription_tier === "none") return false;
    
    // Obter todas as funcionalidades do plano do usuário
    const features = await this.getPlanFeatures(user.subscription_tier);
    
    // Verificar se a funcionalidade específica está disponível para o plano
    const feature = features.find(f => f.feature_key === featureKey);
    
    if (!feature) return false;
    
    return feature.is_enabled;
  }
  
  // Analysis reports
  async getAnalysisReport(id: number): Promise<AnalysisReport | undefined> {
    return this.analysisReports.get(id);
  }
  
  async getUserAnalysisReports(userId: number): Promise<AnalysisReport[]> {
    return Array.from(this.analysisReports.values())
      .filter(report => report.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  
  async createAnalysisReport(report: InsertAnalysisReport): Promise<AnalysisReport> {
    const id = this.currentIds.analysisReportId++;
    const now = new Date();
    
    const analysisReport: AnalysisReport = {
      ...report,
      id,
      created_at: now,
      is_exported: false,
      export_format: null,
      exported_at: null,
      exported_url: null
    };
    
    this.analysisReports.set(id, analysisReport);
    return analysisReport;
  }
  
  async updateAnalysisReport(id: number, data: Partial<AnalysisReport>): Promise<AnalysisReport | undefined> {
    const report = this.analysisReports.get(id);
    if (!report) return undefined;
    
    const updatedReport = {
      ...report,
      ...data
    };
    
    this.analysisReports.set(id, updatedReport);
    return updatedReport;
  }
  
  async exportAnalysisReport(id: number, format: string): Promise<AnalysisReport | undefined> {
    const report = this.analysisReports.get(id);
    if (!report) return undefined;
    
    const now = new Date();
    const exportedUrl = `/exports/report-${id}.${format.toLowerCase()}`;
    
    const updatedReport = {
      ...report,
      is_exported: true,
      export_format: format,
      exported_at: now,
      exported_url: exportedUrl
    };
    
    this.analysisReports.set(id, updatedReport);
    return updatedReport;
  }
  
  // Support tickets
  async getSupportTicket(id: number): Promise<SupportTicket | undefined> {
    return this.supportTickets.get(id);
  }
  
  async getUserSupportTickets(userId: number): Promise<SupportTicket[]> {
    return Array.from(this.supportTickets.values())
      .filter(ticket => ticket.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  
  async createSupportTicket(ticket: InsertSupportTicket): Promise<SupportTicket> {
    const id = this.currentIds.supportTicketId++;
    const now = new Date();
    
    const supportTicket: SupportTicket = {
      ...ticket,
      id,
      status: "pending",
      created_at: now,
      updated_at: now,
      resolved_at: null,
      assigned_to: null
    };
    
    this.supportTickets.set(id, supportTicket);
    return supportTicket;
  }
  
  async updateSupportTicket(id: number, data: Partial<SupportTicket>): Promise<SupportTicket | undefined> {
    const ticket = this.supportTickets.get(id);
    if (!ticket) return undefined;
    
    const updatedTicket = {
      ...ticket,
      ...data,
      updated_at: new Date()
    };
    
    this.supportTickets.set(id, updatedTicket);
    return updatedTicket;
  }
  
  async assignSupportTicket(id: number, assignedTo: number): Promise<SupportTicket | undefined> {
    return this.updateSupportTicket(id, { assigned_to: assignedTo, status: "in_progress" });
  }
  
  async resolveSupportTicket(id: number): Promise<SupportTicket | undefined> {
    const now = new Date();
    return this.updateSupportTicket(id, { status: "resolved", resolved_at: now });
  }
  
  // Plan pricing functionality
  async getPlanPricing(id: number): Promise<PlanPricing | undefined> {
    return this.planPricing.get(id);
  }
  
  async getPlanPricingByTier(subscriptionTier: string): Promise<PlanPricing | undefined> {
    return Array.from(this.planPricing.values()).find(
      pricing => pricing.subscription_tier === subscriptionTier
    );
  }
  
  async getAllPlanPricing(): Promise<PlanPricing[]> {
    return Array.from(this.planPricing.values())
      .sort((a, b) => a.id - b.id);
  }
  
  async createPlanPricing(pricing: InsertPlanPricing): Promise<PlanPricing> {
    const id = this.currentIds.planPricingId++;
    const now = new Date();
    
    const planPricing: PlanPricing = {
      ...pricing,
      id,
      created_at: now,
      updated_at: now
    };
    
    this.planPricing.set(id, planPricing);
    return planPricing;
  }
  
  async updatePlanPricing(id: number, data: Partial<PlanPricing>): Promise<PlanPricing | undefined> {
    const pricing = this.planPricing.get(id);
    if (!pricing) return undefined;
    
    const updatedPricing = {
      ...pricing,
      ...data,
      updated_at: new Date()
    };
    
    this.planPricing.set(id, updatedPricing);
    return updatedPricing;
  }
  
  // Chat widgets management
  async getChatWidget(id: string): Promise<ChatWidget | undefined> {
    return this.chatWidgets.get(id);
  }
  
  async getUserChatWidgets(userId: number): Promise<ChatWidget[]> {
    return Array.from(this.chatWidgets.values())
      .filter(widget => widget.user_id === userId)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }
  
  async getAllChatWidgets(): Promise<ChatWidget[]> {
    return Array.from(this.chatWidgets.values());
  }
  
  async createChatWidget(widget: InsertChatWidget): Promise<ChatWidget> {
    const id = crypto.randomUUID();
    const apiKey = crypto.randomUUID();
    const now = new Date();
    
    const newWidget: ChatWidget = {
      ...widget,
      id,
      api_key: apiKey,
      is_active: true,
      theme_color: widget.theme_color || '#6366f1',
      allowed_domains: widget.allowed_domains || [],
      created_at: now,
      updated_at: now
    };
    
    this.chatWidgets.set(id, newWidget);
    return newWidget;
  }
  
  async updateChatWidget(id: string, data: Partial<ChatWidget>): Promise<ChatWidget | undefined> {
    const widget = this.chatWidgets.get(id);
    if (!widget) return undefined;
    
    const updatedWidget = {
      ...widget,
      ...data,
      updated_at: new Date()
    };
    
    this.chatWidgets.set(id, updatedWidget);
    return updatedWidget;
  }
  
  async deleteChatWidget(id: string): Promise<void> {
    this.chatWidgets.delete(id);
    
    // Também remover todas as sessões associadas
    const associatedSessions = Array.from(this.widgetChatSessions.values())
      .filter(session => session.widget_id === id)
      .map(session => session.id);
      
    for (const sessionId of associatedSessions) {
      this.widgetChatSessions.delete(sessionId);
      
      // E remover mensagens das sessões
      const sessionMessages = Array.from(this.widgetChatMessages.values())
        .filter(message => message.session_id === sessionId)
        .map(message => message.id);
        
      for (const messageId of sessionMessages) {
        this.widgetChatMessages.delete(messageId);
      }
    }
  }
  
  async getChatWidgetByApiKey(apiKey: string): Promise<ChatWidget | undefined> {
    return Array.from(this.chatWidgets.values())
      .find(widget => widget.api_key === apiKey && widget.is_active);
  }
  
  async validateWidgetDomain(widgetId: string, domain: string): Promise<boolean> {
    const widget = await this.getChatWidget(widgetId);
    if (!widget || !widget.is_active) return false;
    
    // Se não houver domínios permitidos especificados, permitir todos (não recomendado para produção)
    if (!widget.allowed_domains || widget.allowed_domains.length === 0) return true;
    
    // Verificar se o domínio está na lista de permitidos
    return widget.allowed_domains.some(allowedDomain => {
      // Permitir correspondência exata
      if (allowedDomain === domain) return true;
      
      // Permitir curingas
      if (allowedDomain.startsWith('*.')) {
        const wildcard = allowedDomain.substring(2);
        return domain.endsWith(wildcard);
      }
      
      return false;
    });
  }
  
  // Widget chat sessions
  async getWidgetChatSession(id: number): Promise<WidgetChatSession | undefined> {
    return this.widgetChatSessions.get(id);
  }
  
  async getWidgetChatSessions(widgetId: string): Promise<WidgetChatSession[]> {
    return Array.from(this.widgetChatSessions.values())
      .filter(session => session.widget_id === widgetId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  
  async getActiveWidgetSession(widgetId: string, visitorId: string): Promise<WidgetChatSession | undefined> {
    return Array.from(this.widgetChatSessions.values())
      .find(session => 
        session.widget_id === widgetId && 
        session.visitor_id === visitorId && 
        !session.ended_at
      );
  }
  
  async createWidgetChatSession(session: InsertWidgetChatSession): Promise<WidgetChatSession> {
    const id = this.currentIds.widgetChatSessionId++;
    const now = new Date();
    
    const chatSession: WidgetChatSession = {
      ...session,
      id,
      started_at: now,
      ended_at: null,
      created_at: now
    };
    
    this.widgetChatSessions.set(id, chatSession);
    return chatSession;
  }
  
  async endWidgetChatSession(id: number): Promise<WidgetChatSession | undefined> {
    const session = this.widgetChatSessions.get(id);
    if (!session) return undefined;
    
    const updatedSession = {
      ...session,
      ended_at: new Date()
    };
    
    this.widgetChatSessions.set(id, updatedSession);
    return updatedSession;
  }
  
  // Widget chat messages
  async getWidgetChatMessage(id: number): Promise<WidgetChatMessage | undefined> {
    return this.widgetChatMessages.get(id);
  }
  
  async getWidgetSessionMessages(sessionId: number): Promise<WidgetChatMessage[]> {
    return Array.from(this.widgetChatMessages.values())
      .filter(message => message.session_id === sessionId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }
  
  async getAllWidgetChatMessages(): Promise<WidgetChatMessage[]> {
    return Array.from(this.widgetChatMessages.values());
  }
  
  async getAllWidgetChatSessions(): Promise<WidgetChatSession[]> {
    return Array.from(this.widgetChatSessions.values());
  }
  
  async createWidgetChatMessage(message: InsertWidgetChatMessage): Promise<WidgetChatMessage> {
    const id = this.currentIds.widgetChatMessageId++;
    const now = new Date();
    
    const widgetMessage: WidgetChatMessage = {
      ...message,
      id,
      created_at: now
    };
    
    this.widgetChatMessages.set(id, widgetMessage);
    
    // Também incrementar contagem de mensagens para o usuário do widget
    const session = await this.getWidgetChatSession(message.session_id);
    if (session) {
      const widget = await this.getChatWidget(session.widget_id);
      if (widget) {
        await this.incrementMessageCount(widget.user_id);
      }
    }
    
    return widgetMessage;
  }
  
  // Usage tracking
  async incrementMessageCount(userId: number): Promise<User | undefined> {
    const user = await this.getUser(userId);
    if (!user) return undefined;
    
    const newCount = (user.message_count || 0) + 1;
    return this.updateUser(userId, { message_count: newCount });
  }
  
  async checkMessageLimit(userId: number): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user) return false;
    
    // Admins não têm limite de mensagens
    if (user.role === "admin") return true;
    
    // Usuários bloqueados não podem enviar mensagens
    if (user.is_blocked) return false;
    
    // Usuários sem assinatura não podem enviar mensagens
    if (user.subscription_tier === "none") return false;
    
    // Verificar se ainda há mensagens disponíveis
    const messageCount = user.message_count || 0;
    const maxMessages = user.max_messages || 0;
    
    return messageCount < maxMessages;
  }
  
  async resetMessageCounts(): Promise<void> {
    // Este método seria chamado por um job mensal para resetar contagens
    for (const [userId, user] of this.users.entries()) {
      if (user.subscription_tier !== "none") {
        this.updateUser(userId, { message_count: 0 });
      }
    }
  }
  
  // Knowledge Base management
  async createKnowledgeEntry(entry: InsertKnowledgeBase): Promise<KnowledgeBase> {
    const id = this.currentIds.knowledgeBaseId++;
    const now = new Date();
    
    const knowledgeEntry: KnowledgeBase = {
      ...entry,
      id,
      created_at: now
    };
    
    this.knowledgeBase.set(id, knowledgeEntry);
    return knowledgeEntry;
  }
  
  async getKnowledgeEntry(id: number): Promise<KnowledgeBase | undefined> {
    return this.knowledgeBase.get(id);
  }
  
  async updateKnowledgeEntry(id: number, data: Partial<KnowledgeBase>): Promise<KnowledgeBase | undefined> {
    const entry = this.knowledgeBase.get(id);
    if (!entry) return undefined;
    
    const updatedEntry = {
      ...entry,
      ...data
    };
    
    this.knowledgeBase.set(id, updatedEntry);
    return updatedEntry;
  }
  
  async getKnowledgeEntriesBySourceType(sourceType: string, language: string): Promise<KnowledgeBase[]> {
    return Array.from(this.knowledgeBase.values())
      .filter(entry => entry.source_type === sourceType && entry.language === language);
  }
  
  async getVerifiedKnowledgeEntries(language: string): Promise<KnowledgeBase[]> {
    return Array.from(this.knowledgeBase.values())
      .filter(entry => entry.is_verified && entry.language === language);
  }
  
  async findSimilarKnowledge(embedding: number[], language: string, limit: number = 5): Promise<KnowledgeBase[]> {
    // Em uma implementação em memória, não temos busca por similaridade de vetores eficiente
    // Retornamos apenas entradas verificadas filtradas por idioma
    // Em uma implementação real, você usaria Cosine Similarity com os vetores de embedding
    return this.getVerifiedKnowledgeEntries(language).slice(0, limit);
  }
}

import { db, pool } from './db';
import connectPg from "connect-pg-simple";
import { eq, and, isNull, lt, gt, gte, lte, or, desc, asc, ilike } from 'drizzle-orm';
import { 
  usersSessions, 
  trainingDocuments, 
  trainingCategories, 
  documentCategories,
  TrainingDocument,
  InsertTrainingDocument,
  TrainingCategory,
  InsertTrainingCategory,
  DocumentCategory
} from '@shared/schema';

const PostgresSessionStore = connectPg(session);

// Função de inicialização dos planos e recursos
export const initializePlansAndFeatures = async (storage: IStorage) => {
  try {
    // Verificar se já existem recursos cadastrados para evitar duplicação
    const existingFeatures = await storage.getPlanFeatures();
    if (existingFeatures.length > 0) {
      console.log('Planos e recursos já estão inicializados');
      return;
    }
    
    console.log('Inicializando planos e recursos...');
    
    // Plano Básico - 2.500 interações
    const basicPlanFeatures = [
      {
        subscription_tier: "basic",
        feature_key: "interaction_limit",
        feature_name: "Limite de interações",
        feature_description: "2.500 interações por mês",
        is_enabled: true
      },
      {
        subscription_tier: "basic",
        feature_key: "upload_files",
        feature_name: "Upload de imagens e documentos",
        feature_description: "Envio de imagens de placas de circuito e documentos técnicos",
        is_enabled: true
      },
      {
        subscription_tier: "basic",
        feature_key: "email_support",
        feature_name: "Suporte por email",
        feature_description: "Acesso ao suporte técnico por email",
        is_enabled: true
      },
      {
        subscription_tier: "basic",
        feature_key: "basic_analysis",
        feature_name: "Análise técnica de circuitos",
        feature_description: "Análise básica de placas de circuito",
        is_enabled: true
      }
    ];
    
    // Plano Intermediário - 5.000 interações
    const intermediatePlanFeatures = [
      {
        subscription_tier: "intermediate",
        feature_key: "interaction_limit",
        feature_name: "Limite de interações",
        feature_description: "5.000 interações por mês",
        is_enabled: true
      },
      {
        subscription_tier: "intermediate",
        feature_key: "upload_files",
        feature_name: "Upload de imagens e documentos",
        feature_description: "Envio de imagens de placas de circuito e documentos técnicos",
        is_enabled: true
      },
      {
        subscription_tier: "intermediate",
        feature_key: "priority_support",
        feature_name: "Suporte prioritário",
        feature_description: "Acesso prioritário à equipe de suporte",
        is_enabled: true
      },
      {
        subscription_tier: "intermediate",
        feature_key: "advanced_analysis",
        feature_name: "Análise técnica avançada",
        feature_description: "Análise detalhada de placas de circuito com recomendações específicas",
        is_enabled: true
      },
      {
        subscription_tier: "intermediate",
        feature_key: "export_reports",
        feature_name: "Exportação de relatórios",
        feature_description: "Exportação de relatórios de análise em vários formatos",
        is_enabled: true
      }
    ];
    
    // Criar os recursos para o plano básico
    for (const feature of basicPlanFeatures) {
      await storage.createPlanFeature(feature);
    }
    
    // Criar os recursos para o plano intermediário
    for (const feature of intermediatePlanFeatures) {
      await storage.createPlanFeature(feature);
    }
    
    console.log('Planos e recursos inicializados com sucesso');
  } catch (error) {
    console.error('Erro ao inicializar planos e recursos:', error);
  }
};

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;
  
  async deleteUser(id: number): Promise<void> {
    // Primeiro, exclui o usuário do banco de dados
    await db.delete(users).where(eq(users.id, id));
    
    // Remove a sessão ativa do usuário
    await this.removeUserActiveSession(id);
    
    // Na implementação real, seria necessário lidar com as relações 
    // e potencialmente anonimizar dados ao invés de excluí-los completamente
  }
  
  // Chat widgets management
  async getChatWidget(id: string): Promise<ChatWidget | undefined> {
    const [widget] = await db.select().from(chatWidgets).where(eq(chatWidgets.id, id));
    return widget;
  }
  
  async getUserChatWidgets(userId: number): Promise<ChatWidget[]> {
    return db.select().from(chatWidgets)
      .where(eq(chatWidgets.user_id, userId))
      .orderBy(desc(chatWidgets.updated_at));
  }
  
  async createChatWidget(widget: InsertChatWidget): Promise<ChatWidget> {
    const [newWidget] = await db.insert(chatWidgets).values({
      ...widget,
      id: crypto.randomUUID(),
      api_key: crypto.randomUUID(),
      is_active: true,
      theme_color: widget.theme_color || '#6366f1',
      allowed_domains: widget.allowed_domains || [],
      created_at: new Date(),
      updated_at: new Date()
    }).returning();
    
    return newWidget;
  }
  
  async updateChatWidget(id: string, data: Partial<ChatWidget>): Promise<ChatWidget | undefined> {
    const [updatedWidget] = await db.update(chatWidgets)
      .set({
        ...data,
        updated_at: new Date()
      })
      .where(eq(chatWidgets.id, id))
      .returning();
    
    return updatedWidget;
  }
  
  async deleteChatWidget(id: string): Promise<void> {
    // Primeiro obter todas as sessões do widget
    const widgetSessions = await db.select()
      .from(widgetChatSessions)
      .where(eq(widgetChatSessions.widget_id, id));
    
    // Para cada sessão, excluir suas mensagens
    for (const session of widgetSessions) {
      await db.delete(widgetChatMessages)
        .where(eq(widgetChatMessages.session_id, session.id));
    }
    
    // Excluir todas as sessões do widget
    await db.delete(widgetChatSessions)
      .where(eq(widgetChatSessions.widget_id, id));
    
    // Finalmente, excluir o widget
    await db.delete(chatWidgets)
      .where(eq(chatWidgets.id, id));
  }
  
  async getChatWidgetByApiKey(apiKey: string): Promise<ChatWidget | undefined> {
    const [widget] = await db.select()
      .from(chatWidgets)
      .where(
        and(
          eq(chatWidgets.api_key, apiKey),
          eq(chatWidgets.is_active, true)
        )
      );
    
    return widget;
  }
  
  async validateWidgetDomain(widgetId: string, domain: string): Promise<boolean> {
    const widget = await this.getChatWidget(widgetId);
    if (!widget || !widget.is_active) return false;
    
    // Se não houver domínios permitidos especificados, permitir todos (não recomendado para produção)
    if (!widget.allowed_domains || widget.allowed_domains.length === 0) return true;
    
    // Verificar se o domínio está na lista de permitidos
    return widget.allowed_domains.some(allowedDomain => {
      // Permitir correspondência exata
      if (allowedDomain === domain) return true;
      
      // Permitir curingas
      if (allowedDomain.startsWith('*.')) {
        const wildcard = allowedDomain.substring(2);
        return domain.endsWith(wildcard);
      }
      
      return false;
    });
  }
  
  // Widget chat sessions
  async getWidgetChatSession(id: number): Promise<WidgetChatSession | undefined> {
    const [session] = await db.select()
      .from(widgetChatSessions)
      .where(eq(widgetChatSessions.id, id));
    
    return session;
  }
  
  async getWidgetChatSessions(widgetId: string): Promise<WidgetChatSession[]> {
    return db.select()
      .from(widgetChatSessions)
      .where(eq(widgetChatSessions.widget_id, widgetId))
      .orderBy(desc(widgetChatSessions.created_at));
  }
  
  async getActiveWidgetSession(widgetId: string, visitorId: string): Promise<WidgetChatSession | undefined> {
    const [session] = await db.select()
      .from(widgetChatSessions)
      .where(
        and(
          eq(widgetChatSessions.widget_id, widgetId),
          eq(widgetChatSessions.visitor_id, visitorId),
          isNull(widgetChatSessions.ended_at)
        )
      )
      .orderBy(desc(widgetChatSessions.created_at))
      .limit(1);
    
    return session;
  }
  
  async createWidgetChatSession(session: InsertWidgetChatSession): Promise<WidgetChatSession> {
    const [newSession] = await db.insert(widgetChatSessions)
      .values({
        ...session,
        started_at: new Date(),
        created_at: new Date()
      })
      .returning();
    
    return newSession;
  }
  
  async endWidgetChatSession(id: number): Promise<WidgetChatSession | undefined> {
    const [updatedSession] = await db.update(widgetChatSessions)
      .set({ ended_at: new Date() })
      .where(eq(widgetChatSessions.id, id))
      .returning();
    
    return updatedSession;
  }
  
  // Widget chat messages
  async getWidgetChatMessage(id: number): Promise<WidgetChatMessage | undefined> {
    const [message] = await db.select()
      .from(widgetChatMessages)
      .where(eq(widgetChatMessages.id, id));
    
    return message;
  }
  
  async getWidgetSessionMessages(sessionId: number): Promise<WidgetChatMessage[]> {
    return db.select()
      .from(widgetChatMessages)
      .where(eq(widgetChatMessages.session_id, sessionId))
      .orderBy(asc(widgetChatMessages.created_at));
  }
  
  async getAllWidgetChatMessages(): Promise<WidgetChatMessage[]> {
    return db.select().from(widgetChatMessages);
  }
  
  async getAllWidgetChatSessions(): Promise<WidgetChatSession[]> {
    return db.select().from(widgetChatSessions);
  }
  
  async getAllChatWidgets(): Promise<ChatWidget[]> {
    return db.select().from(chatWidgets);
  }
  
  async createWidgetChatMessage(message: InsertWidgetChatMessage): Promise<WidgetChatMessage> {
    const [newMessage] = await db.insert(widgetChatMessages)
      .values({
        ...message,
        created_at: new Date()
      })
      .returning();
      
    // Também incrementar contagem de mensagens para o usuário do widget
    const session = await this.getWidgetChatSession(message.session_id);
    if (session) {
      const widget = await this.getChatWidget(session.widget_id);
      if (widget) {
        await this.incrementMessageCount(widget.user_id);
      }
    }
    
    return newMessage;
  }

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool,
      createTableIfMissing: true 
    });
  }
  
  // Knowledge Base management
  async createKnowledgeEntry(entry: InsertKnowledgeBase): Promise<KnowledgeBase> {
    const [newEntry] = await db.insert(knowledgeBase)
      .values({
        ...entry,
        language: entry.language || 'pt',
        created_at: new Date()
      })
      .returning();
    
    return newEntry;
  }
  
  async getKnowledgeEntry(id: number): Promise<KnowledgeBase | undefined> {
    const [entry] = await db.select()
      .from(knowledgeBase)
      .where(eq(knowledgeBase.id, id));
    
    return entry;
  }
  
  async getKnowledgeEntries(language: string, limit?: number): Promise<KnowledgeBase[]> {
    try {
      let query = db.select()
        .from(knowledgeBase)
        .where(eq(knowledgeBase.language, language))
        .orderBy(desc(knowledgeBase.created_at));
      
      if (limit && limit > 0) {
        query = query.limit(limit);
      }
      
      const entries = await query;
      
      // Converter embeddings de string para array quando necessário
      return entries.map(entry => {
        if (entry.embedding && typeof entry.embedding === 'string') {
          try {
            entry.embedding = JSON.parse(entry.embedding);
          } catch (e) {
            console.warn(`Erro ao converter embedding para array: ${e}`);
            // Manter como string se não for possível converter
          }
        }
        return entry;
      });
    } catch (error) {
      console.error('Erro ao buscar entradas de conhecimento:', error);
      return [];
    }
  }
  
  async updateKnowledgeEntry(id: number, data: Partial<KnowledgeBase>): Promise<KnowledgeBase | undefined> {
    const [updatedEntry] = await db.update(knowledgeBase)
      .set(data)
      .where(eq(knowledgeBase.id, id))
      .returning();
    
    return updatedEntry;
  }
  
  async getKnowledgeEntriesBySource(sourceType: string, sourceId: number): Promise<KnowledgeBase[]> {
    return db.select()
      .from(knowledgeBase)
      .where(
        and(
          eq(knowledgeBase.source_type, sourceType),
          eq(knowledgeBase.source_id, sourceId)
        )
      )
      .orderBy(asc(knowledgeBase.chunk_index));
  }
  
  async getKnowledgeEntriesBySourceType(sourceType: string, language: string): Promise<KnowledgeBase[]> {
    return db.select()
      .from(knowledgeBase)
      .where(
        and(
          eq(knowledgeBase.source_type, sourceType),
          eq(knowledgeBase.language, language)
        )
      );
  }
  
  async getVerifiedKnowledgeEntries(language: string): Promise<KnowledgeBase[]> {
    return db.select()
      .from(knowledgeBase)
      .where(
        and(
          eq(knowledgeBase.is_verified, true),
          eq(knowledgeBase.language, language)
        )
      );
  }
  
  async findSimilarKnowledge(embedding: number[], language: string, limit: number = 5): Promise<KnowledgeBase[]> {
    // Implementação básica usando produto escalar para similaridade de cosseno
    // Para uma implementação completa, seria necessário usar uma extensão de vetor como pgvector
    // ou implementar uma função personalizada para calcular a similaridade
    
    // Seleciona apenas entradas verificadas no idioma especificado
    const entries = await this.getVerifiedKnowledgeEntries(language);
    
    // Ordenar por similaridade (produto escalar simples)
    const entriesWithScore = entries.map(entry => {
      // Calcular similaridade usando produto escalar simples
      let similarity = 0;
      
      if (entry.embedding && entry.embedding.length === embedding.length) {
        similarity = entry.embedding.reduce((sum, value, index) => {
          return sum + value * embedding[index];
        }, 0);
      }
      
      return { entry, similarity };
    });
    
    // Ordenar por similaridade decrescente
    entriesWithScore.sort((a, b) => b.similarity - a.similarity);
    
    // Retornar as entradas mais similares
    return entriesWithScore.slice(0, limit).map(item => item.entry);
  }
  
  // Document Chunks methods - Para RAG (Retrieval Augmented Generation)
  async createDocumentChunk(chunk: InsertDocumentChunk): Promise<DocumentChunk> {
    // Converter embedding para string se for um array
    let embeddingValue = chunk.embedding;
    if (Array.isArray(embeddingValue)) {
      embeddingValue = JSON.stringify(embeddingValue);
    }

    const [result] = await db.insert(documentChunks).values({
      ...chunk,
      embedding: embeddingValue as any,
      created_at: new Date()
    }).returning();

    // Se o embedding foi armazenado como string, convertê-lo de volta para array
    if (result && typeof result.embedding === 'string') {
      try {
        const embeddingArray = JSON.parse(result.embedding);
        if (Array.isArray(embeddingArray)) {
          result.embedding = embeddingArray;
        }
      } catch (e) {
        // Ignorar erro se não for possível converter
      }
    }
    
    return result;
  }

  async getDocumentChunk(id: number): Promise<DocumentChunk | undefined> {
    const [chunk] = await db.select().from(documentChunks).where(eq(documentChunks.id, id));
    
    // Converter embedding de volta para array se for string
    if (chunk && typeof chunk.embedding === 'string') {
      try {
        const embeddingArray = JSON.parse(chunk.embedding);
        if (Array.isArray(embeddingArray)) {
          chunk.embedding = embeddingArray;
        }
      } catch (e) {
        // Manter como string se não for um JSON válido
      }
    }
    
    return chunk;
  }

  async getDocumentChunksByDocument(documentId: number): Promise<DocumentChunk[]> {
    const chunks = await db.select()
      .from(documentChunks)
      .where(eq(documentChunks.document_id, documentId))
      .orderBy(asc(documentChunks.chunk_index));
    
    // Converter embeddings para arrays
    return chunks.map(chunk => {
      if (chunk.embedding && typeof chunk.embedding === 'string') {
        try {
          const embeddingArray = JSON.parse(chunk.embedding);
          if (Array.isArray(embeddingArray)) {
            chunk.embedding = embeddingArray;
          }
        } catch (e) {
          // Ignorar erro e manter como string
        }
      }
      return chunk;
    });
  }

  async deleteDocumentChunk(id: number): Promise<void> {
    await db.delete(documentChunks).where(eq(documentChunks.id, id));
  }

  async deleteDocumentChunksByDocument(documentId: number): Promise<void> {
    await db.delete(documentChunks).where(eq(documentChunks.document_id, documentId));
  }

  async getDocumentChunksByLanguage(language: string): Promise<DocumentChunk[]> {
    const chunks = await db.select()
      .from(documentChunks)
      .where(eq(documentChunks.language, language as any));
    
    // Converter embeddings para arrays
    return chunks.map(chunk => {
      if (chunk.embedding && typeof chunk.embedding === 'string') {
        try {
          const embeddingArray = JSON.parse(chunk.embedding);
          if (Array.isArray(embeddingArray)) {
            chunk.embedding = embeddingArray;
          }
        } catch (e) {
          // Ignorar erro e manter como string
        }
      }
      return chunk;
    });
  }

  async searchDocumentChunksByKeywords(keywords: string[], language: string): Promise<DocumentChunk[]> {
    if (!keywords || keywords.length === 0) {
      return [];
    }

    // Cria uma condição OR para cada palavra-chave
    const conditions = keywords.map(keyword => 
      ilike(documentChunks.content, `%${keyword}%`)
    );

    const chunks = await db.select()
      .from(documentChunks)
      .where(and(
        eq(documentChunks.language, language as any),
        or(...conditions)
      ))
      .orderBy(desc(documentChunks.created_at))
      .limit(10);
    
    // Converter embeddings para arrays
    return chunks.map(chunk => {
      if (chunk.embedding && typeof chunk.embedding === 'string') {
        try {
          const embeddingArray = JSON.parse(chunk.embedding);
          if (Array.isArray(embeddingArray)) {
            chunk.embedding = embeddingArray;
          }
        } catch (e) {
          // Ignorar erro e manter como string
        }
      }
      return chunk;
    });
  }
  
  // Login security - controle de tentativas de login simultâneas
  async getRecentLoginAttempts(userId: number, minutes: number): Promise<number> {
    try {
      const cutoffTime = new Date(Date.now() - minutes * 60 * 1000);
      
      const attempts = await db.query.auditLogs.findMany({
        where: and(
          eq(auditLogs.user_id, userId),
          eq(auditLogs.action, "login_attempt"),
          gt(auditLogs.created_at, cutoffTime)
        )
      });
      
      return attempts.length;
    } catch (error) {
      console.error("Error getting recent login attempts:", error);
      return 0;
    }
  }
  
  async recordLoginAttempt(userId: number): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        user_id: userId,
        action: "login_attempt",
        details: JSON.stringify({ timestamp: new Date().toISOString() }),
        ip_address: null
      });
    } catch (error) {
      console.error("Error recording login attempt:", error);
    }
  }

  // User management
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, data: Partial<User>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set({ ...data, updated_at: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async blockUser(id: number): Promise<User | undefined> {
    return this.updateUser(id, { is_blocked: true });
  }

  async unblockUser(id: number): Promise<User | undefined> {
    return this.updateUser(id, { is_blocked: false });
  }
  
  // LLM configuration
  async getLlmConfig(id: number): Promise<LlmConfig | undefined> {
    const [config] = await db.select().from(llmConfigs).where(eq(llmConfigs.id, id));
    return config;
  }

  async getActiveLlmConfig(): Promise<LlmConfig | undefined> {
    const [config] = await db.select().from(llmConfigs).where(eq(llmConfigs.is_active, true));
    return config;
  }

  async createLlmConfig(config: InsertLlmConfig): Promise<LlmConfig> {
    // Primeiro, defina todos os configs como não-ativos
    await db.update(llmConfigs).set({ is_active: false });
    
    // Crie o novo config já como ativo
    const [newConfig] = await db
      .insert(llmConfigs)
      .values({ ...config, is_active: true })
      .returning();
    
    return newConfig;
  }

  async updateLlmConfig(id: number, data: Partial<LlmConfig>): Promise<LlmConfig | undefined> {
    const [updatedConfig] = await db
      .update(llmConfigs)
      .set({ ...data, updated_at: new Date() })
      .where(eq(llmConfigs.id, id))
      .returning();
    
    return updatedConfig;
  }

  async setActiveLlmConfig(id: number): Promise<LlmConfig | undefined> {
    // Primeiro, defina todos os configs como não-ativos
    await db.update(llmConfigs).set({ is_active: false });
    
    // Agora, defina o config especificado como ativo
    const [activatedConfig] = await db
      .update(llmConfigs)
      .set({ is_active: true, updated_at: new Date() })
      .where(eq(llmConfigs.id, id))
      .returning();
    
    // Registrar a ativação do modelo no log de uso
    if (activatedConfig) {
      await this.logLlmUsage({
        model_name: activatedConfig.model_name,
        provider: activatedConfig.model_name.split('/')[0].toLowerCase(),
        operation_type: "test",
        success: true
      });
    }
    
    return activatedConfig;
  }
  
  // Implementação das funções de logging de uso de LLM
  async logLlmUsage(log: InsertLlmUsageLog): Promise<void> {
    try {
      // Garantir que os valores obrigatórios estão presentes e lidar com valores nulos/indefinidos
      await db.insert(llmUsageLogs).values({
        model_name: log.model_name,
        provider: log.provider,
        operation_type: log.operation_type,
        user_id: log.user_id || null,
        widget_id: log.widget_id || null,
        token_count: log.token_count || 0,
        success: log.success !== undefined ? log.success : true,
        error_message: log.error_message || null
      });
      
      console.log(`Registrado uso do LLM: ${log.model_name} - ${log.operation_type} - ${log.success ? 'Sucesso' : 'Falha'}`);
    } catch (error) {
      console.error('Erro ao registrar uso do LLM:', error);
      // Não propagar o erro para não interromper o fluxo principal da aplicação
    }
  }
  
  async getLlmUsageLogs(options?: {
    startDate?: Date;
    endDate?: Date;
    provider?: string;
    userId?: number;
    widgetId?: string; // Alterado para UUID (string)
    limit?: number;
    success?: boolean;
  }): Promise<LlmUsageLog[]> {
    try {
      let query = db.select().from(llmUsageLogs);
      
      // Aplicar filtros se fornecidos
      if (options) {
        if (options.startDate) {
          query = query.where(gte(llmUsageLogs.created_at, options.startDate));
        }
        
        if (options.endDate) {
          query = query.where(lte(llmUsageLogs.created_at, options.endDate));
        }
        
        if (options.provider) {
          query = query.where(eq(llmUsageLogs.provider, options.provider));
        }
        
        if (options.userId !== undefined) {
          query = query.where(eq(llmUsageLogs.user_id, options.userId));
        }
        
        if (options.widgetId !== undefined) {
          query = query.where(eq(llmUsageLogs.widget_id, options.widgetId));
        }
        
        if (options.success !== undefined) {
          query = query.where(eq(llmUsageLogs.success, options.success));
        }
        
        // Ordenar por data (mais recente primeiro)
        query = query.orderBy(desc(llmUsageLogs.created_at));
        
        // Aplicar limite se especificado
        if (options.limit) {
          query = query.limit(options.limit);
        }
      } else {
        // Por padrão, ordenar por data mais recente e limitar a 100 resultados
        query = query.orderBy(desc(llmUsageLogs.created_at)).limit(100);
      }
      
      return await query;
    } catch (error) {
      console.error('Erro ao obter logs de uso do LLM:', error);
      return [];
    }
  }
  
  // Avatar management
  async getAvatar(id: number): Promise<Avatar | undefined> {
    const [avatar] = await db.select().from(avatars).where(eq(avatars.id, id));
    return avatar;
  }

  async getActiveAvatar(): Promise<Avatar | undefined> {
    const [avatar] = await db.select().from(avatars).where(eq(avatars.is_active, true));
    return avatar;
  }

  async createAvatar(avatar: InsertAvatar): Promise<Avatar> {
    const [newAvatar] = await db
      .insert(avatars)
      .values(avatar)
      .returning();
    
    return newAvatar;
  }

  async updateAvatar(id: number, data: Partial<Avatar>): Promise<Avatar | undefined> {
    const [updatedAvatar] = await db
      .update(avatars)
      .set({ ...data, updated_at: new Date() })
      .where(eq(avatars.id, id))
      .returning();
    
    return updatedAvatar;
  }

  async setActiveAvatar(id: number): Promise<Avatar | undefined> {
    // Primeiro, defina todos os avatares como não-ativos
    await db.update(avatars).set({ is_active: false });
    
    // Agora, defina o avatar especificado como ativo
    const [activatedAvatar] = await db
      .update(avatars)
      .set({ is_active: true, updated_at: new Date() })
      .where(eq(avatars.id, id))
      .returning();
    
    return activatedAvatar;
  }
  
  // Chat sessions
  async getChatSession(id: number): Promise<ChatSession | undefined> {
    const [session] = await db.select().from(chatSessions).where(eq(chatSessions.id, id));
    return session;
  }

  async getUserChatSessions(userId: number): Promise<ChatSession[]> {
    return db.select().from(chatSessions).where(eq(chatSessions.user_id, userId));
  }

  async createChatSession(session: InsertChatSession): Promise<ChatSession> {
    const [newSession] = await db
      .insert(chatSessions)
      .values(session)
      .returning();
    
    return newSession;
  }

  async endChatSession(id: number): Promise<ChatSession | undefined> {
    const [endedSession] = await db
      .update(chatSessions)
      .set({ ended_at: new Date() })
      .where(eq(chatSessions.id, id))
      .returning();
    
    return endedSession;
  }
  
  // Chat messages
  async getChatMessage(id: number): Promise<ChatMessage | undefined> {
    const [message] = await db.select().from(chatMessages).where(eq(chatMessages.id, id));
    return message;
  }

  async getSessionMessages(sessionId: number): Promise<ChatMessage[]> {
    return db.select().from(chatMessages).where(eq(chatMessages.session_id, sessionId));
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [newMessage] = await db
      .insert(chatMessages)
      .values(message)
      .returning();
    
    return newMessage;
  }
  
  // Audit logs
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [newLog] = await db
      .insert(auditLogs)
      .values(log)
      .returning();
    
    return newLog;
  }

  async getAuditLogs(userId?: number): Promise<AuditLog[]> {
    if (userId) {
      return db.select().from(auditLogs).where(eq(auditLogs.user_id, userId));
    }
    return db.select().from(auditLogs);
  }
  
  // OTP management
  async createOtpToken(token: InsertOtpToken): Promise<OtpToken> {
    const [newToken] = await db
      .insert(otpTokens)
      .values(token)
      .returning();
    
    return newToken;
  }

  async getOtpToken(token: string, userId: number): Promise<OtpToken | undefined> {
    const [otpToken] = await db
      .select()
      .from(otpTokens)
      .where(
        and(
          eq(otpTokens.token, token),
          eq(otpTokens.user_id, userId),
          eq(otpTokens.used, false)
        )
      );
    
    return otpToken;
  }

  async markOtpTokenUsed(id: number): Promise<OtpToken | undefined> {
    const [updatedToken] = await db
      .update(otpTokens)
      .set({ used: true })
      .where(eq(otpTokens.id, id))
      .returning();
    
    return updatedToken;
  }

  async deleteExpiredOtpTokens(): Promise<void> {
    const now = new Date();
    await db
      .delete(otpTokens)
      .where(
        and(
          eq(otpTokens.used, false),
          // Deleta tokens que expiraram
          lt(otpTokens.expires_at, now)
        )
      );
  }
  
  // User sessions
  async getUserActiveSession(userId: number): Promise<{ sessionId: string } | undefined> {
    const [userSession] = await db
      .select({ sessionId: usersSessions.session_id })
      .from(usersSessions)
      .where(eq(usersSessions.user_id, userId));
    
    return userSession ? { sessionId: userSession.sessionId } : undefined;
  }

  async setUserActiveSession(userId: number, sessionId: string): Promise<void> {
    // Remove qualquer sessão existente
    await db
      .delete(usersSessions)
      .where(eq(usersSessions.user_id, userId));
    
    // Adiciona nova sessão
    await db
      .insert(usersSessions)
      .values({
        user_id: userId,
        session_id: sessionId
      });
  }

  async removeUserActiveSession(userId: number): Promise<void> {
    await db
      .delete(usersSessions)
      .where(eq(usersSessions.user_id, userId));
  }

  // Training documents
  async getTrainingDocument(id: number): Promise<TrainingDocument | undefined> {
    const [document] = await db
      .select()
      .from(trainingDocuments)
      .where(eq(trainingDocuments.id, id));
    return document;
  }
  
  async getTrainingDocuments(): Promise<TrainingDocument[]> {
    return db
      .select()
      .from(trainingDocuments)
      .where(eq(trainingDocuments.is_active, true))
      .orderBy(desc(trainingDocuments.created_at));
  }
  
  async searchTrainingDocuments(terms: string[]): Promise<TrainingDocument[]> {
    console.log(`Pesquisando documentos no banco de dados com termos: ${terms.join(', ')}`);
    
    // Se não há termos, retorna todos os documentos ativos
    if (!terms || terms.length === 0) {
      return this.getTrainingDocuments();
    }
    
    // Construir condições OR para cada termo
    let conditions = [];
    
    for (const term of terms) {
      // Adicionar condição para cada termo (verificar se o conteúdo contém o termo)
      // Usando ilike para busca case-insensitive
      conditions.push(sql`${trainingDocuments.content} ILIKE ${`%${term}%`}`);
    }
    
    // Combinar todas as condições em um OR
    const whereCondition = or(...conditions);
    
    // Executar a consulta
    const results = await db
      .select()
      .from(trainingDocuments)
      .where(
        and(
          eq(trainingDocuments.is_active, true),
          whereCondition
        )
      )
      .orderBy(desc(trainingDocuments.created_at));
    
    console.log(`Encontrados ${results.length} documentos no banco de dados que correspondem aos termos de pesquisa`);
    
    return results;
  }
  
  async createTrainingDocument(document: InsertTrainingDocument): Promise<TrainingDocument> {
    const [newDocument] = await db
      .insert(trainingDocuments)
      .values(document)
      .returning();
    return newDocument;
  }
  
  async updateTrainingDocument(id: number, data: Partial<TrainingDocument>): Promise<TrainingDocument | undefined> {
    const [updatedDocument] = await db
      .update(trainingDocuments)
      .set({ ...data, updated_at: new Date() })
      .where(eq(trainingDocuments.id, id))
      .returning();
    return updatedDocument;
  }
  
  async deleteTrainingDocument(id: number): Promise<void> {
    await db
      .update(trainingDocuments)
      .set({ is_active: false, updated_at: new Date() })
      .where(eq(trainingDocuments.id, id));
  }
  
  async updateTrainingDocumentStatus(id: number, status: string, errorMessage?: string): Promise<TrainingDocument | undefined> {
    const [updatedDocument] = await db
      .update(trainingDocuments)
      .set({ 
        status: status as any, 
        error_message: errorMessage,
        updated_at: new Date() 
      })
      .where(eq(trainingDocuments.id, id))
      .returning();
    return updatedDocument;
  }
  
  // Training categories
  async getTrainingCategory(id: number): Promise<TrainingCategory | undefined> {
    const [category] = await db
      .select()
      .from(trainingCategories)
      .where(eq(trainingCategories.id, id));
    return category;
  }
  
  async getTrainingCategories(): Promise<TrainingCategory[]> {
    return db
      .select()
      .from(trainingCategories)
      .orderBy(asc(trainingCategories.name));
  }
  
  async createTrainingCategory(category: InsertTrainingCategory): Promise<TrainingCategory> {
    const [newCategory] = await db
      .insert(trainingCategories)
      .values(category)
      .returning();
    return newCategory;
  }
  
  async updateTrainingCategory(id: number, data: Partial<TrainingCategory>): Promise<TrainingCategory | undefined> {
    const [updatedCategory] = await db
      .update(trainingCategories)
      .set({ ...data, updated_at: new Date() })
      .where(eq(trainingCategories.id, id))
      .returning();
    return updatedCategory;
  }
  
  async deleteTrainingCategory(id: number): Promise<void> {
    // Remove all associations first
    await db
      .delete(documentCategories)
      .where(eq(documentCategories.category_id, id));
    
    // Then delete the category
    await db
      .delete(trainingCategories)
      .where(eq(trainingCategories.id, id));
  }
  
  // Document categories
  async addDocumentToCategory(documentId: number, categoryId: number): Promise<DocumentCategory> {
    const [association] = await db
      .insert(documentCategories)
      .values({ document_id: documentId, category_id: categoryId })
      .returning();
    return association;
  }
  
  async removeDocumentFromCategory(documentId: number, categoryId: number): Promise<void> {
    await db
      .delete(documentCategories)
      .where(
        and(
          eq(documentCategories.document_id, documentId),
          eq(documentCategories.category_id, categoryId)
        )
      );
  }
  
  async getDocumentCategories(documentId: number): Promise<TrainingCategory[]> {
    return db
      .select({
        id: trainingCategories.id,
        name: trainingCategories.name,
        description: trainingCategories.description,
        created_at: trainingCategories.created_at,
        updated_at: trainingCategories.updated_at,
        created_by: trainingCategories.created_by
      })
      .from(documentCategories)
      .innerJoin(
        trainingCategories,
        eq(documentCategories.category_id, trainingCategories.id)
      )
      .where(eq(documentCategories.document_id, documentId));
  }
  
  async getCategoryDocuments(categoryId: number): Promise<TrainingDocument[]> {
    return db
      .select({
        id: trainingDocuments.id,
        name: trainingDocuments.name,
        description: trainingDocuments.description,
        document_type: trainingDocuments.document_type,
        content: trainingDocuments.content,
        file_url: trainingDocuments.file_url,
        website_url: trainingDocuments.website_url,
        status: trainingDocuments.status,
        error_message: trainingDocuments.error_message,
        created_by: trainingDocuments.created_by,
        created_at: trainingDocuments.created_at,
        updated_at: trainingDocuments.updated_at,
        is_active: trainingDocuments.is_active
      })
      .from(documentCategories)
      .innerJoin(
        trainingDocuments,
        eq(documentCategories.document_id, trainingDocuments.id)
      )
      .where(
        and(
          eq(documentCategories.category_id, categoryId),
          eq(trainingDocuments.is_active, true)
        )
      );
  }

  async updateLastLogin(id: number): Promise<User | undefined> {
    return this.updateUser(id, { last_login: new Date() });
  }
  
  // Plan features management
  async getPlanFeature(id: number): Promise<PlanFeature | undefined> {
    try {
      const [feature] = await db.select().from(planFeatures).where(eq(planFeatures.id, id));
      return feature;
    } catch (error) {
      console.error("Error getting plan feature:", error);
      return undefined;
    }
  }
  
  async getPlanFeatures(subscriptionTier?: string): Promise<PlanFeature[]> {
    try {
      if (subscriptionTier) {
        return await db.select().from(planFeatures).where(eq(planFeatures.subscription_tier, subscriptionTier));
      }
      return await db.select().from(planFeatures);
    } catch (error) {
      console.error("Error getting plan features:", error);
      return [];
    }
  }
  
  async createPlanFeature(feature: InsertPlanFeature): Promise<PlanFeature> {
    try {
      const now = new Date();
      const [newFeature] = await db
        .insert(planFeatures)
        .values({
          ...feature,
          created_at: now,
          updated_at: now
        })
        .returning();
      
      return newFeature;
    } catch (error) {
      console.error("Error creating plan feature:", error);
      throw error;
    }
  }
  
  async updatePlanFeature(id: number, data: Partial<PlanFeature>): Promise<PlanFeature | undefined> {
    try {
      const [updatedFeature] = await db
        .update(planFeatures)
        .set({ ...data, updated_at: new Date() })
        .where(eq(planFeatures.id, id))
        .returning();
      
      return updatedFeature;
    } catch (error) {
      console.error("Error updating plan feature:", error);
      return undefined;
    }
  }
  
  async deletePlanFeature(id: number): Promise<void> {
    try {
      await db.delete(planFeatures).where(eq(planFeatures.id, id));
    } catch (error) {
      console.error("Error deleting plan feature:", error);
    }
  }
  
  async checkFeatureAccess(userId: number, featureKey: string): Promise<boolean> {
    try {
      const user = await this.getUser(userId);
      if (!user) return false;
      
      // Se o usuário for admin, sempre tem acesso a todas as funcionalidades
      if (user.role === "admin") return true;
      
      // Se o usuário estiver bloqueado, não tem acesso a nenhuma funcionalidade
      if (user.is_blocked) return false;
      
      // Usuários sem assinatura não têm acesso às funcionalidades premium
      if (user.subscription_tier === "none") return false;
      
      const [feature] = await db
        .select()
        .from(planFeatures)
        .where(
          and(
            eq(planFeatures.subscription_tier, user.subscription_tier),
            eq(planFeatures.feature_key, featureKey),
            eq(planFeatures.is_enabled, true)
          )
        );
      
      return !!feature;
    } catch (error) {
      console.error("Error checking feature access:", error);
      return false;
    }
  }
  
  // Analysis reports
  async getAnalysisReport(id: number): Promise<AnalysisReport | undefined> {
    try {
      const [report] = await db.select().from(analysisReports).where(eq(analysisReports.id, id));
      return report;
    } catch (error) {
      console.error("Error getting analysis report:", error);
      return undefined;
    }
  }
  
  async getUserAnalysisReports(userId: number): Promise<AnalysisReport[]> {
    try {
      return await db
        .select()
        .from(analysisReports)
        .where(eq(analysisReports.user_id, userId))
        .orderBy(desc(analysisReports.created_at));
    } catch (error) {
      console.error("Error getting user analysis reports:", error);
      return [];
    }
  }
  
  async createAnalysisReport(report: InsertAnalysisReport): Promise<AnalysisReport> {
    try {
      const [newReport] = await db
        .insert(analysisReports)
        .values({
          ...report,
          is_exported: false,
          export_format: null,
          exported_at: null,
          exported_url: null
        })
        .returning();
      
      return newReport;
    } catch (error) {
      console.error("Error creating analysis report:", error);
      throw error;
    }
  }
  
  async updateAnalysisReport(id: number, data: Partial<AnalysisReport>): Promise<AnalysisReport | undefined> {
    try {
      const [updatedReport] = await db
        .update(analysisReports)
        .set(data)
        .where(eq(analysisReports.id, id))
        .returning();
      
      return updatedReport;
    } catch (error) {
      console.error("Error updating analysis report:", error);
      return undefined;
    }
  }
  
  async exportAnalysisReport(id: number, format: string): Promise<AnalysisReport | undefined> {
    try {
      const now = new Date();
      const exportedUrl = `/exports/report-${id}.${format.toLowerCase()}`;
      
      const [exportedReport] = await db
        .update(analysisReports)
        .set({
          is_exported: true,
          export_format: format as any,
          exported_at: now,
          exported_url: exportedUrl
        })
        .where(eq(analysisReports.id, id))
        .returning();
      
      return exportedReport;
    } catch (error) {
      console.error("Error exporting analysis report:", error);
      return undefined;
    }
  }
  
  // Support tickets
  async getSupportTicket(id: number): Promise<SupportTicket | undefined> {
    try {
      const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, id));
      return ticket;
    } catch (error) {
      console.error("Error getting support ticket:", error);
      return undefined;
    }
  }
  
  async getUserSupportTickets(userId: number): Promise<SupportTicket[]> {
    try {
      return await db
        .select()
        .from(supportTickets)
        .where(eq(supportTickets.user_id, userId))
        .orderBy(desc(supportTickets.created_at));
    } catch (error) {
      console.error("Error getting user support tickets:", error);
      return [];
    }
  }
  
  async createSupportTicket(ticket: InsertSupportTicket): Promise<SupportTicket> {
    try {
      const now = new Date();
      const [newTicket] = await db
        .insert(supportTickets)
        .values({
          ...ticket,
          status: "pending",
          created_at: now,
          updated_at: now,
          resolved_at: null,
          assigned_to: null
        })
        .returning();
      
      return newTicket;
    } catch (error) {
      console.error("Error creating support ticket:", error);
      throw error;
    }
  }
  
  async updateSupportTicket(id: number, data: Partial<SupportTicket>): Promise<SupportTicket | undefined> {
    try {
      const [updatedTicket] = await db
        .update(supportTickets)
        .set({ ...data, updated_at: new Date() })
        .where(eq(supportTickets.id, id))
        .returning();
      
      return updatedTicket;
    } catch (error) {
      console.error("Error updating support ticket:", error);
      return undefined;
    }
  }
  
  async assignSupportTicket(id: number, assignedTo: number): Promise<SupportTicket | undefined> {
    try {
      return await this.updateSupportTicket(id, { assigned_to: assignedTo, status: "in_progress" });
    } catch (error) {
      console.error("Error assigning support ticket:", error);
      return undefined;
    }
  }
  
  async resolveSupportTicket(id: number): Promise<SupportTicket | undefined> {
    try {
      const now = new Date();
      return await this.updateSupportTicket(id, { status: "resolved", resolved_at: now });
    } catch (error) {
      console.error("Error resolving support ticket:", error);
      return undefined;
    }
  }
  
  // Plan pricing functionality
  async getPlanPricing(id: number): Promise<PlanPricing | undefined> {
    try {
      const [pricing] = await db.select().from(planPricing).where(eq(planPricing.id, id));
      return pricing;
    } catch (error) {
      console.error("Error getting plan pricing:", error);
      return undefined;
    }
  }
  
  async getPlanPricingByTier(subscriptionTier: string): Promise<PlanPricing | undefined> {
    try {
      const [pricing] = await db.select().from(planPricing).where(eq(planPricing.subscription_tier, subscriptionTier));
      return pricing;
    } catch (error) {
      console.error("Error getting plan pricing by tier:", error);
      return undefined;
    }
  }
  
  async getAllPlanPricing(): Promise<PlanPricing[]> {
    try {
      return await db.select().from(planPricing).orderBy(asc(planPricing.id));
    } catch (error) {
      console.error("Error getting all plan pricing:", error);
      return [];
    }
  }
  
  async createPlanPricing(pricing: InsertPlanPricing): Promise<PlanPricing> {
    try {
      const [newPricing] = await db.insert(planPricing).values(pricing).returning();
      return newPricing;
    } catch (error) {
      console.error("Error creating plan pricing:", error);
      throw error;
    }
  }
  
  async updatePlanPricing(id: number, data: Partial<PlanPricing>): Promise<PlanPricing | undefined> {
    try {
      const [updatedPricing] = await db
        .update(planPricing)
        .set({ ...data, updated_at: new Date() })
        .where(eq(planPricing.id, id))
        .returning();
      
      return updatedPricing;
    } catch (error) {
      console.error("Error updating plan pricing:", error);
      return undefined;
    }
  }
  
  // Usage tracking
  async incrementMessageCount(userId: number): Promise<User | undefined> {
    try {
      const user = await this.getUser(userId);
      if (!user) return undefined;
      
      const newCount = (user.message_count || 0) + 1;
      return await this.updateUser(userId, { message_count: newCount });
    } catch (error) {
      console.error("Error incrementing message count:", error);
      return undefined;
    }
  }
  
  async checkMessageLimit(userId: number): Promise<boolean> {
    try {
      const user = await this.getUser(userId);
      if (!user) return false;
      
      // Admins não têm limite de mensagens
      if (user.role === "admin") return true;
      
      // Usuários bloqueados não podem enviar mensagens
      if (user.is_blocked) return false;
      
      // Usuários sem assinatura não podem enviar mensagens
      if (user.subscription_tier === "none") return false;
      
      // Verificar se ainda há mensagens disponíveis
      const messageCount = user.message_count || 0;
      const maxMessages = user.max_messages || 0;
      
      return messageCount < maxMessages;
    } catch (error) {
      console.error("Error checking message limit:", error);
      return false;
    }
  }
  
  async resetMessageCounts(): Promise<void> {
    try {
      // Resetar contagens de mensagens para todos os usuários com assinatura ativa
      await db
        .update(users)
        .set({ message_count: 0 })
        .where(and(
          or(
            eq(users.subscription_tier, "basic"),
            eq(users.subscription_tier, "intermediate")
          ),
          eq(users.is_blocked, false)
        ));
    } catch (error) {
      console.error("Error resetting message counts:", error);
    }
  }
  
  async getUsersBySubscriptionTier(tier: "none" | "basic" | "intermediate"): Promise<User[]> {
    try {
      return await db
        .select()
        .from(users)
        .where(eq(users.subscription_tier, tier));
    } catch (error) {
      console.error(`Error getting users by subscription tier (${tier}):`, error);
      return [];
    }
  }
}

// Use DatabaseStorage em vez de MemStorage
export const storage = new DatabaseStorage();

// Inicializar planos e recursos quando o aplicativo iniciar
initializePlansAndFeatures(storage).catch(error => 
  console.error("Erro ao inicializar planos e recursos:", error)
);
