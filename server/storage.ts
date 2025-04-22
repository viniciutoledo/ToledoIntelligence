import {
  users, User, InsertUser,
  llmConfigs, LlmConfig, InsertLlmConfig,
  avatars, Avatar, InsertAvatar,
  chatSessions, ChatSession, InsertChatSession,
  chatMessages, ChatMessage, InsertChatMessage,
  auditLogs, AuditLog, InsertAuditLog,
  otpTokens, OtpToken, InsertOtpToken
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
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<User>): Promise<User | undefined>;
  updateLastLogin(id: number): Promise<User | undefined>;
  blockUser(id: number): Promise<User | undefined>;
  unblockUser(id: number): Promise<User | undefined>;
  deleteUser(id: number): Promise<void>;
  
  // LLM configuration
  getLlmConfig(id: number): Promise<LlmConfig | undefined>;
  getActiveLlmConfig(): Promise<LlmConfig | undefined>;
  createLlmConfig(config: InsertLlmConfig): Promise<LlmConfig>;
  updateLlmConfig(id: number, data: Partial<LlmConfig>): Promise<LlmConfig | undefined>;
  setActiveLlmConfig(id: number): Promise<LlmConfig | undefined>;
  
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
  getTrainingDocuments(): Promise<TrainingDocument[]>;
  createTrainingDocument(document: InsertTrainingDocument): Promise<TrainingDocument>;
  updateTrainingDocument(id: number, data: Partial<TrainingDocument>): Promise<TrainingDocument | undefined>;
  deleteTrainingDocument(id: number): Promise<void>;
  updateTrainingDocumentStatus(id: number, status: string, errorMessage?: string): Promise<TrainingDocument | undefined>;
  
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
}

export class MemStorage implements IStorage {
  // Implementação do método deleteUser para MemStorage
  async deleteUser(id: number): Promise<void> {
    // Remover o usuário
    this.users.delete(id);
    
    // Limpar a sessão ativa do usuário
    this.removeUserActiveSession(id);
    
    // Em uma implementação real, você também removeria ou anonimizaria 
    // todos os dados associados ao usuário, como mensagens, logs, etc.
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
      documentCategoryId: 1
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
    
    return this.llmConfigs.get(id);
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
}

import { db, pool } from './db';
import connectPg from "connect-pg-simple";
import { eq, and, isNull, lt, gt, or, desc, asc } from 'drizzle-orm';
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

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool,
      createTableIfMissing: true 
    });
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
    
    return activatedConfig;
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
}

// Use DatabaseStorage em vez de MemStorage
export const storage = new DatabaseStorage();
