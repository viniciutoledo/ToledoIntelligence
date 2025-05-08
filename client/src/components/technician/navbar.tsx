import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { LanguageToggle } from "@/components/language-toggle";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { User, LogOut, Settings, UserCircle } from "lucide-react";

export function TechnicianNavbar() {
  const { user, logoutMutation } = useAuth();
  const { t } = useLanguage();
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    logoutMutation.mutate();
  };
  
  const navigateToAdmin = () => {
    setLocation("/admin");
  };
  
  const navigateToProfile = () => {
    setLocation("/profile");
  };

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <span className="text-xl font-bold text-primary-600">Toledo</span>
              <span className="text-xl font-bold text-accent-500">IA</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <div className="relative">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 text-neutral-700 hover:text-neutral-900">
                    <span className="hidden md:block text-sm">
                      {user?.email?.split('@')[0]}
                    </span>
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem disabled>
                    {user?.email}
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={navigateToProfile}>
                    <UserCircle className="mr-2 h-4 w-4" />
                    <span>{t("common.profile", "Meu Perfil")}</span>
                  </DropdownMenuItem>
                  
                  {user?.role === "admin" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={navigateToAdmin}>
                        <Settings className="mr-2 h-4 w-4 text-amber-500" />
                        <span className="text-amber-500 font-medium">{t("admin.accessPanel")}</span>
                      </DropdownMenuItem>
                    </>
                  )}
                  
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{t("common.logout")}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {/* Botão de logout removido para maior segurança */}
          </div>
        </div>
      </div>
    </nav>
  );
}
