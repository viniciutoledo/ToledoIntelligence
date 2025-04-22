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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

// Esquemas de validação
const loginSchema = z.object({
  email: z.string().email().min(1, "Email é obrigatório"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  role: z.literal("technician").default("technician"),
});

const registerSchema = z.object({
  username: z.string().min(1, "Nome de usuário é obrigatório"),
  email: z.string().email().min(1, "Email é obrigatório"),
  password: z
    .string()
    .min(6, "Senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z
    .string()
    .min(1, "Confirmação de senha é obrigatória"),
  role: z.literal("technician").default("technician"),
  language: z.enum(["pt", "en"]).default("pt"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não conferem",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;
type LoginFormValues = z.infer<typeof loginSchema>;

// Props do componente
interface AuthFormProps {
  mode: "login" | "register";
  onSuccess?: () => void;
  onToggleMode?: () => void;
  selectedPlan?: string | null;
}

// Componente principal do formulário de autenticação
export function AuthForm({ mode, onSuccess, onToggleMode, selectedPlan }: AuthFormProps) {
  const { t, language } = useLanguage();
  const { loginMutation, registerMutation } = useAuth();
  const [activeMode, setActiveMode] = useState<"login" | "register">(mode);
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
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: "technician",
      language: language as "pt" | "en",
    },
  });
  
  // Lidar com o envio do formulário de registro
  const onRegisterSubmit = (values: RegisterFormValues) => {
    setError(null);
    registerMutation.mutate(values, {
      onSuccess: () => {
        if (onSuccess) onSuccess();
      },
      onError: (error) => {
        setError(error.message || t("auth.genericError"));
      },
    });
  };
  
  // Lidar com o envio do formulário de login
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
  
  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-500 bg-opacity-10 border border-red-500 text-red-500 px-4 py-2 rounded-md text-sm">
          {error}
        </div>
      )}
      
      <Tabs 
        defaultValue={activeMode} 
        onValueChange={(value) => {
          setActiveMode(value as "login" | "register");
          if (onToggleMode) onToggleMode();
        }}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">{t("auth.login")}</TabsTrigger>
          <TabsTrigger value="register">{t("auth.register")}</TabsTrigger>
        </TabsList>
        
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
              
              {/* Role definido automaticamente como technician */}
              <input type="hidden" {...loginForm.register("role")} value="technician" />
              
              <Button 
                type="submit" 
                className="w-full bg-pink-600 hover:bg-pink-500 shadow-md hover:shadow-lg transform transition-all duration-200 hover:scale-[1.02]"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("auth.login")}
              </Button>
            </form>
          </Form>
        </TabsContent>
        
        <TabsContent value="register">
          <Form {...registerForm}>
            <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
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
              
              {/* Role definido automaticamente como technician */}
              <input type="hidden" {...registerForm.register("role")} value="technician" />
              
              <input
                type="hidden"
                {...registerForm.register("language")}
                value={language as "pt" | "en"}
              />
              
              {selectedPlan && (
                <div className="bg-purple-600 bg-opacity-20 border border-purple-600 text-purple-500 px-4 py-2 rounded-md text-sm">
                  {t("auth.registeringWithPlan")}
                </div>
              )}
              
              <Button 
                type="submit" 
                className="w-full bg-pink-600 hover:bg-pink-500 shadow-md hover:shadow-lg transform transition-all duration-200 hover:scale-[1.02]"
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