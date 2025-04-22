import { useLocation } from "wouter";
import { useLanguage } from "@/hooks/use-language";
import { TechnicianAuthForm, AuthRedirect } from "@/components/auth";
import { LanguageToggle } from "@/components/language-toggle";

export default function AuthPage() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  
  const handleLoginSuccess = () => {
    // Não precisamos forçar redirecionamento aqui
    // O componente AuthRedirect já vai redirecionar com base no papel do usuário
    // Este callback é chamado apenas por TechnicianAuthForm, que já trata o redirecionamento
  };

  return (
    <AuthRedirect>
      <div className="min-h-screen flex flex-col bg-gray-950">
        {/* Cabeçalho */}
        <header className="py-4 px-6 border-b border-gray-800">
          <div className="container mx-auto">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-pink-600 to-purple-600 flex items-center justify-center text-white font-bold text-xl">
                  T
                </div>
                <span className="text-white text-xl font-bold">ToledoIA</span>
              </div>
              <div className="flex items-center">
                <LanguageToggle />
              </div>
            </div>
          </div>
        </header>

        {/* Conteúdo principal */}
        <main className="flex-1 flex items-center justify-center lg:grid lg:grid-cols-2 p-6">
          {/* Formulário de autenticação */}
          <div className="w-full max-w-md mx-auto">
            <div 
              className="bg-black border border-gray-800 rounded-lg shadow-xl p-6"
              style={{ borderTop: "4px solid #6d28d9" }}
            >
              <TechnicianAuthForm onSuccess={handleLoginSuccess} />
            </div>
          </div>
          
          {/* Hero section */}
          <div className="hidden lg:flex lg:flex-col lg:items-center lg:justify-center lg:p-10">
            <div className="max-w-md text-center">
              <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
                {t("landing.heroTitle")}
              </h1>
              <p className="text-white mb-6 text-lg">
                {t("landing.heroSubtitle")}
              </p>
              <div className="grid grid-cols-2 gap-4 mt-8">
                <div className="bg-black border border-gray-800 p-4 rounded-lg">
                  <h3 className="text-lg font-medium text-purple-400 mb-2">
                    {t("landing.featureOneTitle")}
                  </h3>
                  <p className="text-white text-sm">
                    {t("landing.featureOneDescription")}
                  </p>
                </div>
                <div className="bg-black border border-gray-800 p-4 rounded-lg">
                  <h3 className="text-lg font-medium text-purple-400 mb-2">
                    {t("landing.featureTwoTitle")}
                  </h3>
                  <p className="text-white text-sm">
                    {t("landing.featureTwoDescription")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Rodapé */}
        <footer className="py-4 px-6 border-t border-gray-800">
          <div className="container mx-auto">
            <div className="flex justify-center items-center">
              <p className="text-gray-500 text-sm">
                &copy; {new Date().getFullYear()} ToledoIA. Todos os direitos reservados ao Prof. Vinícius Toledo
              </p>
            </div>
          </div>
        </footer>
      </div>
    </AuthRedirect>
  );
}