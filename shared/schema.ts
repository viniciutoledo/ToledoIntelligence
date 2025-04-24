import { pgTable, text, serial, integer, boolean, timestamp, varchar, json, foreignKey, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: ["technician", "admin"] }).notNull().default("technician"),
  is_blocked: boolean("is_blocked").notNull().default(false),
  language: text("language", { enum: ["pt", "en"] }).notNull().default("pt"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
  last_login: timestamp("last_login"),
  twofa_secret: text("twofa_secret"),
  twofa_enabled: boolean("twofa_enabled").notNull().default(false),
  stripe_customer_id: text("stripe_customer_id"),
  stripe_subscription_id: text("stripe_subscription_id"),
  subscription_tier: text("subscription_tier", { enum: ["none", "basic", "intermediate"] }).notNull().default("none"),
  message_count: integer("message_count").notNull().default(0),
  max_messages: integer("max_messages").notNull().default(0),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  role: true,
  language: true,
});

// LLM Configuration table
export const llmConfigs = pgTable("llm_configs", {
  id: serial("id").primaryKey(),
  model_name: text("model_name").notNull(),
  api_key: text("api_key").notNull(),
  tone: text("tone", { enum: ["formal", "normal", "casual"] }).default("normal").notNull(),
  behavior_instructions: text("behavior_instructions"),
  should_use_training: boolean("should_use_training").default(true).notNull(),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
  created_by: integer("created_by").notNull().references(() => users.id),
});

export const insertLlmConfigSchema = createInsertSchema(llmConfigs).pick({
  model_name: true,
  api_key: true,
  tone: true,
  behavior_instructions: true,
  should_use_training: true,
  created_by: true,
});

// Avatar Configuration table
export const avatars = pgTable("avatars", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  image_url: text("image_url").notNull(),
  welcome_message: text("welcome_message"),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
  created_by: integer("created_by").notNull().references(() => users.id),
});

export const insertAvatarSchema = createInsertSchema(avatars).pick({
  name: true,
  image_url: true,
  welcome_message: true,
  created_by: true,
});

// Chat sessions table
export const chatSessions = pgTable("chat_sessions", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => users.id),
  started_at: timestamp("started_at").defaultNow().notNull(),
  ended_at: timestamp("ended_at"),
  language: text("language", { enum: ["pt", "en"] }).notNull(),
});

export const insertChatSessionSchema = createInsertSchema(chatSessions).pick({
  user_id: true,
  language: true,
});

// Chat messages table
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  session_id: integer("session_id").notNull().references(() => chatSessions.id),
  user_id: integer("user_id").notNull().references(() => users.id),
  message_type: text("message_type", { enum: ["text", "image", "file"] }).notNull(),
  content: text("content"),
  file_url: text("file_url"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  is_user: boolean("is_user").notNull().default(true),
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).pick({
  session_id: true,
  user_id: true,
  message_type: true,
  content: true,
  file_url: true,
  is_user: true,
});

// Audit logs table
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").references(() => users.id),
  action: text("action").notNull(),
  details: json("details"),
  ip_address: text("ip_address"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).pick({
  user_id: true,
  action: true,
  details: true,
  ip_address: true,
});

// Session table
export const sessions = pgTable("sessions", {
  id: varchar("id", { length: 255 }).primaryKey(),
  user_id: integer("user_id").references(() => users.id),
  expires_at: timestamp("expires_at").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  data: json("data"),
});

// User active sessions table
export const usersSessions = pgTable("users_sessions", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => users.id),
  session_id: varchar("session_id", { length: 255 }).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Two-factor authentication tokens
export const otpTokens = pgTable("otp_tokens", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => users.id),
  token: text("token").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  expires_at: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
});

export const insertOtpTokenSchema = createInsertSchema(otpTokens).pick({
  user_id: true,
  token: true,
  expires_at: true,
});

// Training documents table
export const trainingDocuments = pgTable("training_documents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  document_type: text("document_type", { enum: ["text", "file", "website", "video"] }).notNull(),
  content: text("content"),
  file_path: text("file_path"),
  file_url: text("file_url"),
  website_url: text("website_url"),
  file_metadata: json("file_metadata"),
  status: text("status", { enum: ["pending", "processing", "completed", "error"] }).notNull().default("pending"),
  error_message: text("error_message"),
  created_by: integer("created_by").notNull().references(() => users.id),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
  is_active: boolean("is_active").notNull().default(true),
});

