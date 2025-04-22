import { useState, useRef, useEffect } from "react";
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
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { 
  InputOTP,
  InputOTPGroup,
  InputOTPSlot
} from "@/components/ui/input-otp";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

export function TwoFactorForm() {
  const { twoFactorState, verifyTwoFactorMutation } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<"email" | "app">(
    twoFactorState?.twoFactorType || "email"
  );

  // Form schema for OTP
  const otpFormSchema = z.object({
    otp: z.string().min(6, t("errors.validation")).max(6, t("errors.validation")),
  });

  const otpForm = useForm<z.infer<typeof otpFormSchema>>({
    resolver: zodResolver(otpFormSchema),
    defaultValues: {
      otp: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof otpFormSchema>) => {
    if (!twoFactorState) return;
    
    try {
      await verifyTwoFactorMutation.mutateAsync({
        userId: twoFactorState.userId,
        token: values.otp,
        type: activeTab,
      });
    } catch (error) {
      console.error("2FA verification error:", error);
    }
  };

  // Reset form when tab changes
  useEffect(() => {
    otpForm.reset({ otp: "" });
  }, [activeTab, otpForm]);

  if (!twoFactorState) return null;

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-neutral-800">
          {t("auth.twoFactorTitle")}
        </h2>
        <p className="mt-2 text-sm text-neutral-600">
          {t("auth.twoFactorSubtitle")}
        </p>
      </div>

      <Tabs 
        defaultValue={activeTab} 
        onValueChange={(value) => setActiveTab(value as "email" | "app")}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="email">{t("auth.emailCode")}</TabsTrigger>
          <TabsTrigger value="app">{t("auth.authApp")}</TabsTrigger>
        </TabsList>
        
        <TabsContent value="email" className="mt-4">
          <p className="text-sm text-neutral-600 mb-4">
            {t("auth.emailCodeSent")}{" "}
            <span className="font-medium">
              {twoFactorState.emailHint}
            </span>
          </p>
          
          <Form {...otpForm}>
            <form onSubmit={otpForm.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={otpForm.control}
                name="otp"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <InputOTP maxLength={6} {...field}>
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="text-center text-sm text-neutral-500 mb-4">
                <span>{t("auth.didntReceiveCode")}</span>
                <Button 
                  variant="link" 
                  type="button" 
                  className="text-primary-600 font-medium ml-1"
                  onClick={() => handleResendCode()}
                  disabled={resendMutation.isPending}
                >
                  {resendMutation.isPending ? (
                    <Loader2 className="mr-2 h-3 w-3 inline animate-spin" />
                  ) : null}
                  {t("auth.resend")}
                </Button>
              </div>
              
              <Button 
                type="submit" 
                className="w-full"
                disabled={verifyTwoFactorMutation.isPending}
              >
                {verifyTwoFactorMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("common.verify")}
              </Button>
            </form>
          </Form>
        </TabsContent>
        
        <TabsContent value="app" className="mt-4">
          <p className="text-sm text-neutral-600 mb-4">
            {t("auth.enterAuthCode")}
          </p>
          
          <Form {...otpForm}>
            <form onSubmit={otpForm.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={otpForm.control}
                name="otp"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        placeholder="000000"
                        maxLength={6}
                        className="text-center text-lg"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button 
                type="submit" 
                className="w-full"
                disabled={verifyTwoFactorMutation.isPending}
              >
                {verifyTwoFactorMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t("common.verify")}
              </Button>
            </form>
          </Form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
