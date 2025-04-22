import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import {
  Form,
  FormControl,
  FormDescription,
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

const registerSchema = z.object({
  email: z.string().email({
    message: "Por favor, insira um email válido.",
  }),
  password: z
    .string()
    .min(8, {
      message: "A senha deve ter pelo menos 8 caracteres.",
    })
    .regex(/[A-Z]/, {
      message: "A senha deve conter pelo menos uma letra maiúscula.",
    })
    .regex(/[a-z]/, {
      message: "A senha deve conter pelo menos uma letra minúscula.",
    })
    .regex(/[0-9]/, {
      message: "A senha deve conter pelo menos um número.",
    }),
  confirmPassword: z.string(),
  role: z.enum(["technician", "admin"]),
  language: z.enum(["pt", "en"]),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem.",
  path: ["confirmPassword"],
});

const loginSchema = z.object({
  email: z.string().email({
    message: "Por favor, insira um email válido.",
  }),
  password: z.string().min(1, {
    message: "Por favor, insira sua senha.",
  }),
  role: z.enum(["technician", "admin"]),
});

type RegisterFormValues = z.infer<typeof registerSchema>;
type LoginFormValues = z.infer<typeof loginSchema>;

interface AuthFormProps {
  mode: "login" | "register";
  onSuccess?: () => void;
  onToggleMode?: () => void;
  selectedPlan?: string | null;
}

export function AuthForm({ mode, onSuccess, onToggleMode, selectedPlan }: AuthFormProps) {
  const { t, language } = useLanguage();
  const { loginMutation, registerMutation } = useAuth();
  const [error, setError] = useState<string | null>(null);

  // Formulário de registro
  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      role: "technician",
      language: language === "pt" ? "pt" : "en", // Usar idioma atual como padrão
    },
  });

  // Formulário de login
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      role: "technician",
    },
  });

  // Lidar com o envio do formulário de registro
  const onRegisterSubmit = (values: RegisterFormValues) => {
    setError(null);
    
    // Adicionar o plano selecionado se existir
    const registrationData = {
      ...values,
      stripeSubscriptionPlan: selectedPlan || undefined
    };
    
    registerMutation.mutate(registrationData, {
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

      {mode === "register" ? (
        // Formulário de Registro
        <Form {...registerForm}>
          <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
            <FormField
              control={registerForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("auth.emailLabel")}</FormLabel>
                  <FormControl>
                    <Input placeholder="seu@email.com" {...field} />
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
                  <FormLabel>{t("auth.passwordLabel")}</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="********" {...field} />
                  </FormControl>
                  <FormDescription className="text-xs">
                    {t("auth.passwordRequirements")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={registerForm.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("auth.confirmPasswordLabel")}</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="********" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={registerForm.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("auth.roleLabel")}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("auth.selectRole")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="technician">{t("auth.roleTechnician")}</SelectItem>
                      <SelectItem value="admin">{t("auth.roleAdmin")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={registerForm.control}
              name="language"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("auth.languageLabel")}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("auth.selectLanguage")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pt">🇧🇷 Português</SelectItem>
                      <SelectItem value="en">🇺🇸 English</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button
              type="submit"
              className="w-full bg-purple-600 hover:bg-purple-700"
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("auth.registering")}
                </>
              ) : (
                t("auth.register")
              )}
            </Button>
          </form>
        </Form>
      ) : (
        // Formulário de Login
        <Form {...loginForm}>
          <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
            <FormField
              control={loginForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("auth.emailLabel")}</FormLabel>
                  <FormControl>
                    <Input placeholder="seu@email.com" {...field} />
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
                  <FormLabel>{t("auth.passwordLabel")}</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="********" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={loginForm.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("auth.roleLabel")}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("auth.selectRole")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="technician">{t("auth.roleTechnician")}</SelectItem>
                      <SelectItem value="admin">{t("auth.roleAdmin")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button
              type="submit"
              className="w-full bg-purple-600 hover:bg-purple-700"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("auth.loggingIn")}
                </>
              ) : (
                t("auth.login")
              )}
            </Button>
          </form>
        </Form>
      )}

      <div className="text-center mt-6">
        {mode === "register" ? (
          <p className="text-sm text-gray-400">
            {t("auth.alreadyHaveAccount")}{" "}
            <button
              type="button"
              onClick={onToggleMode}
              className="text-purple-500 hover:underline"
            >
              {t("auth.login")}
            </button>
          </p>
        ) : (
          <p className="text-sm text-gray-400">
            {t("auth.dontHaveAccount")}{" "}
            <button
              type="button"
              onClick={onToggleMode}
              className="text-purple-500 hover:underline"
            >
              {t("auth.register")}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}