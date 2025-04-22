import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

interface AuthRedirectProps {
  children: React.ReactNode;
  redirectPathWhenLoggedIn?: string;
}

/**
 * Componente que verifica se o usuário está autenticado e redireciona
 * automaticamente para a página apropriada com base na função do usuário.
 * Este componente é útil para páginas públicas como landing page e login.
 */
export function AuthRedirect({ 
  children, 
  redirectPathWhenLoggedIn 
}: AuthRedirectProps) {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();
  
  useEffect(() => {
    console.log("AuthRedirect - Verificando estado:", { isLoading, user, redirectPathWhenLoggedIn });
    
    if (isLoading) {
      console.log("AuthRedirect - Carregando dados do usuário...");
      return;
    }
    
    if (user) {
      console.log(`AuthRedirect - Usuário autenticado: ${user.email} (${user.role})`);
      
      if (redirectPathWhenLoggedIn) {
        // Se um caminho específico de redirecionamento foi fornecido
        console.log(`AuthRedirect - Redirecionando para caminho específico: ${redirectPathWhenLoggedIn}`);
        window.location.href = redirectPathWhenLoggedIn;
      } else if (user.role === "technician") {
        // Redirecionar para a página do técnico se logado como técnico
        console.log("AuthRedirect - Redirecionando para interface do técnico");
        window.location.href = "/technician";
      } else if (user.role === "admin") {
        // Redirecionar para a página do admin se logado como admin
        console.log("AuthRedirect - Redirecionando para painel do administrador");
        window.location.href = "/admin";
      }
    } else {
      console.log("AuthRedirect - Usuário não autenticado, permanecendo na página atual");
    }
  }, [user, isLoading, setLocation, redirectPathWhenLoggedIn]);
  
  return <>{children}</>;
}