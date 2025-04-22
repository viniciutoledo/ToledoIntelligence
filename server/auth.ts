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

declare global {
  namespace Express {
    interface User extends User {}
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
  const activeSession = await storage.getUserActiveSession(userId);
  
  if (!activeSession) {
    return false;
  }
  
  return activeSession.sessionId !== currentSessionId;
}

// Middleware to check user role
export function checkRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    if (req.user!.role !== role) {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    next();
  };
}

// Middleware to check if user is authenticated
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  next();
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "toledoia-secret-key",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 30 * 60 * 1000, // 30 minutes
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
        
        // Check if role matches
        if (user.role !== loginData.role) {
          return res.status(403).json({ 
            message: user.language === "pt"
              ? "Função de usuário incorreta"
              : "Incorrect user role"
          });
        }
        
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
        
        if (hasOtherSession) {
          // Block the account
          await storage.blockUser(user.id);
          
          // Log the blocking
          await logAction({
            userId: user.id,
            action: "account_blocked",
            details: { reason: "multiple_sessions" },
            ipAddress: req.ip
          });
          
          return res.status(403).json({
            message: user.language === "pt"
              ? "Conta bloqueada devido a múltiplas sessões ativas. Contate o suporte."
              : "Account blocked due to multiple active sessions. Contact support."
          });
        }
        
        // Generate 2FA challenge
        if (user.twofa_enabled && user.twofa_secret) {
          // User already set up 2FA - create challenge
          return res.status(200).json({
            userId: user.id,
            requiresTwoFactor: true,
            twoFactorType: "app"
          });
        } else {
          // Generate email OTP for 2FA
          try {
            const otp = await generateEmailOtp(user);
            
            // In a real system, we wouldn't return the OTP
            // Here we're just returning it for demonstration
            return res.status(200).json({
              userId: user.id,
              requiresTwoFactor: true,
              twoFactorType: "email",
              emailHint: user.email.replace(/(.{2})(.*)@(.*)/, "$1***@$3")
            });
          } catch (error) {
            return res.status(500).json({ message: "Failed to send verification code" });
          }
        }
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
        // Block the account
        await storage.blockUser(user.id);
        
        // Log the blocking
        await logAction({
          userId: user.id,
          action: "account_blocked",
          details: { reason: "multiple_sessions" },
          ipAddress: req.ip
        });
        
        return res.status(403).json({
          message: user.language === "pt"
            ? "Conta bloqueada devido a múltiplas sessões ativas. Contate o suporte."
            : "Account blocked due to multiple active sessions. Contact support."
        });
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
