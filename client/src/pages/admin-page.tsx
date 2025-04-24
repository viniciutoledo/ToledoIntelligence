import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { AdminSidebar } from "@/components/admin/sidebar";
import { LlmSettings } from "@/components/admin/llm-settings";
import { AvatarSettings } from "@/components/admin/avatar-settings";
import { UsersList } from "@/components/admin/users-list";
import { AuditLogs } from "@/components/admin/audit-logs";
import { AdminDashboard } from "@/components/admin/dashboard"; 
import { TrainingPanel } from "@/components/admin/training-panel";
import PlanManagement from "@/components/admin/plan-management";
import PlanPricing from "@/components/admin/plan-pricing";
import WidgetsManagement from "@/components/admin/widgets-management";
import { LlmProvider } from "@/hooks/use-llm";
import { AvatarProvider } from "@/hooks/use-avatar";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";

export default function AdminPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [activeSection, setActiveSection] = useState("dashboard");
  
  // Verificação explícita de função de usuário - garantir que apenas admins tenham acesso
  useEffect(() => {
    if (user && user.role !== "admin") {
      console.log("Redirecionando: usuário não é administrador");
      setLocation("/technician");
    }
  }, [user, setLocation]);

  return (
    <div className="flex h-screen bg-gradient-to-br from-neutral-50 to-neutral-100">
      <AdminSidebar activeItem={activeSection} onItemClick={setActiveSection} />
      
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-6">
          {activeSection === "dashboard" && (
            <>
              <div className="flex justify-between items-center mb-8 border-b pb-4">
                <h1 className="text-3xl font-bold text-primary-800">
                  {t("admin.dashboard")}
                </h1>
                <div className="bg-white px-4 py-2 rounded-md shadow-sm text-sm text-neutral-500 flex items-center">
                  <span className="font-medium mr-1">ToledoIA</span>
                  <span>Admin Panel</span>
                </div>
              </div>
              <AdminDashboard />
            </>
          )}
          
          {activeSection === "settings" && (
            <>
              <div className="flex justify-between items-center mb-8 border-b pb-4">
                <h1 className="text-3xl font-bold text-primary-800">
                  {t("admin.settings")}
                </h1>
                <div className="bg-white px-4 py-2 rounded-md shadow-sm text-sm text-neutral-500 flex items-center">
                  <span className="font-medium mr-1">ToledoIA</span>
                  <span>Admin Panel</span>
                </div>
              </div>
              
              <div className="space-y-10">
                <div className="mb-8">
                  <h2 className="text-xl font-semibold text-neutral-700 mb-4">
                    {t("admin.avatarSettings")}
                  </h2>
                  <AvatarProvider>
                    <AvatarSettings />
                  </AvatarProvider>
                </div>
                
                <div>
                  <h2 className="text-xl font-semibold text-neutral-700 mb-4">
                    {t("admin.llmSettings")}
                  </h2>
                  <LlmProvider>
                    <LlmSettings />
                  </LlmProvider>
                </div>
              </div>
            </>
          )}
          
          {activeSection === "users" && (
            <>
              <div className="flex justify-between items-center mb-8 border-b pb-4">
                <h1 className="text-3xl font-bold text-primary-800">
                  {t("admin.users")}
                </h1>
                <div className="bg-white px-4 py-2 rounded-md shadow-sm text-sm text-neutral-500 flex items-center">
                  <span className="font-medium mr-1">ToledoIA</span>
                  <span>Admin Panel</span>
                </div>
              </div>
              <UsersList />
            </>
          )}
          
          {activeSection === "logs" && (
            <>
              <div className="flex justify-between items-center mb-8 border-b pb-4">
                <h1 className="text-3xl font-bold text-primary-800">
                  {t("admin.logs")}
                </h1>
                <div className="bg-white px-4 py-2 rounded-md shadow-sm text-sm text-neutral-500 flex items-center">
                  <span className="font-medium mr-1">ToledoIA</span>
                  <span>Admin Panel</span>
                </div>
              </div>
              <AuditLogs />
            </>
          )}
          
          {activeSection === "training" && (
            <>
              <div className="flex justify-between items-center mb-8 border-b pb-4">
                <h1 className="text-3xl font-bold text-primary-800">
                  {t("admin.training")}
                </h1>
                <div className="bg-white px-4 py-2 rounded-md shadow-sm text-sm text-neutral-500 flex items-center">
                  <span className="font-medium mr-1">ToledoIA</span>
                  <span>Admin Panel</span>
                </div>
              </div>
              <TrainingPanel />
            </>
          )}
          
          {activeSection === "plans" && (
            <>
              <div className="flex justify-between items-center mb-8 border-b pb-4">
                <h1 className="text-3xl font-bold text-primary-800">
                  {t("admin.plans") || "Planos"}
                </h1>
                <div className="bg-white px-4 py-2 rounded-md shadow-sm text-sm text-neutral-500 flex items-center">
                  <span className="font-medium mr-1">ToledoIA</span>
                  <span>Admin Panel</span>
                </div>
              </div>
              <div className="space-y-8">
                <PlanPricing />
                <PlanManagement />
              </div>
            </>
          )}
          
          {activeSection === "widgets" && (
            <>
              <div className="flex justify-between items-center mb-8 border-b pb-4">
                <h1 className="text-3xl font-bold text-primary-800">
                  {t("admin.widgets") || "Widgets de Chat"}
                </h1>
                <div className="bg-white px-4 py-2 rounded-md shadow-sm text-sm text-neutral-500 flex items-center">
                  <span className="font-medium mr-1">ToledoIA</span>
                  <span>Admin Panel</span>
                </div>
              </div>
              <WidgetsManagement />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
