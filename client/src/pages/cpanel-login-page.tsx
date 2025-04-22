import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { AdminAuthForm } from "@/components/auth";
import { LanguageToggle } from "@/components/language-toggle";

export default function CpanelLoginPage() {
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();
  
  // Redirecionar para o painel admin se já estiver logado como admin
  useEffect(() => {
    if (!isLoading && user && user.role === "admin") {
      setLocation("/admin");
    }
    // Se estiver logado como técnico, redirecionar para a página técnico
    else if (!isLoading && user && user.role === "technician") {
      setLocation("/technician");
    }
  }, [user, isLoading, setLocation]);

  const handleLoginSuccess = () => {
    setLocation("/admin");
  };

  return (
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
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div 
            className="bg-gray-900 rounded-lg shadow-xl p-6"
            style={{ borderTop: "4px solid #f59e0b" }}
          >
            <h1 className="text-2xl font-bold text-center mb-6">{t("admin.adminPanelAccess")}</h1>
            <AdminAuthForm onSuccess={handleLoginSuccess} />
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
  );
}