import { createContext, ReactNode, useContext, useState } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { z } from "zod";
import { passwordSchema } from "@shared/schema";
import { apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";

interface User {
  id: number;
  email: string;
  role: "technician" | "admin";
  is_blocked: boolean;
  language: "pt" | "en";
  created_at: string;
  updated_at: string;
  last_login?: string;
  twofa_enabled: boolean;
}

interface LoginCredentials {
  email: string;
  password: string;
  role: "technician" | "admin";
}

interface RegisterCredentials {
  email: string;
  password: string;
  confirmPassword: string;
  role: "technician" | "admin";
  language: "pt" | "en";
}

interface TwoFactorVerification {
  userId: number;
  token: string;
  type: "email" | "app";
}

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  loginMutation: UseMutationResult<any, Error, LoginCredentials>;
  registerMutation: UseMutationResult<User, Error, RegisterCredentials>;
  logoutMutation: UseMutationResult<void, Error, void>;
  verifyTwoFactorMutation: UseMutationResult<User, Error, TwoFactorVerification>;
  resendVerificationMutation: UseMutationResult<any, Error, { userId: number }>;
  twoFactorState: TwoFactorState | null;
  changeLanguageMutation: UseMutationResult<User, Error, string>;
};

interface TwoFactorState {
  userId: number;
  requiresTwoFactor: boolean;
  twoFactorType: "email" | "app";
  emailHint?: string;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const { i18n, t } = useLanguage();
  
  const {
    data: user,
    isLoading,
    error,
  } = useQuery<User | null>({
    queryKey: ["/api/user"],
    queryFn: async ({ queryKey }) => {
      try {
        const res = await fetch(queryKey[0] as string, {
          credentials: "include",
        });
        
        if (res.status === 401) {
          return null;
        }
        
        if (!res.ok) {
          throw new Error(`${res.status}: ${res.statusText}`);
        }
        
        return await res.json();
      } catch (error) {
        return null;
      }
    },
    staleTime: 300000, // 5 minutes
  });
  
  // Two-factor state
  const [twoFactorState, setTwoFactorState] = useState<TwoFactorState | null>(null);

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      console.log("Login mutation - credenciais:", { ...credentials, password: "********" });
      const res = await apiRequest("POST", "/api/login", credentials);
      const data = await res.json();
      console.log("Login mutation - resposta:", data);
      return data;
    },
    onSuccess: (data) => {
      console.log("Login onSuccess - dados recebidos:", data);
      if (data.requiresTwoFactor) {
        // Store two-factor state for verification
        console.log("Login onSuccess - verificação em dois fatores necessária");
        setTwoFactorState(data);
      } else {
        // No 2FA required, set user data
        console.log("Login onSuccess - atualizando cache do usuário:", data);
        queryClient.setQueryData(["/api/user"], data);
        
        // Redirecionar com base no papel do usuário
        console.log("Login onSuccess - papel do usuário:", data.role);
        if (data.role === "admin") {
          console.log("Login onSuccess - redirecionando para /admin");
          window.location.href = "/admin";
        } else {
          console.log("Login onSuccess - redirecionando para /technician");
          window.location.href = "/technician";
        }
        
        if (data.language && data.language !== i18n.language) {
          console.log(`Login onSuccess - alterando idioma para ${data.language}`);
          i18n.changeLanguage(data.language);
        }
      }
    },
    onError: (error: Error) => {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: async (credentials: RegisterCredentials) => {
      // Validate password
      try {
        passwordSchema.parse(credentials.password);
      } catch (error) {
        throw new Error(t('common.passwordRequirements'));
      }
      
      // Check if passwords match
      if (credentials.password !== credentials.confirmPassword) {
        throw new Error("Passwords do not match");
      }
      
      // Send registration request
      const { confirmPassword, ...registrationData } = credentials;
      const res = await apiRequest("POST", "/api/register", registrationData);
      return await res.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
      
      if (user.language && user.language !== i18n.language) {
        i18n.changeLanguage(user.language);
      }
      
      toast({
        title: t('common.success'),
        description: t('common.welcomeMessage'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Verify two-factor mutation
  const verifyTwoFactorMutation = useMutation({
    mutationFn: async (verification: TwoFactorVerification) => {
      const res = await apiRequest("POST", "/api/verify-2fa", verification);
      return await res.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
      setTwoFactorState(null);
      
      if (user.language && user.language !== i18n.language) {
        i18n.changeLanguage(user.language);
      }
    },
    onError: (error: Error) => {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      setTwoFactorState(null);
    },
    onError: (error: Error) => {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Resend verification code mutation
  const resendVerificationMutation = useMutation({
    mutationFn: async ({ userId }: { userId: number }) => {
      const res = await apiRequest("POST", "/api/resend-verification", { userId });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: t('common.success'),
        description: t('auth.verificationCodeResent'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Change language mutation
  const changeLanguageMutation = useMutation({
    mutationFn: async (language: string) => {
      if (!language || (language !== "pt" && language !== "en")) {
        throw new Error("Invalid language");
      }
      
      const res = await apiRequest("POST", "/api/user/language", { language });
      return await res.json();
    },
    onSuccess: (user: User) => {
      queryClient.setQueryData(["/api/user"], user);
      i18n.changeLanguage(user.language);
    },
    onError: (error: Error) => {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user || null,
        isLoading,
        loginMutation,
        registerMutation,
        logoutMutation,
        verifyTwoFactorMutation,
        resendVerificationMutation,
        twoFactorState,
        changeLanguageMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
