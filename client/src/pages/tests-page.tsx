import { useState } from "react";
import { AdminSidebar } from "@/components/admin/sidebar";
import { ModelPerformanceStats } from "@/components/admin/model-performance-stats";
import { SimilarCircuitsRecommendation } from "@/components/admin/similar-circuits-recommendation";
import { FavoritesList } from "@/components/analysis/favorites-list";
import { AnalysisHistoryBrowser } from "@/components/analysis/history-browser";
import { ERPIntegration } from "@/components/integration/erp-integration";
import { ImageAnalysisTest } from "@/components/admin/image-analysis-test";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";

export default function TestsPage() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState("tests");

  // Redirecionamento se não for admin
  if (!user || user.role !== "admin") {
    return <Redirect to="/auth" />;
  }

  return (
    <div className="flex h-screen bg-white">
      <AdminSidebar activeItem={activeSection} onItemClick={setActiveSection} />

      <div className="flex-1 flex flex-col overflow-auto">
        <div className="container mx-auto px-6 py-8">
          <div className="flex justify-between items-center mb-8 border-b pb-4">
            <h1 className="text-3xl font-bold text-primary-800">
              Testes e Funcionalidades
            </h1>
            <div className="bg-white px-4 py-2 rounded-md shadow-sm text-sm text-neutral-500 flex items-center">
              <span className="font-medium mr-1">ToledoIA</span>
              <span>Painel de Administração</span>
            </div>
          </div>

          <div className="space-y-8">
            <Tabs defaultValue="image-analysis" className="mb-8">
              <TabsList className="mb-4">
                <TabsTrigger value="image-analysis">Análise de Imagem</TabsTrigger>
                <TabsTrigger value="model-stats">Performance dos Modelos</TabsTrigger>
                <TabsTrigger value="similar-circuits">Recomendações</TabsTrigger>
                <TabsTrigger value="history">Histórico</TabsTrigger>
                <TabsTrigger value="favorites">Favoritos</TabsTrigger>
                <TabsTrigger value="erp">Integração ERP</TabsTrigger>
              </TabsList>

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

              <TabsContent value="model-stats" className="mt-4">
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-neutral-700">
                    Estatísticas de Performance dos Modelos
                  </h2>
                  <p className="text-neutral-600">
                    Visualize a performance comparativa entre os diferentes modelos de LLM utilizados no sistema.
                  </p>
                  <ModelPerformanceStats />
                </div>
              </TabsContent>

              <TabsContent value="similar-circuits" className="mt-4">
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-neutral-700">
                    Sistema de Recomendação de Circuitos
                  </h2>
                  <p className="text-neutral-600">
                    Encontre placas de circuito similares baseadas em análises anteriores.
                  </p>
                  <SimilarCircuitsRecommendation />
                </div>
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-neutral-700">
                    Histórico de Análises
                  </h2>
                  <p className="text-neutral-600">
                    Pesquise e filtre o histórico completo de análises de circuitos.
                  </p>
                  <AnalysisHistoryBrowser />
                </div>
              </TabsContent>

              <TabsContent value="favorites" className="mt-4">
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-neutral-700">
                    Análises Favoritas
                  </h2>
                  <p className="text-neutral-600">
                    Gerencie suas análises favoritas para acesso rápido.
                  </p>
                  <FavoritesList />
                </div>
              </TabsContent>

              <TabsContent value="erp" className="mt-4">
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-neutral-700">
                    Integração com Sistemas ERP
                  </h2>
                  <p className="text-neutral-600">
                    Configure e gerencie a integração com sistemas de gerenciamento de manutenção.
                  </p>
                  <ERPIntegration />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}