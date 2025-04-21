import { useState } from "react";
import { AdminSidebar } from "@/components/admin/sidebar";
import { LlmSettings } from "@/components/admin/llm-settings";
import { AvatarSettings } from "@/components/admin/avatar-settings";
import { UsersList } from "@/components/admin/users-list";
import { AuditLogs } from "@/components/admin/audit-logs";
import { AdminDashboard } from "@/components/admin/dashboard"; 
import { LlmProvider } from "@/hooks/use-llm";
import { AvatarProvider } from "@/hooks/use-avatar";
import { useLanguage } from "@/hooks/use-language";

export default function AdminPage() {
  const { t } = useLanguage();
  const [activeSection, setActiveSection] = useState("settings");

  return (
    <div className="flex h-screen bg-neutral-50">
      <AdminSidebar activeItem={activeSection} onItemClick={setActiveSection} />
      
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {activeSection === "dashboard" && (
            <>
              <h1 className="text-2xl font-bold text-neutral-800 mb-6">
                {t("admin.dashboard")}
              </h1>
              <AdminDashboard />
            </>
          )}
          
          {activeSection === "settings" && (
            <>
              <h1 className="text-2xl font-bold text-neutral-800 mb-6">
                {t("admin.settings")}
              </h1>
              
              <div className="space-y-8">
                <LlmProvider>
                  <LlmSettings />
                </LlmProvider>
                
                <AvatarProvider>
                  <AvatarSettings />
                </AvatarProvider>
              </div>
            </>
          )}
          
          {activeSection === "users" && (
            <>
              <h1 className="text-2xl font-bold text-neutral-800 mb-6">
                {t("admin.users")}
              </h1>
              <UsersList />
            </>
          )}
          
          {activeSection === "logs" && (
            <>
              <h1 className="text-2xl font-bold text-neutral-800 mb-6">
                {t("admin.logs")}
              </h1>
              <AuditLogs />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
