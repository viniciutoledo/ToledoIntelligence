import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TwoFactorSettings } from "@/components/profile/two-factor-settings";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, UserCircle, Shield, Globe, Bell } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function ProfilePage() {
  const { user, logoutMutation, changeLanguageMutation } = useAuth();
  const { t, i18n } = useLanguage();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("account");
  
  // Redirecionar para login se não estiver autenticado
  useEffect(() => {
    if (!user) {
      setLocation("/auth");
    }
  }, [user, setLocation]);
  
  // Formulário para alterar senha
  const passwordFormSchema = z.object({
    currentPassword: z.string().min(6, {
      message: t("errors.minLength", "Deve ter pelo menos 6 caracteres")
    }),
    newPassword: z.string().min(6, {
      message: t("errors.minLength", "Deve ter pelo menos 6 caracteres")
    }),
    confirmPassword: z.string().min(6, {
      message: t("errors.minLength", "Deve ter pelo menos 6 caracteres")
    }),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: t("errors.passwordMismatch", "As senhas não coincidem")
  });

  const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: z.infer<typeof passwordFormSchema>) => {
      const res = await apiRequest("POST", "/api/user/change-password", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: t("common.success", "Sucesso"),
        description: t("profile.passwordChanged", "Senha alterada com sucesso"),
      });
      passwordForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error", "Erro"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onPasswordFormSubmit = (data: z.infer<typeof passwordFormSchema>) => {
    changePasswordMutation.mutate(data);
  };

  // Se o usuário não estiver autenticado, não renderize nada (ou mostre um loader)
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex items-center mb-8">
        <h1 className="text-3xl font-bold">{t("profile.title", "Meu Perfil")}</h1>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="account" className="flex items-center">
            <UserCircle className="mr-2 h-4 w-4" />
            {t("profile.account", "Conta")}
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center">
            <Shield className="mr-2 h-4 w-4" />
            {t("profile.security", "Segurança")}
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex items-center">
            <Globe className="mr-2 h-4 w-4" />
            {t("profile.preferences", "Preferências")}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("profile.accountInfo", "Informações da Conta")}</CardTitle>
              <CardDescription>
                {t("profile.accountInfoDesc", "Veja e gerencie suas informações de conta")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="flex flex-col space-y-1.5">
                  <h3 className="text-sm font-medium leading-none">
                    {t("profile.email", "Email")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {user.email}
                  </p>
                </div>
                <div className="flex flex-col space-y-1.5">
                  <h3 className="text-sm font-medium leading-none">
                    {t("profile.role", "Função")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {user.role === "admin" 
                      ? t("profile.admin", "Administrador") 
                      : t("profile.technician", "Técnico")}
                  </p>
                </div>
                <div className="flex flex-col space-y-1.5">
                  <h3 className="text-sm font-medium leading-none">
                    {t("profile.subscription", "Assinatura")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {user.subscription_tier === "none" 
                      ? t("profile.noSubscription", "Sem assinatura") 
                      : user.subscription_tier === "basic" 
                        ? t("profile.basicSubscription", "Plano Básico") 
                        : t("profile.intermediateSubscription", "Plano Intermediário")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="security" className="space-y-6">
          <TwoFactorSettings user={user} />
          
          <Card>
            <CardHeader>
              <CardTitle>{t("profile.changePassword", "Alterar Senha")}</CardTitle>
              <CardDescription>
                {t("profile.changePasswordDesc", "Atualize sua senha de acesso")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit(onPasswordFormSubmit)} className="space-y-4">
                  <FormField
                    control={passwordForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("profile.currentPassword", "Senha Atual")}</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={passwordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("profile.newPassword", "Nova Senha")}</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("profile.confirmPassword", "Confirmar Nova Senha")}</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    type="submit"
                    disabled={changePasswordMutation.isPending}
                  >
                    {changePasswordMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {t("common.save", "Salvar")}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("profile.language", "Idioma")}</CardTitle>
              <CardDescription>
                {t("profile.languageDesc", "Altere o idioma da interface")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col space-y-4">
                <div className="flex space-x-4">
                  <Button
                    variant={i18n.language === "pt" ? "default" : "outline"}
                    onClick={() => changeLanguageMutation.mutate("pt")}
                    disabled={changeLanguageMutation.isPending || i18n.language === "pt"}
                  >
                    {changeLanguageMutation.isPending && i18n.language !== "pt" && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Português
                  </Button>
                  <Button
                    variant={i18n.language === "en" ? "default" : "outline"}
                    onClick={() => changeLanguageMutation.mutate("en")}
                    disabled={changeLanguageMutation.isPending || i18n.language === "en"}
                  >
                    {changeLanguageMutation.isPending && i18n.language !== "en" && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    English
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}