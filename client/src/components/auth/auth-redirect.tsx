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
      
      // Se temos um caminho específico de redirecionamento fornecido pelo componente pai
      if (redirectPathWhenLoggedIn) {
        console.log(`AuthRedirect - Redirecionando para caminho específico: ${redirectPathWhenLoggedIn}`);
        window.location.href = redirectPathWhenLoggedIn;
        return;
      }
      
      // Obtém o caminho atual
      const currentPath = window.location.pathname;
      
      // Verificamos se estamos na tela de login do admin
      if (currentPath.includes('admin-login') || currentPath.includes('cpanel-login')) {
        if (user.role === "admin") {
          // Se for admin na tela de login de admin, redireciona para o painel admin
          console.log("AuthRedirect - Redirecionando para painel do administrador");
          window.location.href = "/admin";
        } else {
          // Se for técnico tentando acessar login de admin, redireciona para área de técnico
          console.log("AuthRedirect - Técnico tentando acessar área de admin, redirecionando para área técnica");
          window.location.href = "/technician";
        }
      } else {
        // Para todas as outras páginas públicas, redirecionar com base no papel do usuário
        if (user.role === "admin") {
          console.log("AuthRedirect - Redirecionando administrador para interface administrativa");
          window.location.href = "/admin";
        } else {
          // Usuários técnicos são sempre direcionados para a interface de técnico
          console.log("AuthRedirect - Redirecionando técnico para interface do técnico");
          window.location.href = "/technician";
        }
      }
    } else {
      console.log("AuthRedirect - Usuário não autenticado, permanecendo na página atual");
    }
  }, [user, isLoading, setLocation, redirectPathWhenLoggedIn]);
  
  return <>{children}</>;
}