export const insertTrainingDocumentSchema = createInsertSchema(trainingDocuments).pick({
  name: true,
  description: true,
  document_type: true,
  content: true,
  file_path: true,
  file_url: true,
  website_url: true,
  file_metadata: true,
  created_by: true,
});

// Training categories table
export const trainingCategories = pgTable("training_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  created_by: integer("created_by").notNull().references(() => users.id),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTrainingCategorySchema = createInsertSchema(trainingCategories).pick({
  name: true,
  description: true,
  created_by: true,
});

// Junction table for documents and categories
export const documentCategories = pgTable("document_categories", {
  id: serial("id").primaryKey(),
  document_id: integer("document_id").notNull().references(() => trainingDocuments.id),
  category_id: integer("category_id").notNull().references(() => trainingCategories.id),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const insertDocumentCategorySchema = createInsertSchema(documentCategories).pick({
  document_id: true,
  category_id: true,
});

// Plan features table
export const planFeatures = pgTable("plan_features", {
  id: serial("id").primaryKey(),
  subscription_tier: text("subscription_tier", { enum: ["none", "basic", "intermediate"] }).notNull(),
  feature_key: text("feature_key").notNull(),
  feature_name: text("feature_name").notNull(),
  feature_description: text("feature_description"),
  is_enabled: boolean("is_enabled").notNull().default(true),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// Plan pricing table
export const planPricing = pgTable("plan_pricing", {
  id: serial("id").primaryKey(),
  subscription_tier: text("subscription_tier", { enum: ["none", "basic", "intermediate"] }).notNull().unique(),
  name: text("name").notNull(),
  price: integer("price").notNull(), // Armazenado em centavos
  currency: text("currency", { enum: ["USD", "BRL"] }).notNull().default("BRL"),
  description: text("description"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPlanFeatureSchema = createInsertSchema(planFeatures).pick({
  subscription_tier: true,
  feature_key: true,
  feature_name: true,
  feature_description: true,
  is_enabled: true,
});

export const insertPlanPricingSchema = createInsertSchema(planPricing).pick({
  subscription_tier: true,
  name: true,
  price: true,
  currency: true,
  description: true,
});

// Circuit analysis reports table
export const analysisReports = pgTable("analysis_reports", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => users.id),
  message_id: integer("message_id").references(() => chatMessages.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  image_url: text("image_url"),
  report_type: text("report_type", { enum: ["basic", "advanced"] }).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  is_exported: boolean("is_exported").notNull().default(false),
  export_format: text("export_format", { enum: ["pdf", "docx", "html"] }),
  exported_at: timestamp("exported_at"),
  exported_url: text("exported_url"),
});

export const insertAnalysisReportSchema = createInsertSchema(analysisReports).pick({
  user_id: true,
  message_id: true,
  title: true,
  content: true,
  image_url: true,
  report_type: true,
});

// Support tickets table
export const supportTickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => users.id),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status", { enum: ["pending", "in_progress", "resolved", "closed"] }).notNull().default("pending"),
  priority: text("priority", { enum: ["normal", "high"] }).notNull().default("normal"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
  resolved_at: timestamp("resolved_at"),
  assigned_to: integer("assigned_to").references(() => users.id),
});

export const insertSupportTicketSchema = createInsertSchema(supportTickets).pick({
  user_id: true,
  subject: true,
  message: true,
  priority: true,
});

// Chat widgets table
export const chatWidgets = pgTable("chat_widgets", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  greeting: text("greeting").notNull(),
  avatar_url: text("avatar_url").notNull(),
  avatar_data: text("avatar_data"), // Campo para armazenar dados da imagem em base64
  avatar_mime_type: text("avatar_mime_type"), // Tipo MIME da imagem (image/jpeg, image/png, etc.)
  is_active: boolean("is_active").notNull().default(true),
  api_key: uuid("api_key").defaultRandom().notNull(),
  theme_color: text("theme_color").default("#6366f1"),
  allowed_domains: text("allowed_domains").array(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const insertChatWidgetSchema = createInsertSchema(chatWidgets)
  .pick({
    name: true,
    greeting: true,
    avatar_url: true,
    theme_color: true,
    allowed_domains: true,
  })
  .partial(); // Torna todos os campos opcionais para mais flexibilidade

// Widget chat sessions table
export const widgetChatSessions = pgTable("widget_chat_sessions", {
  id: serial("id").primaryKey(),
  widget_id: uuid("widget_id").notNull().references(() => chatWidgets.id),
  visitor_id: text("visitor_id").notNull(),
  started_at: timestamp("started_at").defaultNow().notNull(),
  ended_at: timestamp("ended_at"),
  language: text("language", { enum: ["pt", "en"] }).notNull().default("pt"),
  referrer_url: text("referrer_url"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const insertWidgetChatSessionSchema = createInsertSchema(widgetChatSessions).pick({
  widget_id: true,
  visitor_id: true,
  language: true,
  referrer_url: true,
});

// Widget chat messages table
export const widgetChatMessages = pgTable("widget_chat_messages", {
  id: serial("id").primaryKey(),
  session_id: integer("session_id").notNull().references(() => widgetChatSessions.id),
  message_type: text("message_type", { enum: ["text", "image", "file"] }).notNull().default("text"),
  content: text("content"),
  file_url: text("file_url"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  is_user: boolean("is_user").notNull().default(true),
});

export const insertWidgetChatMessageSchema = createInsertSchema(widgetChatMessages).pick({
  session_id: true,
  message_type: true,
  content: true,
  file_url: true,
  is_user: true,
});

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type LlmConfig = typeof llmConfigs.$inferSelect;
export type InsertLlmConfig = z.infer<typeof insertLlmConfigSchema>;

export type Avatar = typeof avatars.$inferSelect;
export type InsertAvatar = z.infer<typeof insertAvatarSchema>;

export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export type UserSession = typeof usersSessions.$inferSelect;

export type OtpToken = typeof otpTokens.$inferSelect;
export type InsertOtpToken = z.infer<typeof insertOtpTokenSchema>;

export type TrainingDocument = typeof trainingDocuments.$inferSelect;
export type InsertTrainingDocument = z.infer<typeof insertTrainingDocumentSchema>;

export type TrainingCategory = typeof trainingCategories.$inferSelect;
export type InsertTrainingCategory = z.infer<typeof insertTrainingCategorySchema>;

export type DocumentCategory = typeof documentCategories.$inferSelect;
export type InsertDocumentCategory = z.infer<typeof insertDocumentCategorySchema>;

export type PlanFeature = typeof planFeatures.$inferSelect;
export type InsertPlanFeature = z.infer<typeof insertPlanFeatureSchema>;

export type PlanPricing = typeof planPricing.$inferSelect;
export type InsertPlanPricing = z.infer<typeof insertPlanPricingSchema>;

export type AnalysisReport = typeof analysisReports.$inferSelect;
export type InsertAnalysisReport = z.infer<typeof insertAnalysisReportSchema>;

export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;

export type ChatWidget = typeof chatWidgets.$inferSelect;
export type InsertChatWidget = z.infer<typeof insertChatWidgetSchema>;

export type WidgetChatSession = typeof widgetChatSessions.$inferSelect;
export type InsertWidgetChatSession = z.infer<typeof insertWidgetChatSessionSchema>;

export type WidgetChatMessage = typeof widgetChatMessages.$inferSelect;
export type InsertWidgetChatMessage = z.infer<typeof insertWidgetChatMessageSchema>;

export type KnowledgeBase = typeof knowledgeBase.$inferSelect;
export type InsertKnowledgeBase = z.infer<typeof insertKnowledgeBaseSchema>;

// Knowledge Base table para centralizar conhecimento adquirido
export const knowledgeBase = pgTable("knowledge_base", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  embedding: text("embedding").notNull(), // Será armazenado como JSON stringificado
  source_type: text("source_type", { enum: ["chat", "document", "widget", "training"] }).notNull(),
  source_id: integer("source_id"),
  metadata: json("metadata"),
  language: text("language", { enum: ["pt", "en"] }).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  is_verified: boolean("is_verified").default(false).notNull(),
  relevance_score: integer("relevance_score").default(0).notNull()
});

export const insertKnowledgeBaseSchema = createInsertSchema(knowledgeBase).pick({
  content: true,
  embedding: true,
  source_type: true,
  source_id: true,
  metadata: true,
  language: true,
  is_verified: true,
  relevance_score: true,
});

// Login data
export type LoginData = {
  email: string;
  password: string;
  role: "technician" | "admin";
};

// Password schema with validation
export const passwordSchema = z.string().min(12)
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");
