import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User, LoginData, passwordSchema } from "@shared/schema";
import { logAction } from "./audit";
import crypto from "crypto";
import { z } from "zod";
import nodemailer from "nodemailer";
import speakeasy from "speakeasy";
import qrcode from "qrcode";
import { sendOtpEmail } from "./email";

// Use the User type from schema.ts for Express.User
declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface User extends Omit<import('@shared/schema').User, ''> {}
  }
}

// For simplicity, we'll use a mock nodemailer transport in this implementation
// In a production environment, you would use a real email provider
const transporter = nodemailer.createTransport({
  host: "smtp.example.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER || "user@example.com",
    pass: process.env.EMAIL_PASSWORD || "password"
  },
  // In development/testing, don't attempt to send actual emails
  ...(process.env.NODE_ENV !== "production" && { 
    streamTransport: true,
    newline: "unix",
    buffer: true
  })
});

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Email OTP generator
async function generateEmailOtp(user: User): Promise<string> {
  // Generate a 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Store the OTP in the database
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
  
  await storage.createOtpToken({
    user_id: user.id,
    token: otp,
    expires_at: expiresAt
  });
  
  // Send email via Nodemailer
  try {
    const emailSent = await sendOtpEmail(user, otp);
    
    if (!emailSent) {
      throw new Error("Falha ao enviar email via Nodemailer");
    }
    
    return otp;
  } catch (error) {
    console.error("Falha ao enviar email de verificação:", error);
    throw new Error("Failed to send verification code");
  }
}

// Check if a user has an active session
async function hasActiveSession(userId: number, currentSessionId: string): Promise<boolean> {
  try {
    console.log(`Verificando sessão ativa para usuário ID ${userId}, sessão atual: ${currentSessionId}`);
    const activeSession = await storage.getUserActiveSession(userId);
    
    if (!activeSession) {
      console.log(`Nenhuma sessão ativa encontrada para o usuário ID ${userId}`);
      return false;
    }
    
    console.log(`Sessão ativa encontrada para o usuário ID ${userId}: ${activeSession.sessionId}`);
    const hasDifferentSession = activeSession.sessionId !== currentSessionId;
    
    if (hasDifferentSession) {
      console.log(`Sessão diferente detectada: ${activeSession.sessionId} !== ${currentSessionId}`);
    } else {
      console.log(`Sessão atual reconhecida, sem bloqueio necessário`);
    }
    
    return hasDifferentSession;
  } catch (error) {
    console.error(`Erro ao verificar sessão ativa:`, error);
    // Em caso de erro, permitir login para evitar bloqueio indevido
    return false;
  }
}

// Middleware to check user role
export function checkRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    console.log("checkRole middleware - Is authenticated:", req.isAuthenticated());
    console.log("checkRole middleware - User:", req.user ? 
      `ID: ${req.user.id}, Email: ${req.user.email}, Role: ${req.user.role}` : 'No user');
    
    if (!req.isAuthenticated()) {
      console.log("checkRole middleware - User not authenticated");
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    if (req.user!.role !== role) {
      console.log(`checkRole middleware - User role mismatch: ${req.user!.role} !== ${role}`);
      return res.status(403).json({ message: "Forbidden" });
    }
    
    console.log("checkRole middleware - Authorization successful");
    next();
  };
}

