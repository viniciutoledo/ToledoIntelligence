import { useState, useEffect } from "react";
import { useLanguage } from "@/hooks/use-language";
import { useAvatar } from "@/hooks/use-avatar";
import { useLlm } from "@/hooks/use-llm";
import { useWidgets } from "@/hooks/use-widgets";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
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
import { AdvancedSecuritySettings } from "./advanced-security-settings";
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
  const { toast } = useToast();
  
  const [selectedTab, setSelectedTab] = useState("general");
  
  // Função para exibir mensagens e estados usando toast
  const showMessage = (message: string, type: "default" | "success" | "error" = "default") => {
    toast({
      title: type === "success" ? "Operação concluída" : type === "error" ? "Erro" : "Informação",
      description: message,
      variant: type === "error" ? "destructive" : "default",
    });
  };
  
  // Estados para guardar configurações do sistema
  const [autoRegisterTechnicians, setAutoRegisterTechnicians] = useState(false);
  const [require2FA, setRequire2FA] = useState(false);
  const [logLevel, setLogLevel] = useState("medium");
  const [logRetention, setLogRetention] = useState("90");
  const [isLoadingSystem, setIsLoadingSystem] = useState(false);
  
  // Carregar configurações do sistema
  useEffect(() => {
    const fetchSystemSettings = async () => {
      try {
        const response = await apiRequest("GET", "/api/admin/system/settings");
        if (response.ok) {
          const data = await response.json();
          setLogLevel(data.logLevel || "medium");
          setLogRetention(data.logRetention || "90");
          setAutoRegisterTechnicians(data.autoRegisterTechnicians || false);
          setRequire2FA(data.require2FA || false);
        }
      } catch (error) {
        console.error("Erro ao carregar configurações do sistema:", error);
        showMessage("Não foi possível carregar as configurações do sistema", "error");
      }
    };
    
    fetchSystemSettings();
  }, []);
  
  // Funções para operações de sistema
  const toggleRequire2FA = async (enabled: boolean) => {
    try {
      setIsLoadingSystem(true);
      
      const response = await apiRequest("POST", "/api/admin/system/toggle-require-2fa", {
        enabled
      });
      
      const data = await response.json();
      
      if (data.success) {
        setRequire2FA(enabled);
        showMessage(data.message, "success");
      } else {
        showMessage(data.message, "error");
      }
    } catch (error) {
      console.error("Erro ao alterar configuração de 2FA:", error);
      showMessage("Erro ao alterar configuração de 2FA", "error");
    } finally {
      setIsLoadingSystem(false);
    }
  };
  
  const handleLogLevelChange = async (level: string) => {
    try {
      setIsLoadingSystem(true);
      
      const response = await apiRequest("POST", "/api/admin/system/log-level", {
        level
      });
      
      const data = await response.json();
      
      if (data.success) {
        setLogLevel(level);
        showMessage(data.message, "success");
      } else {
        showMessage(data.message, "error");
      }
    } catch (error) {
      console.error("Erro ao alterar nível de log:", error);
      showMessage("Erro ao alterar nível de log", "error");
    } finally {
      setIsLoadingSystem(false);
    }
  };
  
  const handleLogRetentionChange = async (days: string) => {
    try {
      setIsLoadingSystem(true);
      
      const response = await apiRequest("POST", "/api/admin/system/log-retention", {
        days: Number(days)
      });
      
      const data = await response.json();
      
      if (data.success) {
        setLogRetention(days);
        showMessage(data.message, "success");
      } else {
        showMessage(data.message, "error");
      }
    } catch (error) {
      console.error("Erro ao alterar período de retenção de logs:", error);
      showMessage("Erro ao alterar período de retenção de logs", "error");
    } finally {
      setIsLoadingSystem(false);
    }
  };
  
  const toggleAutoRegister = async (enabled: boolean) => {
    try {
      setIsLoadingSystem(true);
      
      const response = await apiRequest("POST", "/api/admin/system/toggle-auto-register", {
        enabled
      });
      
      const data = await response.json();
      
      if (data.success) {
        setAutoRegisterTechnicians(enabled);
        showMessage(data.message, "success");
      } else {
        showMessage(data.message, "error");
      }
    } catch (error) {
      console.error("Erro ao alterar configuração de auto-registro:", error);
      showMessage("Erro ao alterar configuração de auto-registro", "error");
    } finally {
      setIsLoadingSystem(false);
    }
  };
  
  const verifyDatabaseIntegrity = async () => {
    try {
      setIsLoadingSystem(true);
      showMessage("Verificação de integridade iniciada...");
      
      const response = await apiRequest("POST", "/api/admin/system/verify-db");
      const data = await response.json();
      
      if (data.success) {
        showMessage(data.message, "success");
      } else {
        showMessage(data.message, "error");
      }
    } catch (error) {
      console.error("Erro ao verificar integridade do banco de dados:", error);
      showMessage("Erro ao verificar integridade do banco de dados", "error");
    } finally {
      setIsLoadingSystem(false);
    }
  };
  
  const optimizeIndexes = async () => {
    try {
      setIsLoadingSystem(true);
      showMessage("Otimização de índices iniciada...");
      
      const response = await apiRequest("POST", "/api/admin/system/optimize-indexes");
      const data = await response.json();
      
      if (data.success) {
        showMessage(data.message, "success");
      } else {
        showMessage(data.message, "error");
      }
    } catch (error) {
      console.error("Erro ao otimizar índices:", error);
      showMessage("Erro ao otimizar índices", "error");
    } finally {
      setIsLoadingSystem(false);
    }
  };
  
  const clearCache = async () => {
    try {
      setIsLoadingSystem(true);
      showMessage("Limpeza de cache iniciada...");
      
      const response = await apiRequest("POST", "/api/admin/system/clear-cache");
      const data = await response.json();
      
      if (data.success) {
        showMessage(data.message, "success");
      } else {
        showMessage(data.message, "error");
      }
    } catch (error) {
      console.error("Erro ao limpar cache:", error);
      showMessage("Erro ao limpar cache", "error");
    } finally {
      setIsLoadingSystem(false);
    }
  };
  
  const rebuildIndexes = async () => {
    try {
      setIsLoadingSystem(true);
      showMessage("Reconstrução de índices iniciada...");
      
      const response = await apiRequest("POST", "/api/admin/system/rebuild-indexes");
      const data = await response.json();
      
      if (data.success) {
        showMessage(data.message, "success");
      } else {
        showMessage(data.message, "error");
      }
    } catch (error) {
      console.error("Erro ao reconstruir índices:", error);
      showMessage("Erro ao reconstruir índices", "error");
    } finally {
      setIsLoadingSystem(false);
    }
  };
  
  const openAdvancedPanel = () => {
    showMessage("Painel de manutenção avançada em desenvolvimento. Estará disponível na próxima atualização.");
  };
  
  const viewAuditLogs = () => {
    showMessage("Visualização dos registros de auditoria em desenvolvimento. Estará disponível na próxima atualização.");
  };
  
  const manageLanguages = () => {
    showMessage("Gerenciamento de idiomas em desenvolvimento. Estará disponível na próxima atualização.");
  };
  
  const [showAdvancedSecuritySettings, setShowAdvancedSecuritySettings] = useState(false);
  
  const advancedSecuritySettings = () => {
    setShowAdvancedSecuritySettings(true);
  };
  
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
                      Estas configurações afetam o comportamento geral da plataforma. Elas são restritas a administradores.
                    </p>
                  </div>
                
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Card de Idioma */}
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
                            <div 
                              className="bg-gray-100 text-sm px-3 py-1 rounded border cursor-pointer hover:bg-gray-200"
                              onClick={() => showMessage("O idioma principal do sistema é Português (Brasil)")}
                            >
                              Português
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">Idiomas Adicionais</h4>
                              <p className="text-sm text-muted-foreground">Outros idiomas disponíveis na plataforma</p>
                            </div>
                            <div className="flex gap-2">
                              <div 
                                className="bg-primary-100 text-primary-700 text-xs px-2 py-1 rounded-full cursor-pointer hover:bg-primary-200"
                                onClick={() => showMessage("Português (Brasil) já é o idioma principal")}
                              >
                                Português
                              </div>
                              <div 
                                className="bg-primary-100 text-primary-700 text-xs px-2 py-1 rounded-full cursor-pointer hover:bg-primary-200"
                                onClick={() => showMessage("Você pode alternar para inglês nas configurações de conta")}
                              >
                                English
                              </div>
                            </div>
                          </div>
                          
                          <button 
                            className="w-full px-4 py-2 border border-gray-300 rounded-md text-sm"
                            onClick={manageLanguages}
                          >
                            Gerenciar Idiomas
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Card de Segurança */}
                    <Card className="shadow-sm">
                      <CardHeader className="p-4 border-b">
                        <CardTitle className="text-lg flex items-center">
                          <AlertCircle className="h-4 w-4 mr-2 text-primary" />
                          Configurações de Segurança
                        </CardTitle>
                        <CardDescription>
                          Configure opções de segurança da plataforma
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">Registro Automático de Técnicos</h4>
                              <p className="text-sm text-muted-foreground">Permite que técnicos se registrem sem aprovação</p>
                            </div>
                            <div>
                              <Switch 
                                checked={autoRegisterTechnicians}
                                onCheckedChange={toggleAutoRegister}
                                disabled={isLoadingSystem}
                              />
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">Autenticação de Dois Fatores</h4>
                              <p className="text-sm text-muted-foreground">Exigir 2FA para administradores</p>
                            </div>
                            <div>
                              <Switch 
                                checked={require2FA}
                                onCheckedChange={toggleRequire2FA}
                                disabled={isLoadingSystem}
                              />
                            </div>
                          </div>
                          
                          <button 
                            className="w-full px-4 py-2 border border-gray-300 rounded-md text-sm"
                            onClick={advancedSecuritySettings}
                          >
                            Configurações Avançadas de Segurança
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Card de Logs */}
                    <Card className="shadow-sm">
                      <CardHeader className="p-4 border-b">
                        <CardTitle className="text-lg flex items-center">
                          <FileCode className="h-4 w-4 mr-2 text-primary" />
                          Configurações de Logs
                        </CardTitle>
                        <CardDescription>
                          Configure como os registros do sistema são armazenados
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">Nível de Detalhe</h4>
                              <p className="text-sm text-muted-foreground">Quantidade de informação registrada nos logs</p>
                            </div>
                            <div className="relative">
                              <select 
                                className="pl-3 pr-8 py-1 border rounded text-sm appearance-none bg-white"
                                value={logLevel}
                                onChange={(e) => {
                                  handleLogLevelChange(e.target.value);
                                }}
                              >
                                <option value="low">Básico</option>
                                <option value="medium">Médio</option>
                                <option value="high">Detalhado</option>
                              </select>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">Retenção de Logs</h4>
                              <p className="text-sm text-muted-foreground">Período de armazenamento dos registros</p>
                            </div>
                            <div className="relative">
                              <select 
                                className="pl-3 pr-8 py-1 border rounded text-sm appearance-none bg-white"
                                value={logRetention}
                                onChange={(e) => {
                                  handleLogRetentionChange(e.target.value);
                                }}
                              >
                                <option value="30">30 dias</option>
                                <option value="90">90 dias</option>
                                <option value="180">6 meses</option>
                                <option value="365">1 ano</option>
                              </select>
                            </div>
                          </div>
                          
                          <button 
                            className="w-full px-4 py-2 border border-gray-300 rounded-md text-sm"
                            onClick={viewAuditLogs}
                          >
                            Ver Registros de Auditoria
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Card de Manutenção */}
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
                          <div className="grid grid-cols-2 gap-2">
                            <button 
                              className="px-3 py-2 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50"
                              onClick={verifyDatabaseIntegrity}
                              disabled={isLoadingSystem}
                            >
                              Verificar Integridade
                            </button>
                            <button 
                              className="px-3 py-2 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50"
                              onClick={optimizeIndexes}
                              disabled={isLoadingSystem}
                            >
                              Otimizar Índices
                            </button>
                            <button 
                              className="px-3 py-2 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50"
                              onClick={clearCache}
                              disabled={isLoadingSystem}
                            >
                              Limpar Cache
                            </button>
                            <button 
                              className="px-3 py-2 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50"
                              onClick={rebuildIndexes}
                              disabled={isLoadingSystem}
                            >
                              Reconstruir Índices
                            </button>
                          </div>
                          
                          <button 
                            className="w-full px-4 py-2 border border-gray-300 rounded-md text-sm mt-2"
                            onClick={openAdvancedPanel}
                            disabled={isLoadingSystem}
                          >
                            Painel de Manutenção Avançada
                          </button>
                          
                          {isLoadingSystem && (
                            <div className="flex justify-center">
                              <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            </div>
                          )}
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
      
      {/* Componente modal de configurações avançadas de segurança */}
      <AdvancedSecuritySettings 
        open={showAdvancedSecuritySettings} 
        onClose={() => setShowAdvancedSecuritySettings(false)} 
      />
    </Card>
  );
}