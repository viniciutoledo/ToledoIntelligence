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
import { WidgetsManagement } from "@/components/admin/widgets-management";
import LlmUsageLogs from "@/components/admin/llm-usage-logs";
import { UnifiedSettings } from "@/components/admin/unified-settings";
import { ImageAnalysisTest } from "@/components/admin/image-analysis-test";
import { RagPerformanceTest } from "@/components/admin/rag-performance";
import { LlmProvider } from "@/hooks/use-llm";
import { AvatarProvider } from "@/hooks/use-avatar";
import { WidgetsProvider } from "@/hooks/use-widgets";
import { useLanguage } from "@/hooks/use-language";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [activeSection, setActiveSection] = useState("dashboard");
  
  // Lidar com a navegação em seções especiais
  const handleSectionChange = (section: string) => {
    console.log("Navegando para a seção:", section);
    // Atualizar a seção ativa imediatamente
    setActiveSection(section);
    
    // Se for a seção de testes, apenas atualizar a seção e NÃO redirecionar
    // A redireção estava causando problemas na navegação
    if (section === "tests") {
      console.log("Carregando seção de testes diretamente na página admin");
    }
  };
  
  // Verificação explícita de função de usuário - garantir que apenas admins tenham acesso
  useEffect(() => {
    if (!user) {
      console.log("Redirecionando: usuário não está autenticado");
      setLocation("/auth");
      return;
    }
    
    if (user.role !== "admin") {
      console.log("Redirecionando: usuário não é administrador");
      setLocation("/technician");
    }
  }, [user, setLocation]);

  return (
    <div className="flex h-screen bg-gradient-to-br from-neutral-50 to-neutral-100">
      <AdminSidebar activeItem={activeSection} onItemClick={handleSectionChange} />
      
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
              
              <div>
                <AvatarProvider>
                  <LlmProvider>
                    <WidgetsProvider>
                      <UnifiedSettings />
                    </WidgetsProvider>
                  </LlmProvider>
                </AvatarProvider>
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
                  <span>Painel de Administração</span>
                </div>
              </div>
              
              {/* Tabbed interface */}
              <Tabs defaultValue="audit" className="mb-8">
                <TabsList className="mb-4">
                  <TabsTrigger value="audit">Logs de Usuários</TabsTrigger>
                  <TabsTrigger value="llm">Logs de Uso de LLM</TabsTrigger>
                </TabsList>
                
                <TabsContent value="audit" className="mt-4">
                  <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-neutral-700">
                      Registros de Atividades do Sistema
                    </h2>
                    <AuditLogs />
                  </div>
                </TabsContent>
                
                <TabsContent value="llm" className="mt-4">
                  <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-neutral-700">
                      Registros de Uso dos Modelos LLM
                    </h2>
                    <LlmUsageLogs />
                  </div>
                </TabsContent>
              </Tabs>
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
          
          {activeSection === "tests" && (
            <>
              <div className="flex justify-between items-center mb-8 border-b pb-4">
                <h1 className="text-3xl font-bold text-primary-800">
                  Testes
                </h1>
                <div className="bg-white px-4 py-2 rounded-md shadow-sm text-sm text-neutral-500 flex items-center">
                  <span className="font-medium mr-1">ToledoIA</span>
                  <span>Painel de Administração</span>
                </div>
              </div>
              
              <div className="space-y-8">
                <Tabs defaultValue="rag-test" className="mb-8">
                  <TabsList className="mb-4">
                    <TabsTrigger value="rag-test">Teste RAG</TabsTrigger>
                    <TabsTrigger value="image-analysis">Análise de Imagem</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="rag-test" className="mt-4">
                    <div className="space-y-4">
                      <h2 className="text-xl font-semibold text-neutral-700">
                        Teste do Sistema RAG (Retrieval Augmented Generation)
                      </h2>
                      <p className="text-neutral-600">
                        Esta ferramenta permite testar como o sistema RAG recupera documentos 
                        relevantes com base em consultas, usando embeddings semânticos e análise de tópicos.
                      </p>
                      <RagPerformanceTest />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="image-analysis" className="mt-4">
                    <div className="space-y-4">
                      <h2 className="text-xl font-semibold text-neutral-700">
                        Teste de Análise de Imagem com Descrição
                      </h2>
                      <p className="text-neutral-600">
                        Esta ferramenta permite testar o processamento de imagens com descrições personalizadas 
                        para melhorar a análise contextual.
                      </p>
                      <ImageAnalysisTest />
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
