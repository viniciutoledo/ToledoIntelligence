import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2, WrenchIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

// Esquema de validação para login
const loginSchema = z.object({
  email: z.string().email().min(1, "Email é obrigatório"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  role: z.literal("technician").default("technician"),
});

// Esquema de validação para registro
const registerSchema = z.object({
  email: z.string().email().min(1, "Email é obrigatório"),
  username: z.string().min(3, "Nome de usuário deve ter pelo menos 3 caracteres"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string().min(1, "Confirmação de senha é obrigatória"),
  role: z.literal("technician").default("technician"),
  language: z.enum(["pt", "en"]).default("pt"),
}).refine(data => data.password === data.confirmPassword, {
  message: "As senhas não conferem",
  path: ["confirmPassword"],
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

// Props do componente
interface TechnicianAuthFormProps {
  onSuccess?: () => void;
}

// Componente de autenticação para técnicos
export function TechnicianAuthForm({ onSuccess }: TechnicianAuthFormProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { loginMutation, registerMutation } = useAuth();
  const [error, setError] = useState<string | null>(null);
  
  // Form hooks
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      role: "technician",
    },
  });
  
  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      username: "",
      password: "",
      confirmPassword: "",
      role: "technician",
      language: "pt",
    },
  });
  
  // Funções de submit
  const onLoginSubmit = (values: LoginFormValues) => {
    setError(null);
    loginMutation.mutate(values, {
      onSuccess: () => {
        if (onSuccess) onSuccess();
      },
      onError: (error) => {
        setError(error.message || t("auth.genericError"));
      },
    });
  };
  
  const onRegisterSubmit = (values: RegisterFormValues) => {
    setError(null);
    registerMutation.mutate(values, {
      onSuccess: () => {
        toast({
          title: t("auth.registrationSuccess"),
          description: t("auth.registrationSuccessMessage"),
        });
        if (onSuccess) onSuccess();
      },
      onError: (error) => {
        setError(error.message || t("auth.genericError"));
      },
    });
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center space-x-2 mb-2">
        <WrenchIcon className="h-6 w-6 text-primary" />
        <h2 className="text-xl font-semibold text-center">{t("auth.technicianPortal")}</h2>
      </div>
      
      {error && (
        <div className="bg-red-500 bg-opacity-10 border border-red-500 text-red-500 px-4 py-2 rounded-md text-sm">
          {error}
        </div>
      )}
      
      <Tabs defaultValue="login" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">{t("auth.login")}</TabsTrigger>
          <TabsTrigger value="register">{t("auth.register")}</TabsTrigger>
        </TabsList>
        
        {/* Tab de Login */}
        <TabsContent value="login">
          <Form {...loginForm}>
            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
              <FormField
                control={loginForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("common.email")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("auth.emailPlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={loginForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("common.password")}</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder={t("auth.passwordPlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Role oculto como technician */}
              <input type="hidden" {...loginForm.register("role")} value="technician" />
              
              <Button 
                type="submit" 
                className="w-full"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("auth.login")}
              </Button>
            </form>
          </Form>
        </TabsContent>
        
        {/* Tab de Registro */}
        <TabsContent value="register">
          <Form {...registerForm}>
            <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
              <FormField
                control={registerForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("common.email")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("auth.emailPlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={registerForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("common.username")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("auth.usernamePlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={registerForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("common.password")}</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder={t("auth.passwordPlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={registerForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("common.confirmPassword")}</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder={t("auth.passwordPlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Campos ocultos */}
              <input type="hidden" {...registerForm.register("role")} value="technician" />
              <input type="hidden" {...registerForm.register("language")} value="pt" />
              
              <Button 
                type="submit" 
                className="w-full"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("auth.register")}
              </Button>
            </form>
          </Form>
        </TabsContent>
      </Tabs>
    </div>
  );
}