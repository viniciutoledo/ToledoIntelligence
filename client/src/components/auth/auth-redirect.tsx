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
    if (isLoading) return;
    
    if (user) {
      if (redirectPathWhenLoggedIn) {
        // Se um caminho específico de redirecionamento foi fornecido
        setLocation(redirectPathWhenLoggedIn);
      } else if (user.role === "technician") {
        // Redirecionar para a página do técnico se logado como técnico
        setLocation("/technician");
      } else if (user.role === "admin") {
        // Redirecionar para a página do admin se logado como admin
        setLocation("/admin");
      }
    }
  }, [user, isLoading, setLocation, redirectPathWhenLoggedIn]);
  
  return <>{children}</>;
}