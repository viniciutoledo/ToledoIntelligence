import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/use-language";
import { loadStripe } from "@stripe/stripe-js";
import { Check, ArrowRight, HelpCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { AuthForm } from "@/components/auth/auth-form";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Cores do tema
const colors = {
  primary: "#ff00c7", // Rosa vibrante
  secondary: "#00c2ff", // Azul ciano
  dark: "#0a0a0a", // Quase preto para fundo
  darkGray: "#1a1a1a", // Cinza escuro para cartões
  lightText: "#f8f8f8", // Texto claro
};

// Assegure-se de que a chave pública do Stripe esteja definida
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error("VITE_STRIPE_PUBLIC_KEY não está definida");
}

// Carregue o Stripe fora do componente
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

// Componente do Plano
type PlanProps = {
  title: string;
  price: string;
  description: string;
  features: string[];
  recommended?: boolean;
  priceId: string;
  onSelectPlan: (priceId: string) => void;
  buttonText: string;
};

const Plan = ({
  title,
  price,
  description,
  features,
  recommended = false,
  priceId,
  onSelectPlan,
  buttonText,
}: PlanProps) => {
  const { t } = useLanguage();
  
  return (
    <div
      className={`rounded-lg p-6 transition-transform duration-300 hover:scale-105 ${
        recommended
          ? "border-2 border-primary bg-gradient-to-br from-gray-900 to-gray-800 shadow-lg"
          : "border border-gray-800 bg-gray-900"
      }`}
      style={{
        backgroundColor: colors.darkGray,
        borderColor: recommended ? colors.primary : "transparent",
      }}
    >
      {recommended && (
        <div
          className="absolute -top-3 left-1/2 transform -translate-x-1/2 rounded-full px-4 py-1 text-xs font-bold"
          style={{ backgroundColor: colors.primary, color: colors.lightText }}
        >
          {t("landing.recommended")}
        </div>
      )}
      <div className="relative">
        <h3 className="text-xl font-bold mb-2 text-white">{title}</h3>
        <div className="flex items-end mb-4">
          <span className="text-3xl font-bold" style={{ color: colors.primary }}>
            {price}
          </span>
          <span className="text-gray-400 ml-1 mb-1">/{t("landing.month")}</span>
        </div>
        <p className="text-gray-400 mb-6">{description}</p>
        <ul className="space-y-3 mb-6">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start">
              <Check className="h-5 w-5 mr-2 text-green-500 shrink-0 mt-0.5" />
              <span className="text-sm text-gray-300">{feature}</span>
            </li>
          ))}
        </ul>
        <Button
          className="w-full mt-2"
          style={{
            backgroundColor: recommended ? colors.primary : "transparent",
            color: recommended ? colors.lightText : colors.primary,
            borderColor: colors.primary,
            borderWidth: "1px",
          }}
          onClick={() => onSelectPlan(priceId)}
        >
          {buttonText} <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default function LandingPage() {
  const { t, language, setLanguage } = useLanguage();
  const [, setLocation] = useLocation();
  const { user, registerMutation, loginMutation } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("register");

  // Funções para alternar o idioma
  const toggleLanguage = () => {
    setLanguage(language === "pt" ? "en" : "pt");
  };

  // Manipulador para seleção de plano
  const handleSelectPlan = (priceId: string) => {
    setSelectedPlan(priceId);
    
    if (user) {
      // Se o usuário já estiver logado, redirecionar para a página de checkout
      setLocation(`/checkout?plan=${priceId}`);
    } else {
      // Mostrar o formulário de autenticação
      setShowAuthForm(true);
      setAuthMode("register"); // Definir para registro como padrão
    }
  };

  // Após autenticação com sucesso
  const handleAuthSuccess = () => {
    if (selectedPlan) {
      setLocation(`/checkout?plan=${selectedPlan}`);
    } else {
      setLocation("/dashboard");
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: colors.dark, color: colors.lightText }}
    >
      {/* Header */}
      <header className="border-b border-gray-800 py-4">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold" style={{ color: colors.primary }}>
              ToledoIA
            </h1>
            <span className="ml-2 px-2 py-1 text-xs rounded-full bg-gray-800">
              BETA
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleLanguage}
              className="flex items-center text-sm bg-transparent border border-gray-700 rounded-md px-3 py-1 hover:border-gray-500 transition-colors"
            >
              {language === "pt" ? "🇧🇷 PT" : "🇺🇸 EN"}
            </button>
            
            {user ? (
              <Link to="/dashboard">
                <Button variant="outline">{t("common.dashboard")}</Button>
              </Link>
            ) : (
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAuthForm(true);
                    setAuthMode("login");
                  }}
                >
                  {t("auth.login")}
                </Button>
                <Button
                  style={{ backgroundColor: colors.primary }}
                  onClick={() => {
                    setShowAuthForm(true);
                    setAuthMode("register");
                  }}
                >
                  {t("auth.register")}
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 text-center">
          <h1
            className="text-4xl md:text-6xl font-bold mb-6"
            style={{ color: colors.lightText }}
          >
            {t("landing.heroTitle")}
          </h1>
          <p className="text-xl md:text-2xl mb-10 max-w-3xl mx-auto text-gray-400">
            {t("landing.heroSubtitle")}
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <Button
              size="lg"
              style={{ backgroundColor: colors.primary }}
              className="font-bold"
              onClick={() => {
                if (user) {
                  setLocation("/dashboard");
                } else {
                  setShowAuthForm(true);
                  setAuthMode("register");
                }
              }}
            >
              {t("landing.startFree")}
            </Button>
            <Button size="lg" variant="outline">
              {t("landing.learnMore")}
            </Button>
          </div>
          <div className="mt-12 relative max-w-4xl mx-auto">
            <div
              className="rounded-lg shadow-2xl overflow-hidden border-4"
              style={{ borderColor: colors.secondary }}
            >
              <img
                src="/assets/dashboard-preview.png"
                alt="ToledoIA Dashboard"
                className="w-full h-auto"
                style={{ opacity: 0.9 }}
              />
            </div>
            <div
              className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-full text-lg font-bold"
              style={{ backgroundColor: colors.primary, color: colors.lightText }}
            >
              {t("landing.aiPowered")}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-gray-900">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            {t("landing.featuresTitle")}
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-800 p-6 rounded-lg">
              <div
                className="rounded-full w-12 h-12 flex items-center justify-center mb-4"
                style={{ backgroundColor: colors.primary }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">
                {t("landing.feature1Title")}
              </h3>
              <p className="text-gray-400">
                {t("landing.feature1Desc")}
              </p>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg">
              <div
                className="rounded-full w-12 h-12 flex items-center justify-center mb-4"
                style={{ backgroundColor: colors.secondary }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">
                {t("landing.feature2Title")}
              </h3>
              <p className="text-gray-400">
                {t("landing.feature2Desc")}
              </p>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg">
              <div
                className="rounded-full w-12 h-12 flex items-center justify-center mb-4"
                style={{ backgroundColor: colors.primary }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">
                {t("landing.feature3Title")}
              </h3>
              <p className="text-gray-400">
                {t("landing.feature3Desc")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-16" id="pricing">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">
            {t("landing.pricingTitle")}
          </h2>
          <p className="text-center text-gray-400 mb-12 max-w-2xl mx-auto">
            {t("landing.pricingSubtitle")}
          </p>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Plano Básico */}
            <Plan
              title={t("landing.basicTitle")}
              price="R$29,90"
              description={t("landing.basicDesc")}
              features={[
                t("landing.basicFeature1"),
                t("landing.basicFeature2"),
                t("landing.basicFeature3"),
                t("landing.basicFeature4"),
              ]}
              priceId={process.env.STRIPE_PRICE_ID_BASIC || ""}
              onSelectPlan={handleSelectPlan}
              buttonText={t("landing.selectPlan")}
            />
            
            {/* Plano Intermediário */}
            <Plan
              title={t("landing.intermediateTitle")}
              price="R$39,90"
              description={t("landing.intermediateDesc")}
              features={[
                t("landing.intermediateFeature1"),
                t("landing.intermediateFeature2"),
                t("landing.intermediateFeature3"),
                t("landing.intermediateFeature4"),
                t("landing.intermediateFeature5"),
              ]}
              recommended={true}
              priceId={process.env.STRIPE_PRICE_ID_INTERMEDIATE || ""}
              onSelectPlan={handleSelectPlan}
              buttonText={t("landing.selectPlan")}
            />
          </div>
          
          <div className="mt-12 text-center">
            <p className="text-gray-400">
              {t("landing.questionContact")}{" "}
              <a
                href="mailto:contato@toledoia.com.br"
                className="text-primary hover:underline"
                style={{ color: colors.primary }}
              >
                contato@toledoia.com.br
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-gray-900">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            {t("landing.faqTitle")}
          </h2>
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-2">
                {t("landing.faq1Title")}
              </h3>
              <p className="text-gray-400">
                {t("landing.faq1Answer")}
              </p>
            </div>
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-2">
                {t("landing.faq2Title")}
              </h3>
              <p className="text-gray-400">
                {t("landing.faq2Answer")}
              </p>
            </div>
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-2">
                {t("landing.faq3Title")}
              </h3>
              <p className="text-gray-400">
                {t("landing.faq3Answer")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-gray-800">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between">
            <div className="mb-8 md:mb-0">
              <h3 className="text-xl font-bold mb-4" style={{ color: colors.primary }}>
                ToledoIA
              </h3>
              <p className="text-gray-400 max-w-md">
                {t("landing.footerDesc")}
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
              <div>
                <h4 className="text-lg font-semibold mb-4">
                  {t("landing.productTitle")}
                </h4>
                <ul className="space-y-2">
                  <li>
                    <a href="#" className="text-gray-400 hover:text-white">
                      {t("landing.features")}
                    </a>
                  </li>
                  <li>
                    <a href="#pricing" className="text-gray-400 hover:text-white">
                      {t("landing.pricing")}
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-gray-400 hover:text-white">
                      {t("landing.faq")}
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="text-lg font-semibold mb-4">
                  {t("landing.companyTitle")}
                </h4>
                <ul className="space-y-2">
                  <li>
                    <a href="#" className="text-gray-400 hover:text-white">
                      {t("landing.about")}
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-gray-400 hover:text-white">
                      {t("landing.contact")}
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-gray-400 hover:text-white">
                      {t("landing.blog")}
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="text-lg font-semibold mb-4">
                  {t("landing.legalTitle")}
                </h4>
                <ul className="space-y-2">
                  <li>
                    <a href="#" className="text-gray-400 hover:text-white">
                      {t("landing.privacyPolicy")}
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-gray-400 hover:text-white">
                      {t("landing.termsOfService")}
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400">
              &copy; {new Date().getFullYear()} ToledoIA. {t("landing.allRightsReserved")}
            </p>
            <div className="flex space-x-4 mt-4 md:mt-0">
              <a
                href="#"
                className="text-gray-400 hover:text-white"
                aria-label="Twitter"
              >
                <svg
                  className="h-6 w-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </a>
              <a
                href="#"
                className="text-gray-400 hover:text-white"
                aria-label="GitHub"
              >
                <svg
                  className="h-6 w-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
              <a
                href="#"
                className="text-gray-400 hover:text-white"
                aria-label="Instagram"
              >
                <svg
                  className="h-6 w-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z"
                    clipRule="evenodd"
                  />
                </svg>
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
              {authMode === "login" ? t("auth.login") : t("auth.register")}
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