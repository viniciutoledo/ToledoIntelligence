import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { AuthRedirect } from "@/components/auth";

// Cores do tema
const colors = {
  primary: "#ff00c7", // Rosa vibrante
  secondary: "#00c2ff", // Azul ciano
  dark: "#0a0a0a", // Quase preto para fundo
  darkGray: "#1a1a1a", // Cinza escuro para cartões
  lightText: "#f8f8f8", // Texto claro
};

export default function CheckoutSuccessPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Se o usuário não estiver autenticado, o componente AuthRedirect
  // redirecionará automaticamente para a página inicial
  if (!user) {
    return (
      <AuthRedirect>
        <div className="min-h-screen flex items-center justify-center">
          <p>Redirecionando...</p>
        </div>
      </AuthRedirect>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ backgroundColor: colors.dark, color: colors.lightText }}
    >
      <div className="max-w-md w-full bg-gray-800 p-8 rounded-lg text-center">
        <div
          className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "rgba(34, 197, 94, 0.2)" }}
        >
          <Check className="h-10 w-10 text-green-500" />
        </div>
        
        <h1 className="text-2xl font-bold mb-4">
          {t("checkoutSuccess.thankYou")}
        </h1>
        
        <p className="text-gray-400 mb-6">
          {t("checkoutSuccess.subscriptionActive")}
        </p>
        
        <div className="space-y-4">
          <Button
            className="w-full"
            style={{ backgroundColor: colors.primary }}
            onClick={() => setLocation("/dashboard")}
          >
            {t("common.dashboard")}
          </Button>
          
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setLocation("/")}
          >
            {t("common.backToHome")}
          </Button>
        </div>
      </div>
    </div>
  );
}