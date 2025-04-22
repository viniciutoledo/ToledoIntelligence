import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { useToast } from "@/hooks/use-toast";
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
import { Loader2, ShieldAlert } from "lucide-react";

// Esquema de validação - Específico para administradores (apenas login)
const loginSchema = z.object({
  email: z.string().email().min(1, "Email é obrigatório"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  role: z.literal("admin").default("admin"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// Props do componente
interface AdminAuthFormProps {
  onSuccess?: () => void;
}

// Componente de autenticação exclusivo para administradores
export function AdminAuthForm({ onSuccess }: AdminAuthFormProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { loginMutation } = useAuth();
  const [error, setError] = useState<string | null>(null);
  
  // Form hook
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      role: "admin",
    },
  });
  
  // Lidar com o envio do formulário de login
  const onLoginSubmit = (values: LoginFormValues) => {
    setError(null);
    console.log("Tentando login como administrador:", values);
    loginMutation.mutate(values, {
      onSuccess: (user) => {
        console.log("Login bem-sucedido no Admin Form:", user);
        
        // Verificar se o servidor está nos enviando um redirecionamento
        if (user.redirect) {
          console.log(`Redirecionamento detectado para: ${user.redirect}`);
          toast({
            title: t("common.redirecting"),
            description: user.message || t("auth.redirectingBasedOnRole"),
          });
          // O redirecionamento já foi tratado no hook useAuth
          return;
        }
        
        // Aqui garantimos que os administradores vão para o painel administrativo,
        // mesmo se algo mudar na interface de autenticação
        if (user.role === "admin") {
          console.log("Usuário é admin, redirecionando para /admin");
          // Uso de navegação direta em vez de wouter para contornar possíveis problemas de estado
          window.location.href = "/admin";
        } else {
          console.log("Usuário não é admin, redirecionando para /technician");
          // Caso de emergência: se um técnico usou esta página, 
          // redirecionamos para a interface de técnico
          window.location.href = "/technician";
        }
      },
      onError: (error) => {
        console.error("Erro de login no Admin Form:", error.message);
        setError(error.message || t("auth.genericError"));
      },
    });
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center space-x-2 mb-4">
        <ShieldAlert className="h-6 w-6 text-amber-500" />
        <h2 className="text-xl font-semibold text-center">{t("admin.adminAccess")}</h2>
      </div>
      
      {error && (
        <div className="bg-red-500 bg-opacity-10 border border-red-500 text-red-500 px-4 py-2 rounded-md text-sm">
          {error}
        </div>
      )}
      
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
          
          {/* Role oculto como admin */}
          <input type="hidden" {...loginForm.register("role")} value="admin" />
          
          <Button 
            type="submit" 
            className="w-full bg-amber-600 hover:bg-amber-500 shadow-md hover:shadow-lg transform transition-all duration-200 hover:scale-[1.02]"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("admin.accessAdminPanel")}
          </Button>
        </form>
      </Form>
      
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-500">
          {t("admin.adminAccessWarning")}
        </p>
      </div>
    </div>
  );
}