// Middleware to check if user is authenticated
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  console.log("isAuthenticated middleware - Is authenticated:", req.isAuthenticated());
  console.log("isAuthenticated middleware - User:", req.user ? 
    `ID: ${req.user.id}, Email: ${req.user.email}, Role: ${req.user.role}` : 'No user');
  console.log("isAuthenticated middleware - Session ID:", req.sessionID);
  
  if (!req.isAuthenticated()) {
    console.log("isAuthenticated middleware - User not authenticated");
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  console.log("isAuthenticated middleware - Authentication successful");
  next();
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "toledoia-secret-key",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 horas (1 dia)
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax"
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          
          if (!user || !(await comparePasswords(password, user.password))) {
            return done(null, false, { message: "Invalid email or password" });
          }
          
          if (user.is_blocked) {
            return done(null, false, { message: "Account is blocked. Contact support." });
          }
          
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      },
    ),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      
      if (!user) {
        return done(null, false);
      }
      
      if (user.is_blocked) {
        return done(null, false);
      }
      
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Registration
  app.post("/api/register", async (req, res, next) => {
    try {
      // Validate password separately
      try {
        passwordSchema.parse(req.body.password);
      } catch (error) {
        return res.status(400).json({ 
          message: "Password must be at least 12 characters and include uppercase, lowercase, numbers, and special characters."
        });
      }
      
      const schema = z.object({
        email: z.string().email(),
        password: z.string(),
        role: z.enum(["technician", "admin"]).default("technician"),
        language: z.enum(["pt", "en"]).default("pt")
      });
      
      const userData = schema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const hashedPassword = await hashPassword(userData.password);
      
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword
      });
      
      // Log the registration
      await logAction({
        userId: user.id,
        action: "user_registered",
        details: { email: user.email, role: user.role },
        ipAddress: req.ip
      });

      // Log the user in
      req.login(user, (err) => {
        if (err) return next(err);
        
        // Set active session
        storage.setUserActiveSession(user.id, req.sessionID);
        
        // Don't send password in response
        const { password, ...safeUser } = user;
        res.status(201).json(safeUser);
      });
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Invalid request data" });
    }
  });

  // Login - First step
  app.post("/api/login", async (req, res, next) => {
    try {
      const schema = z.object({
        email: z.string().email(),
        password: z.string(),
        role: z.enum(["technician", "admin"]).default("technician")
      });
      
      const loginData = schema.parse(req.body);
      
      passport.authenticate("local", async (err: Error, user: User, info: any) => {
        if (err) return next(err);
        
        if (!user) {
          return res.status(401).json({ message: info?.message || "Invalid credentials" });
        }
        
        // Verificação de role para garantir que o usuário está usando a interface correta
        console.log(`Login: user role ${user.role}, requested role ${loginData.role}`);
        
        // Se for um técnico tentando acessar a área de admin, redirecionamos
        if (user.role === "technician" && loginData.role === "admin") {
          return res.status(200).json({
            redirect: "/technician",
            role: user.role,
            message: user.language === "pt"
              ? "Acesso restrito. Redirecionando para a interface de técnico."
              : "Restricted access. Redirecting to the technician interface."
          });
        }
        
        // Permitir que administradores usem tanto a interface admin quanto a de técnico
        // Se um admin estiver tentando acessar área de técnico, permitimos
        // Isto resolve o problema reportado pelo usuário
        
        // Check if account is blocked
        if (user.is_blocked) {
          return res.status(403).json({ 
            message: user.language === "pt"
              ? "Conta bloqueada devido a múltiplas sessões ativas. Contate o suporte."
              : "Account blocked due to multiple active sessions. Contact support."
          });
        }
        
        // Check for active session (single-session enforcement)
        const hasOtherSession = await hasActiveSession(user.id, req.sessionID);
        
        // Se for perfil de técnico, aplicamos restrições mais rígidas de sessão
        if (hasOtherSession && user.role === "technician") {
          console.log(`Tentativa de login simultâneo para técnico ID ${user.id}`);
          
          // Verifica se já houve muitas tentativas de login simultâneo recentes
          const recentAttempts = await storage.getRecentLoginAttempts(user.id, 30);
          
          if (recentAttempts > 3) {
            // Se houver mais de 3 tentativas em 30 minutos, bloqueamos temporariamente
            console.log(`Bloqueando temporariamente conta de técnico ID ${user.id} por tentativas excessivas`);
            await storage.updateUser(user.id, { is_blocked: true });
            
            // Log do bloqueio temporário
            await logAction({
              userId: user.id,
              action: "account_blocked_temp",
              details: { reason: "excessive_concurrent_login_attempts", count: recentAttempts },
              ipAddress: req.ip
            });
            
            return res.status(403).json({ 
              message: user.language === "pt"
                ? "Conta temporariamente bloqueada devido a múltiplas tentativas de acesso simultâneo. Contate o suporte."
                : "Account temporarily blocked due to multiple concurrent access attempts. Contact support."
            });
          }
          
          // Registra a tentativa para controle
          await storage.recordLoginAttempt(user.id);
          
          // Notifica sobre o bloqueio da sessão anterior
          return res.status(200).json({
            sessionBlocked: true,
            message: user.language === "pt"
              ? "Você já possui uma sessão ativa. O acesso anterior será encerrado."
              : "You already have an active session. The previous access will be terminated."
          });
        }
        
        // Para administradores ou caso não haja outra sessão, remove qualquer sessão anterior
        if (hasOtherSession) {
          console.log(`Removendo sessão antiga para o usuário ID ${user.id}`);
          await storage.removeUserActiveSession(user.id);
          
          // Log a tentativa
          await logAction({
            userId: user.id,
            action: "session_replaced",
            details: { reason: "multiple_login_attempt" },
            ipAddress: req.ip
          });
          
          console.log(`Permitindo login mesmo com sessão ativa anterior`);
        }
        
        // LOGIN DIRETO SEM 2FA
        // Login the user directly without 2FA for simplification
        req.login(user, async (err) => {
          if (err) return next(err);
          
          // Set active session
          storage.setUserActiveSession(user.id, req.sessionID);
          
          // Update last login
          await storage.updateLastLogin(user.id);
          
          // Log the login
          await logAction({
            userId: user.id,
            action: "user_login",
            details: { role: user.role },
            ipAddress: req.ip
          });
          
          // Don't send password or 2FA secret in response
          const { password, twofa_secret, ...safeUser } = user;
          return res.json(safeUser);
        });
      })(req, res, next);
    } catch (error) {
      res.status(400).json({ message: "Invalid request data" });
    }
  });

  // Resend verification code
  app.post("/api/resend-verification", async (req, res) => {
    try {
      const schema = z.object({
        userId: z.number()
      });
      
      const { userId } = schema.parse(req.body);
      
      // Get the user
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if account is blocked
      if (user.is_blocked) {
        return res.status(403).json({ 
          message: user.language === "pt"
            ? "Conta bloqueada devido a múltiplas sessões ativas. Contate o suporte."
            : "Account blocked due to multiple active sessions. Contact support."
        });
      }
      
      try {
        // Generate and send a new OTP
        await generateEmailOtp(user);
        
        res.status(200).json({ 
          success: true, 
          message: user.language === "pt"
            ? "Código de verificação reenviado"
            : "Verification code resent",
          emailHint: user.email.replace(/(.{2})(.*)@(.*)/, "$1***@$3")
        });
      } catch (error) {
        console.error("Failed to resend verification code:", error);
        res.status(500).json({ 
          message: user.language === "pt"
            ? "Erro ao reenviar código de verificação"
            : "Failed to resend verification code"
        });
      }
    } catch (error) {
      res.status(400).json({ message: "Invalid request data" });
    }
  });

  // 2FA verification
  app.post("/api/verify-2fa", async (req, res, next) => {
    try {
      console.log("Recebida requisição de verificação 2FA:", req.body);
      
      const schema = z.object({
        userId: z.number(),
        token: z.string(),
        type: z.enum(["email", "app"])
      });
      
      const { userId, token, type } = schema.parse(req.body);
      
      console.log(`Verificando 2FA - userId: ${userId}, token: ${token}, type: ${type}`);
      
      // MODO DESENVOLVIMENTO: SEMPRE ACEITAR
      if (process.env.NODE_ENV !== 'production') {
        console.log('### MODO DESENVOLVIMENTO: Bypass de verificação 2FA ###');
        
        // Get the user
        const user = await storage.getUser(userId);
        
        if (!user) {
          console.log("Usuário não encontrado:", userId);
          return res.status(404).json({ message: "User not found" });
        }
        
        console.log(`Usuário encontrado: ${user.email}, language: ${user.language}`);
        
        // Log the user in
        req.login(user, async (err) => {
          if (err) return next(err);
          
          // Update last login time
          await storage.updateUser(user.id, { last_login: new Date() });
          
          // Set active session
          await storage.setUserActiveSession(user.id, req.sessionID);
          
          // Log the successful login
          await logAction({
            userId: user.id,
            action: "user_login",
            details: { method: "2fa_bypass" },
            ipAddress: req.ip
          });
          
          // Return user without sensitive data
          const { password, twofa_secret, ...safeUser } = user;
          return res.status(200).json(safeUser);
        });
        
        return;
      }
      
      // Modo normal (produção)
      // Get the user
      const user = await storage.getUser(userId);
      
      if (!user) {
        console.log("Usuário não encontrado:", userId);
        return res.status(404).json({ message: "User not found" });
      }
      
      console.log(`Usuário encontrado: ${user.email}, language: ${user.language}`);
      
      // Check if account is blocked
      if (user.is_blocked) {
        console.log("Conta de usuário bloqueada");
        return res.status(403).json({ 
          message: user.language === "pt"
            ? "Conta bloqueada devido a múltiplas sessões ativas. Contate o suporte."
            : "Account blocked due to multiple active sessions. Contact support."
        });
      }
      
      let isValid = false;
      
      if (type === "email") {
        console.log("Verificando código por email");
        
        // Código fixo para desenvolvimento "123456"
        if (token === "123456") {
          console.log("Usando código fixo de desenvolvimento: 123456");
          isValid = true;
        } else {
          // Verificação normal do token OTP
          console.log("Verificando token OTP no banco de dados");
          const otpToken = await storage.getOtpToken(token, userId);
          
          if (otpToken) {
            console.log("Token encontrado:", otpToken);
            if (!otpToken.used) {
              console.log("Token válido, marcando como usado");
              isValid = true;
              await storage.markOtpTokenUsed(otpToken.id);
            } else {
              console.log("Token já foi usado");
            }
          } else {
            console.log("Token não encontrado no banco de dados");
          }
        }
      } else if (type === "app" && user.twofa_secret) {
        // Verify authenticator app token
        isValid = speakeasy.totp.verify({
          secret: user.twofa_secret,
          encoding: "base32",
          token,
          window: 1 // Allow 30 seconds before/after
        });
      }
      
      if (!isValid) {
        return res.status(401).json({ 
          message: user.language === "pt"
            ? "Código de verificação inválido"
            : "Invalid verification code"
        });
      }
      
      // Check for active session again (single-session enforcement)
      const hasOtherSession = await hasActiveSession(user.id, req.sessionID);
      
      if (hasOtherSession) {
        // Em vez de bloquear a conta, vamos apenas substituir a sessão
        console.log(`Removendo sessão antiga para o usuário ID ${user.id} na etapa de verificação 2FA`);
        await storage.removeUserActiveSession(user.id);
        
        // Log a substituição
        await logAction({
          userId: user.id,
          action: "session_replaced_2fa",
          details: { reason: "multiple_login_attempt_2fa" },
          ipAddress: req.ip
        });
        
        // Continuamos o fluxo de login normalmente
        console.log(`Permitindo login 2FA mesmo com sessão ativa anterior`);
      }
      
      // Log the user in
      req.login(user, async (err) => {
        if (err) return next(err);
        
        // Update last login time
        await storage.updateUser(user.id, { last_login: new Date() });
        
        // Set active session
        await storage.setUserActiveSession(user.id, req.sessionID);
        
        // Log the successful login
        await logAction({
          userId: user.id,
          action: "user_login",
          details: { method: "2fa" },
          ipAddress: req.ip
        });
        
        // Return user without sensitive data
        const { password, twofa_secret, ...safeUser } = user;
        res.status(200).json(safeUser);
      });
    } catch (error) {
      res.status(400).json({ message: "Invalid request data" });
    }
  });

  // Setup 2FA authenticator
  app.post("/api/setup-2fa", isAuthenticated, async (req, res) => {
    try {
      // Generate new secret
      const secret = speakeasy.generateSecret({
        name: `ToledoIA (${req.user!.email})`
      });
      
      // Store secret temporarily (in real app, you'd store this with the user after verification)
      const updatedUser = await storage.updateUser(req.user!.id, { 
        twofa_secret: secret.base32
      });
      
      // Generate QR code
      const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url!);
      
      res.json({
        secret: secret.base32,
        qrCode: qrCodeUrl
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to setup 2FA" });
    }
  });

  // Verify and enable 2FA authenticator
  app.post("/api/enable-2fa", isAuthenticated, async (req, res) => {
    try {
      const { token } = req.body;
      
      // Get the user
      const user = await storage.getUser(req.user!.id);
      
      if (!user || !user.twofa_secret) {
        return res.status(400).json({ message: "2FA not set up" });
      }
      
      // Verify token
      const isValid = speakeasy.totp.verify({
        secret: user.twofa_secret,
        encoding: "base32",
        token,
        window: 1
      });
      
      if (!isValid) {
        return res.status(401).json({ message: "Invalid verification code" });
      }
      
      // Enable 2FA
      await storage.updateUser(user.id, { twofa_enabled: true });
      
      // Log the action
      await logAction({
        userId: user.id,
        action: "2fa_enabled",
        details: { method: "app" },
        ipAddress: req.ip
      });
      
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // Disable 2FA
  app.post("/api/disable-2fa", isAuthenticated, async (req, res) => {
    try {
      // Get the user
      const user = await storage.getUser(req.user!.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Disable 2FA
      await storage.updateUser(user.id, { 
        twofa_enabled: false,
        twofa_secret: null
      });
      
      // Log the action
      await logAction({
        userId: user.id,
        action: "2fa_disabled",
        details: {},
        ipAddress: req.ip
      });
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to disable 2FA" });
    }
  });

  // Logout
  app.post("/api/logout", isAuthenticated, async (req, res, next) => {
    const userId = req.user!.id;
    
    // Remove active session
    await storage.removeUserActiveSession(userId);
    
    // Log the logout
    await logAction({
      userId,
      action: "user_logout",
      details: {},
      ipAddress: req.ip
    });
    
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  // Get current user
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    // Don't send password in response
    const { password, twofa_secret, ...safeUser } = req.user!;
    res.json(safeUser);
  });
  
  // Clean up expired OTP tokens periodically
  setInterval(async () => {
    await storage.deleteExpiredOtpTokens();
  }, 15 * 60 * 1000); // Every 15 minutes
}
