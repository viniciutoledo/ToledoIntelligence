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
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<User>): Promise<User | undefined>;
  blockUser(id: number): Promise<User | undefined>;
  unblockUser(id: number): Promise<User | undefined>;
  
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
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private llmConfigs: Map<number, LlmConfig>;
  private avatars: Map<number, Avatar>;
  private chatSessions: Map<number, ChatSession>;
  private chatMessages: Map<number, ChatMessage>;
  private auditLogs: Map<number, AuditLog>;
  private otpTokens: Map<number, OtpToken>;
  private userActiveSessions: Map<number, string>;
  
  sessionStore: session.Store;
  
  private currentIds: {
    userId: number;
    llmConfigId: number;
    avatarId: number;
    chatSessionId: number;
    chatMessageId: number;
    auditLogId: number;
    otpTokenId: number;
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
    
    this.currentIds = {
      userId: 1,
      llmConfigId: 1,
      avatarId: 1,
      chatSessionId: 1,
      chatMessageId: 1,
      auditLogId: 1,
      otpTokenId: 1
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
}

export const storage = new MemStorage();
