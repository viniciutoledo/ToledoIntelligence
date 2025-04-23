import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AuthForm } from "@/components/auth";
import { useAuth } from "@/hooks/use-auth";
import { PlanPriceDisplay } from "@/components/plan/plan-price-display";

// Cores do tema
const colors = {
  primary: "#ff00c7", // Rosa vibrante
  secondary: "#00c2ff", // Azul ciano
  dark: "#0a0a0a", // Quase preto para fundo
  darkGray: "#1a1a1a", // Cinza escuro para cartões
  lightText: "#f8f8f8", // Texto claro
};

export default function LandingPage() {
  const { t, setLanguage, language } = useLanguage();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  
  // Redirecionar usuário já autenticado para a página apropriada
  useEffect(() => {
    if (user) {
      // Se for admin, vai para o painel admin
      if (user.role === "admin") {
        setLocation("/admin");
      } 
      // Se for técnico, vai para a página do técnico
      else if (user.role === "technician") {
        setLocation("/technician");
      }
    }
  }, [user, setLocation]);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  // Planos disponíveis
  const plans = [
    {
      id: import.meta.env.VITE_STRIPE_PRICE_ID_BASIC || "price_basic",
      name: "Plano Básico",
      price: "R$29,90",
      features: [
        "2.500 interações por mês",
        "Upload de imagens e documentos",
        "Suporte por email",
        "Análise técnica de circuitos"
      ],
      popular: false,
    },
    {
      id: import.meta.env.VITE_STRIPE_PRICE_ID_INTERMEDIATE || "price_intermediate",
      name: "Plano Intermediário",
      price: "R$39,90",
      features: [
        "5.000 interações por mês",
        "Upload de imagens e documentos",
        "Suporte prioritário",
        "Análise técnica avançada",
        "Exportação de relatórios"
      ],
      popular: true,
    }
  ];

  // Este efeito foi removido porque já temos um efeito de redirecionamento acima

  // Manipular o sucesso da autenticação
  const handleAuthSuccess = () => {
    setShowAuthForm(false);
    if (selectedPlan) {
      // Redirecionar para a página de checkout com o plano selecionado
      setLocation(`/checkout?plan=${selectedPlan}`);
    } else {
      // Redirecionar para o dashboard
      setLocation("/dashboard");
    }
  };

  // Manipular seleção de plano
  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId);
    setShowAuthForm(true);
    setAuthMode("register");
  };

  // Alternar idioma
  const toggleLanguage = () => {
    setLanguage(language === "pt" ? "en" : "pt");
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: colors.dark, color: colors.lightText }}
    >
      {/* Cabeçalho */}
      <header className="py-4 px-6 border-b border-gray-800">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 text-white font-bold text-xl">
              T
            </div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500">
              ToledoIA
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Alternador de Idioma */}
            <button
              onClick={toggleLanguage}
              className="flex items-center justify-center p-2 rounded-full hover:bg-gray-800 transition-colors"
              aria-label={t("common.switchLanguage")}
            >
              {language === "pt" ? (
                <span className="flex items-center">
                  🇧🇷
                  <span className="ml-2 text-sm hidden sm:inline">PT</span>
                </span>
              ) : (
                <span className="flex items-center">
                  🇺🇸
                  <span className="ml-2 text-sm hidden sm:inline">EN</span>
                </span>
              )}
            </button>

            {/* Botões de autenticação */}
            <div className="flex items-center gap-2">
              <Button
                className="text-white bg-gray-700 hover:bg-gray-600 border-2 border-gray-600 transform transition-all duration-200 hover:scale-105"
                onClick={() => {
                  setShowAuthForm(true);
                  setAuthMode("login");
                }}
              >
                Entrar
              </Button>
              <Button
                className="bg-pink-600 hover:bg-pink-500 transform transition-all duration-200 hover:scale-105 font-medium"
                onClick={() => {
                  setShowAuthForm(true);
                  setAuthMode("register");
                }}
              >
                Cadastrar
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero section */}
      <section className="py-20 px-6 text-center">
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500">
            {t("landing.heroTitle")}
          </h1>
          <p className="text-xl text-gray-400 mb-8 md:px-10">
            {t("landing.heroSubtitle")}
          </p>
          <Button
            size="lg"
            className="text-lg px-8 py-6 bg-pink-600 hover:bg-pink-500 shadow-lg hover:shadow-xl transform transition-all duration-300 hover:scale-105 font-bold"
            onClick={() => {
              setShowAuthForm(true);
              setAuthMode("register");
            }}
          >
            Começar Agora
          </Button>
        </div>
      </section>

      {/* Seção de funcionalidades */}
      <section className="py-16 px-6 bg-black/30">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            {t("landing.featuresTitle")}
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-6 bg-gray-900 rounded-lg text-center">
              <div
                className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "rgba(255, 0, 199, 0.2)" }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke={colors.primary}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-2">
                {t("landing.featureOneTitle")}
              </h3>
              <p className="text-gray-400">
                {t("landing.featureOneDescription")}
              </p>
            </div>

            <div className="p-6 bg-gray-900 rounded-lg text-center">
              <div
                className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "rgba(0, 194, 255, 0.2)" }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke={colors.secondary}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-2">
                {t("landing.featureTwoTitle")}
              </h3>
              <p className="text-gray-400">
                {t("landing.featureTwoDescription")}
              </p>
            </div>

            <div className="p-6 bg-gray-900 rounded-lg text-center">
              <div
                className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "rgba(139, 92, 246, 0.2)" }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="#8b5cf6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-2">
                {t("landing.featureThreeTitle")}
              </h3>
              <p className="text-gray-400">
                {t("landing.featureThreeDescription")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Planos de assinatura */}
      <section className="py-16 px-6">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4 text-white">
            Escolha o plano que melhor atende às suas necessidades
          </h2>
          <p className="text-center text-white text-lg max-w-2xl mx-auto mb-12">
            Todos os planos incluem acesso completo à análise de placas com IA
          </p>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className="border-0 relative overflow-hidden shadow-xl transition-all duration-300 hover:shadow-2xl hover:translate-y-[-5px]"
                style={{ 
                  backgroundColor: plan.popular ? "rgba(45, 45, 45, 0.95)" : "rgba(40, 40, 40, 0.95)",
                  borderLeft: plan.popular ? `4px solid ${colors.primary}` : "2px solid #333",
                  borderRadius: "8px"
                }}
              >
                {plan.popular && (
                  <div
                    className="absolute top-0 right-0 bg-gradient-to-r from-pink-500 to-purple-500 text-white px-4 py-1 text-sm font-bold"
                    style={{ transform: "translateY(0) translateX(0)" }}
                  >
                    Mais Popular
                  </div>
                )}
                <div className="p-6">
                  <h3 className="text-2xl font-bold mb-2 text-white">{plan.name}</h3>
                  <div className="flex items-baseline mb-4">
                    <span className="text-4xl font-bold text-white">
                      {plan.id.includes("basic") ? 
                        <PlanPriceDisplay tier="basic" /> : 
                        <PlanPriceDisplay tier="intermediate" />
                      }
                    </span>
                    <span className="text-white ml-2 opacity-70">/{t("common.month")}</span>
                  </div>
                  <ul className="space-y-4 mb-6">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center group">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 mr-3 text-green-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span className="text-white text-base font-medium group-hover:text-green-300 transition-colors duration-200">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={`w-full transform transition-all duration-200 hover:scale-105 hover:shadow-lg font-medium ${plan.popular ? 'bg-pink-600 hover:bg-pink-500' : 'bg-gray-700 hover:bg-gray-600'}`}
                    onClick={() => handleSelectPlan(plan.id)}
                  >
                    Selecionar Plano
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Rodapé */}
      <footer className="py-8 px-6 border-t border-gray-800 mt-auto">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <p className="text-gray-500">
                &copy; {new Date().getFullYear()} ToledoIA. Todos os direitos reservados ao Prof. Vinícius Toledo
              </p>
            </div>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-500 hover:text-white">
                Termos de Serviço
              </a>
              <a href="#" className="text-gray-500 hover:text-white">
                Política de Privacidade
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Modal de Login/Registro */}
      {showAuthForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-75 p-4">
          <div 
            className="bg-gray-900 rounded-lg shadow-xl max-w-md w-full p-6 relative"
            style={{ borderTop: `4px solid ${colors.primary}` }}
          >
            <button
              onClick={() => setShowAuthForm(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <h3 className="text-2xl font-bold mb-6 text-center">
              {authMode === "login" ? "Entrar" : "Cadastrar"}
            </h3>
            <AuthForm
              mode={authMode}
              onSuccess={handleAuthSuccess}
              onToggleMode={() => 
                setAuthMode(authMode === "login" ? "register" : "login")
              }
              selectedPlan={selectedPlan}
            />
          </div>
        </div>
      )}
    </div>
  );
}