import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Shield, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/hooks/use-language";

type TwoFactorSettingsProps = {
  user: {
    id: number;
    email: string;
    twofa_enabled: boolean;
    role: string;
  };
};

export function TwoFactorSettings({ user }: TwoFactorSettingsProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [setupStep, setSetupStep] = useState<"initial" | "setup" | "verify">("initial");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);

  const formSchema = z.object({
    token: z.string().length(6, {
      message: t("errors.invalidToken", "Código inválido. Digite 6 dígitos")
    }),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      token: "",
    },
  });

  const setupTwoFactorMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/setup-2fa");
      const data = await response.json();
      return data;
    },
    onSuccess: (data) => {
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setSetupStep("setup");
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error", "Erro"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const verifyAndEnableMutation = useMutation({
    mutationFn: async (token: string) => {
      const response = await apiRequest("POST", "/api/enable-2fa", { token });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: t("common.success", "Sucesso"),
        description: t("profile.twoFactorEnabled", "Autenticação de dois fatores ativada com sucesso"),
      });
      setSetupStep("initial");
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error", "Erro"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const disableTwoFactorMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/disable-2fa");
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: t("common.success", "Sucesso"),
        description: t("profile.twoFactorDisabled", "Autenticação de dois fatores desativada com sucesso"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error", "Erro"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    verifyAndEnableMutation.mutate(values.token);
  };

  const onSetup = () => {
    setupTwoFactorMutation.mutate();
  };

  const onDisable = () => {
    if (confirm(t("profile.confirmDisable2FA", "Tem certeza que deseja desativar a autenticação de dois fatores? Isso reduzirá a segurança da sua conta."))) {
      disableTwoFactorMutation.mutate();
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl flex items-center">
          <Shield className="mr-2 h-5 w-5" />
          {t("profile.twoFactorAuth", "Autenticação de Dois Fatores")}
        </CardTitle>
        <CardDescription>
          {t("profile.twoFactorDescription", "Aumente a segurança da sua conta exigindo uma etapa de verificação adicional ao fazer login.")}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {user.twofa_enabled ? (
          <Alert className="bg-green-50 border-green-200">
            <ShieldCheck className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">{t("profile.twoFactorEnabled", "Autenticação de dois fatores está ativada")}</AlertTitle>
            <AlertDescription className="text-green-700">
              {t("profile.twoFactorEnabledDesc", "Sua conta está protegida com autenticação de dois fatores. Você precisará de um código do aplicativo autenticador ao fazer login.")}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="bg-amber-50 border-amber-200">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">{t("profile.twoFactorDisabled", "Autenticação de dois fatores está desativada")}</AlertTitle>
            <AlertDescription className="text-amber-700">
              {t("profile.twoFactorDisabledDesc", "Recomendamos ativar a autenticação de dois fatores para aumentar a segurança da sua conta.")}
            </AlertDescription>
          </Alert>
        )}

        {setupStep === "setup" && qrCode && (
          <div className="mt-6 space-y-4">
            <h3 className="font-medium">{t("profile.scanQrCode", "Escaneie o QR Code")}</h3>
            <div className="flex justify-center">
              <div className="border p-4 inline-block bg-white">
                <img 
                  src={qrCode} 
                  alt="QR Code para 2FA" 
                  width={200} 
                  height={200} 
                />
              </div>
            </div>
            <div className="mt-4">
              <h4 className="font-medium">{t("profile.manualEntry", "Entrada manual")}</h4>
              <p className="text-sm text-muted-foreground mb-2">
                {t("profile.manualEntryDesc", "Se não conseguir escanear o código QR, você pode inserir este código manualmente no seu aplicativo.")}
              </p>
              <div className="flex items-center">
                <code className="bg-muted p-2 rounded text-xs flex-1 break-all">
                  {secret}
                </code>
              </div>
            </div>
            <Button 
              className="w-full mt-4" 
              onClick={() => setSetupStep("verify")}
            >
              {t("common.continue", "Continuar")}
            </Button>
          </div>
        )}

        {setupStep === "verify" && (
          <div className="mt-6">
            <h3 className="font-medium mb-4">{t("profile.verifyCode", "Verificar código")}</h3>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="token"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("profile.enterCode", "Digite o código")}</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="000000" 
                          {...field} 
                          maxLength={6}
                        />
                      </FormControl>
                      <FormDescription>
                        {t("profile.enterCodeFromApp", "Digite o código de 6 dígitos do seu aplicativo autenticador")}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setSetupStep("initial")}
                  >
                    {t("common.cancel", "Cancelar")}
                  </Button>
                  <Button 
                    type="submit"
                    disabled={verifyAndEnableMutation.isPending}
                  >
                    {verifyAndEnableMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {t("common.verify", "Verificar")}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between pt-3">
        {user.twofa_enabled ? (
          <Button 
            variant="destructive" 
            onClick={onDisable}
            disabled={disableTwoFactorMutation.isPending}
            className="w-full"
          >
            {disableTwoFactorMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            <ShieldX className="mr-2 h-4 w-4" />
            {t("profile.disable2FA", "Desativar autenticação de dois fatores")}
          </Button>
        ) : (
          setupStep === "initial" && (
            <Button 
              onClick={onSetup}
              disabled={setupTwoFactorMutation.isPending}
              className="w-full"
            >
              {setupTwoFactorMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              <ShieldCheck className="mr-2 h-4 w-4" />
              {t("profile.enable2FA", "Ativar autenticação de dois fatores")}
            </Button>
          )
        )}
      </CardFooter>
    </Card>
  );
}