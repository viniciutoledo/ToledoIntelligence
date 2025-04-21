import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { LanguageToggle } from "@/components/language-toggle";
import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm } from "@/components/auth/register-form";
import { TwoFactorForm } from "@/components/auth/two-factor-form";
import { BlockedAccount } from "@/components/auth/blocked-account";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Redirect } from "wouter";

export default function AuthPage() {
  const { user, twoFactorState } = useAuth();
  const { t } = useLanguage();
  const [activeRole, setActiveRole] = useState<"technician" | "admin">("technician");
  const [showBlockedAccount, setShowBlockedAccount] = useState(false);

  // Redirect to the appropriate page if the user is already logged in
  if (user) {
    return <Redirect to={user.role === "admin" ? "/admin" : "/technician"} />;
  }

  // Show the two-factor form if there's an active two-factor challenge
  if (twoFactorState && !showBlockedAccount) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-neutral-50">
        <LanguageToggle className="fixed top-4 right-4 z-50" />
        <Card className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-lg">
          <TwoFactorForm />
        </Card>
      </div>
    );
  }

  // Show the blocked account screen
  if (showBlockedAccount) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-neutral-50">
        <LanguageToggle className="fixed top-4 right-4 z-50" />
        <Card className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-lg">
          <BlockedAccount onBackToLogin={() => setShowBlockedAccount(false)} />
        </Card>
      </div>
    );
  }

  // Main login/register screen
  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-neutral-50">
      <LanguageToggle className="fixed top-4 right-4 z-50" />
      <Card className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-lg">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-neutral-800">
            <span className="text-primary-600">Toledo</span>
            <span className="text-accent-500">IA</span>
          </h2>
          <p className="mt-2 text-sm text-neutral-600">
            {t("auth.loginSubtitle")}
          </p>
        </div>

        <Tabs defaultValue="login">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">{t("common.login")}</TabsTrigger>
            <TabsTrigger value="register">{t("common.register")}</TabsTrigger>
          </TabsList>
          <TabsContent value="login" className="mt-6">
            <LoginForm
              activeRole={activeRole}
              setActiveRole={setActiveRole}
              onSuccess={() => {
                // If account is blocked, show the blocked account screen
                if (twoFactorState?.twoFactorType === "blocked") {
                  setShowBlockedAccount(true);
                }
              }}
            />
          </TabsContent>
          <TabsContent value="register" className="mt-6">
            <RegisterForm onSuccess={() => {}} />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
