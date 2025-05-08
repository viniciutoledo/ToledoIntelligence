import { useState, useEffect } from "react";
import { useLanguage } from "@/hooks/use-language";
import { useAvatar } from "@/hooks/use-avatar";
import { useLlm } from "@/hooks/use-llm";
import { useWidgets } from "@/hooks/use-widgets";
import { 
  Loader2, 
  Settings, 
  MessageSquare, 
  Palette, 
  User, 
  BrainCircuit, 
  FileCode, 
  Globe, 
  Cog, 
  AlertCircle, 
  Info, 
  ExternalLink,
  Wrench
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
                      <Info className="h-4 w-4 mr-2" />
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
                
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="shadow-sm">
                      <CardHeader className="p-4 border-b">
                        <CardTitle className="text-lg flex items-center">
                          <Globe className="h-4 w-4 mr-2 text-primary" />
                          Configurações de Idioma
                        </CardTitle>
                        <CardDescription>
                          Configure os idiomas disponíveis no sistema
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">Idioma Principal</h4>
                              <p className="text-sm text-muted-foreground">Selecione o idioma padrão do sistema</p>
                            </div>
                            <Select defaultValue="pt-BR">
                              <SelectTrigger className="w-32">
                                <SelectValue placeholder="Idioma" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pt-BR">Português</SelectItem>
                                <SelectItem value="en-US">English</SelectItem>
                                <SelectItem value="es-ES">Español</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">Idiomas Adicionais</h4>
                              <p className="text-sm text-muted-foreground">Outros idiomas disponíveis na plataforma</p>
                            </div>
                            <div className="flex gap-2">
                              <Badge variant="outline" className="px-2 py-1">Português</Badge>
                              <Badge variant="outline" className="px-2 py-1">English</Badge>
                            </div>
                          </div>
                          
                          <Button className="w-full" variant="outline" size="sm">
                            Gerenciar Idiomas
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="shadow-sm">
                      <CardHeader className="p-4 border-b">
                        <CardTitle className="text-lg flex items-center">
                          <Settings className="h-4 w-4 mr-2 text-primary" />
                          Acesso e Permissões
                        </CardTitle>
                        <CardDescription>
                          Gerencie o nível de acesso dos usuários
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">Auto-registro de Técnicos</h4>
                              <p className="text-sm text-muted-foreground">Permitir que técnicos se registrem sem aprovação</p>
                            </div>
                            <Switch defaultChecked={false} />
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">Autenticação de Dois Fatores</h4>
                              <p className="text-sm text-muted-foreground">Exigir 2FA para administradores</p>
                            </div>
                            <Switch defaultChecked={true} />
                          </div>
                          
                          <Button className="w-full" variant="outline" size="sm">
                            Configurações Avançadas
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="shadow-sm">
                      <CardHeader className="p-4 border-b">
                        <CardTitle className="text-lg flex items-center">
                          <AlertCircle className="h-4 w-4 mr-2 text-primary" />
                          Logs e Auditoria
                        </CardTitle>
                        <CardDescription>
                          Configure os registros de atividades do sistema
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">Nível de Detalhe dos Logs</h4>
                              <p className="text-sm text-muted-foreground">Controle a quantidade de informações registradas</p>
                            </div>
                            <Select defaultValue="medium">
                              <SelectTrigger className="w-32">
                                <SelectValue placeholder="Nível" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">Básico</SelectItem>
                                <SelectItem value="medium">Médio</SelectItem>
                                <SelectItem value="high">Detalhado</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">Retenção de Logs</h4>
                              <p className="text-sm text-muted-foreground">Período de armazenamento dos registros</p>
                            </div>
                            <Select defaultValue="90">
                              <SelectTrigger className="w-32">
                                <SelectValue placeholder="Período" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="30">30 dias</SelectItem>
                                <SelectItem value="90">90 dias</SelectItem>
                                <SelectItem value="180">6 meses</SelectItem>
                                <SelectItem value="365">1 ano</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <Button className="w-full" variant="outline" size="sm">
                            Ver Registros de Auditoria
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="shadow-sm">
                      <CardHeader className="p-4 border-b">
                        <CardTitle className="text-lg flex items-center">
                          <Wrench className="h-4 w-4 mr-2 text-primary" />
                          Manutenção do Sistema
                        </CardTitle>
                        <CardDescription>
                          Ferramentas de manutenção e otimização
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="space-y-4">
                          <div>
                            <h4 className="font-medium mb-2">Banco de Dados</h4>
                            <div className="grid grid-cols-2 gap-2">
                              <Button variant="outline" size="sm" className="w-full">
                                Verificar Integridade
                              </Button>
                              <Button variant="outline" size="sm" className="w-full">
                                Otimizar Índices
                              </Button>
                            </div>
                          </div>
                          
                          <div>
                            <h4 className="font-medium mb-2">Cache do Sistema</h4>
                            <div className="grid grid-cols-2 gap-2">
                              <Button variant="outline" size="sm" className="w-full">
                                Limpar Cache
                              </Button>
                              <Button variant="outline" size="sm" className="w-full">
                                Reconstruir Índices
                              </Button>
                            </div>
                          </div>
                          
                          <Button className="w-full" variant="default" size="sm">
                            Painel de Manutenção Avançada
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
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