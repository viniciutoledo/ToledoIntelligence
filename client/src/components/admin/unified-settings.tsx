import { useState, useEffect } from "react";
import { useLanguage } from "@/hooks/use-language";
import { useAvatar } from "@/hooks/use-avatar";
import { useLlm } from "@/hooks/use-llm";
import { useWidgets } from "@/hooks/use-widgets";
import { Loader2, Settings, MessageSquare, Palette, User, BrainCircuit, FileCode, Globe } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

// Importando os componentes de configuração
import { AvatarSettings } from "./avatar-settings";
import { LlmSettings } from "./llm-settings";
import { WidgetsManagement } from "./widgets-management";

export function UnifiedSettings() {
  const { t } = useLanguage();
  const { isLoading: isLoadingAvatar } = useAvatar();
  const { isLoading: isLoadingLlm } = useLlm();
  const { isLoading: isLoadingWidgets } = useWidgets();
  
  const [selectedTab, setSelectedTab] = useState("general");
  
  if (isLoadingAvatar || isLoadingLlm || isLoadingWidgets) {
    return (
      <Card className="shadow-md">
        <CardHeader className="bg-gradient-to-r from-primary-50 to-accent-50 border-b">
          <CardTitle className="flex items-center text-xl">
            <span className="text-primary">Configurações Unificadas</span>
          </CardTitle>
          <CardDescription>Gerencie todas as configurações do sistema em um único local</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center py-16">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-md">
      <CardHeader className="bg-gradient-to-r from-primary-50 to-accent-50 border-b">
        <CardTitle className="flex items-center text-xl">
          <span className="text-primary">Configurações Unificadas</span>
        </CardTitle>
        <CardDescription>Gerencie todas as configurações do sistema em um único local</CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid grid-cols-4 mb-8 w-full">
            <TabsTrigger value="general">
              <Settings className="h-4 w-4 mr-2" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="avatar">
              <User className="h-4 w-4 mr-2" />
              Avatar
            </TabsTrigger>
            <TabsTrigger value="llm">
              <BrainCircuit className="h-4 w-4 mr-2" />
              Modelo de IA
            </TabsTrigger>
            <TabsTrigger value="widget">
              <FileCode className="h-4 w-4 mr-2" />
              Widget de Chat
            </TabsTrigger>
          </TabsList>

          {/* Aba de Visão Geral */}
          <TabsContent value="general" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="p-4">
                  <CardTitle className="text-lg flex items-center">
                    <User className="h-5 w-5 mr-2 text-primary" />
                    Configurações do Avatar
                  </CardTitle>
                  <CardDescription>Personalize a aparência e comportamento do assistente</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-sm text-gray-600">Defina a aparência visual e mensagem de boas-vindas do seu assistente de IA.</p>
                  <button 
                    className="mt-4 px-4 py-2 bg-primary-100 text-primary-700 rounded-md hover:bg-primary-200 transition-colors duration-200"
                    onClick={() => setSelectedTab("avatar")}
                  >
                    Configurar Avatar
                  </button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-4">
                  <CardTitle className="text-lg flex items-center">
                    <BrainCircuit className="h-5 w-5 mr-2 text-primary" />
                    Modelo de IA
                  </CardTitle>
                  <CardDescription>Configure o comportamento e personalidade do assistente</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-sm text-gray-600">Defina o modelo, personalidade, tom de voz e instruções de comportamento.</p>
                  <button 
                    className="mt-4 px-4 py-2 bg-primary-100 text-primary-700 rounded-md hover:bg-primary-200 transition-colors duration-200"
                    onClick={() => setSelectedTab("llm")}
                  >
                    Configurar Modelo
                  </button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-4">
                  <CardTitle className="text-lg flex items-center">
                    <FileCode className="h-5 w-5 mr-2 text-primary" />
                    Widget de Chat
                  </CardTitle>
                  <CardDescription>Personalize o widget para integração em sites</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-sm text-gray-600">Configure cores, tamanhos, domínios permitidos e outras opções para o widget.</p>
                  <button 
                    className="mt-4 px-4 py-2 bg-primary-100 text-primary-700 rounded-md hover:bg-primary-200 transition-colors duration-200"
                    onClick={() => setSelectedTab("widget")}
                  >
                    Configurar Widget
                  </button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-4">
                  <CardTitle className="text-lg flex items-center">
                    <Globe className="h-5 w-5 mr-2 text-primary" />
                    Relação entre Configurações
                  </CardTitle>
                  <CardDescription>Entenda como as configurações estão relacionadas</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-sm text-gray-600 space-y-2">
                    <p><strong>Avatar:</strong> Imagem e nome visíveis em todas as interfaces.</p>
                    <p><strong>Modelo de IA:</strong> Personalidade e comportamento da IA.</p>
                    <p><strong>Widget:</strong> Estilo visual e opções para sites externos.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Aba do Avatar */}
          <TabsContent value="avatar">
            <AvatarSettings />
          </TabsContent>

          {/* Aba do Modelo de IA */}
          <TabsContent value="llm">
            <LlmSettings />
          </TabsContent>

          {/* Aba do Widget */}
          <TabsContent value="widget">
            <WidgetsManagement />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}