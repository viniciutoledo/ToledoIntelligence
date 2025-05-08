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
          <TabsList className="grid grid-cols-5 mb-8 w-full">
            <TabsTrigger value="general">
              <Settings className="h-4 w-4 mr-2" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="llm">
              <BrainCircuit className="h-4 w-4 mr-2" />
              Modelo de IA
            </TabsTrigger>
            <TabsTrigger value="tech-chat">
              <User className="h-4 w-4 mr-2" />
              Chat Técnicos
            </TabsTrigger>
            <TabsTrigger value="widget">
              <FileCode className="h-4 w-4 mr-2" />
              Widgets Externos
            </TabsTrigger>
            <TabsTrigger value="system">
              <Cog className="h-4 w-4 mr-2" />
              Sistema
            </TabsTrigger>
          </TabsList>

          {/* Aba de Visão Geral */}
          <TabsContent value="general" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="p-4">
                  <CardTitle className="text-lg flex items-center">
                    <User className="h-5 w-5 mr-2 text-primary" />
                    Chat para Técnicos
                  </CardTitle>
                  <CardDescription>Configure o chat usado pelos técnicos</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-sm text-gray-600">Defina a aparência visual, avatar e mensagem de boas-vindas do assistente na interface principal.</p>
                  <button 
                    className="mt-4 px-4 py-2 bg-primary-100 text-primary-700 rounded-md hover:bg-primary-200 transition-colors duration-200"
                    onClick={() => setSelectedTab("tech-chat")}
                  >
                    Configurar Chat Técnicos
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
          {/* Aba do Chat para Técnicos */}
          <TabsContent value="tech-chat">
            <Card className="shadow-md">
              <CardHeader className="bg-gradient-to-r from-primary-50 to-accent-50 border-b">
                <CardTitle className="flex items-center text-xl">
                  <User className="h-5 w-5 mr-2" />
                  <span className="text-primary">Configuração do Chat para Técnicos</span>
                </CardTitle>
                <CardDescription>Personalize o chat principal usado por técnicos na plataforma</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div className="bg-blue-50 p-4 rounded-md mb-4">
                    <h3 className="font-medium text-blue-700 flex items-center mb-2">
                      <InfoIcon className="h-4 w-4 mr-2" />
                      Sobre esta configuração
                    </h3>
                    <p className="text-sm text-blue-600">
                      Estas configurações se aplicam apenas ao chat principal usado pelos técnicos na plataforma ToledoIA. 
                      Elas não afetam os widgets incorporáveis em sites externos.
                    </p>
                  </div>
                
                  <AvatarSettings />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba do Modelo de IA */}
          <TabsContent value="llm">
            <Card className="shadow-md">
              <CardHeader className="bg-gradient-to-r from-primary-50 to-accent-50 border-b">
                <CardTitle className="flex items-center text-xl">
                  <BrainCircuit className="h-5 w-5 mr-2" />
                  <span className="text-primary">Configuração do Modelo de IA</span>
                </CardTitle>
                <CardDescription>Configure o comportamento do modelo de IA para todos os chats</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div className="bg-amber-50 p-4 rounded-md mb-4">
                    <h3 className="font-medium text-amber-700 flex items-center mb-2">
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Configuração Global
                    </h3>
                    <p className="text-sm text-amber-600">
                      Estas configurações afetam o comportamento da IA em todas as interfaces (chat principal e widgets)
                    </p>
                  </div>
                
                  <LlmSettings />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba dos Widgets Externos */}
          <TabsContent value="widget">
            <Card className="shadow-md">
              <CardHeader className="bg-gradient-to-r from-primary-50 to-accent-50 border-b">
                <CardTitle className="flex items-center text-xl">
                  <FileCode className="h-5 w-5 mr-2" />
                  <span className="text-primary">Configuração de Widgets Externos</span>
                </CardTitle>
                <CardDescription>Configure os widgets para incorporação em sites externos</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div className="bg-green-50 p-4 rounded-md mb-4">
                    <h3 className="font-medium text-green-700 flex items-center mb-2">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Widgets para Sites Externos
                    </h3>
                    <p className="text-sm text-green-600">
                      Estas configurações controlam a aparência e o comportamento dos widgets incorporáveis em sites externos.
                      Cada widget pode ter seu próprio visual, avatar e configurações de segurança.
                    </p>
                  </div>
                
                  <WidgetsManagement />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Aba de Sistema */}
          <TabsContent value="system">
            <Card className="shadow-md">
              <CardHeader className="bg-gradient-to-r from-primary-50 to-accent-50 border-b">
                <CardTitle className="flex items-center text-xl">
                  <Cog className="h-5 w-5 mr-2" />
                  <span className="text-primary">Configurações do Sistema</span>
                </CardTitle>
                <CardDescription>Configure os aspectos gerais do sistema</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div className="bg-gray-50 p-4 rounded-md mb-4">
                    <h3 className="font-medium text-gray-700 flex items-center mb-2">
                      <Settings className="h-4 w-4 mr-2" />
                      Configurações Globais
                    </h3>
                    <p className="text-sm text-gray-600">
                      Estas configurações afetam o comportamento geral do sistema. Alterações podem afetar todos os usuários.
                    </p>
                  </div>
                
                  <div className="text-center py-12">
                    <div className="bg-primary-50 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
                      <Wrench className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-medium mb-2">Em desenvolvimento</h3>
                    <p className="text-gray-500 max-w-md mx-auto">
                      Esta seção está sendo implementada e estará disponível em breve.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}