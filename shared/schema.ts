import { pgTable, text, serial, integer, boolean, timestamp, varchar, json, foreignKey } from "drizzle-orm/pg-core";
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
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
  created_by: integer("created_by").notNull().references(() => users.id),
});

export const insertLlmConfigSchema = createInsertSchema(llmConfigs).pick({
  model_name: true,
  api_key: true,
  created_by: true,
});

// Avatar Configuration table
export const avatars = pgTable("avatars", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  image_url: text("image_url").notNull(),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
  created_by: integer("created_by").notNull().references(() => users.id),
});

export const insertAvatarSchema = createInsertSchema(avatars).pick({
  name: true,
  image_url: true,
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
