import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Trash2, Crown, Plus, Check, Loader2, Save, Users } from "lucide-react";
import { cn } from "@/lib/utils";

// Componente para exibir o preço do plano de forma dinâmica
type PlanPriceBadgeProps = {
  tier: "basic" | "intermediate";
};

function PlanPriceBadge({ tier }: PlanPriceBadgeProps) {
  const { data: pricing, isLoading } = useQuery({
    queryKey: ['/api/plans/pricing', tier],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/plans/pricing?tier=${tier}`);
      return await response.json();
    },
  });

  const getBadgeClasses = () => {
    return tier === "basic" 
      ? "bg-blue-100 text-blue-800 hover:bg-blue-100"
      : "bg-amber-100 text-amber-800 hover:bg-amber-100";
  };

  if (isLoading) {
    return (
      <Badge className={`ml-2 ${getBadgeClasses()} animate-pulse`}>
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        Carregando...
      </Badge>
    );
  }

  if (!pricing) {
    return null;
  }

  // Formatar preço de centavos para reais com o símbolo da moeda
  const formattedPrice = pricing.currency === "BRL"
    ? `R$${(pricing.price / 100).toFixed(2).replace('.', ',')}`
    : `$${(pricing.price / 100).toFixed(2)}`;

  return (
    <Badge className={`ml-2 ${getBadgeClasses()}`}>
      {formattedPrice}
    </Badge>
  );
}

type PlanFeature = {
  id: number;
  subscription_tier: 'none' | 'basic' | 'intermediate';
  feature_key: string;
  feature_name: string;
  feature_description: string | null;
  is_enabled: boolean;
  created_at: Date;
  updated_at: Date;
};

type Message = {
  id: number;
  created_at: Date;
  user_id: number;
  session_id: number;
  message_type: 'text' | 'image' | 'file';
  content: string | null;
  file_url: string | null;
  is_user: boolean;
};

type User = {
  id: number;
  email: string;
  role: 'technician' | 'admin';
  subscription_tier: 'none' | 'basic' | 'intermediate';
  message_count: number;
  max_messages: number;
  is_blocked: boolean;
  created_at: Date;
  updated_at: Date;
  last_login: Date | null;
};

// Tipo para os limites de mensagens por plano
type PlanMessageLimit = {
  tier: 'none' | 'basic' | 'intermediate';
  limit: number;
  defaultLimit: number;
};

export default function PlanManagement() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("basic");
  const [activeMainTab, setActiveMainTab] = useState<string>("precos");
  const [newFeature, setNewFeature] = useState({
    feature_key: "",
    feature_name: "",
    feature_description: "",
    subscription_tier: "basic" as "none" | "basic" | "intermediate",
    is_enabled: true
  });
  const [messageLimits, setMessageLimits] = useState<{
    [key: string]: number | undefined
  }>({
    none: undefined,
    basic: undefined,
    intermediate: undefined
  });
  
  // Query para buscar os limites de mensagens dos planos
  const { data: planMessageLimits, isLoading: limitsLoading } = useQuery({
    queryKey: ['/api/admin/plans/message-limits'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/plans/message-limits');
      return await response.json() as PlanMessageLimit[];
    },
  });
  
  // Mutation para atualizar o limite de mensagens de um plano
  const updateLimitMutation = useMutation({
    mutationFn: async ({ tier, limit }: { tier: string, limit: number }) => {
      const response = await apiRequest('PUT', `/api/admin/plans/message-limits/${tier}`, { limit });
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Limite atualizado",
        description: `Limite de mensagens para o plano ${getPlanName(data.tier)} atualizado para ${data.limit} mensagens.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/plans/message-limits'] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar limite",
        description: error.message || "Ocorreu um erro ao atualizar o limite de mensagens",
        variant: "destructive",
      });
    },
  });

  // Buscar recursos dos planos
  const { data: basicFeatures, isLoading: basicLoading } = useQuery({
    queryKey: ['/api/plans/features', 'basic'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/plans/features?tier=basic`);
      return await response.json() as PlanFeature[];
    },
  });

  const { data: intermediateFeatures, isLoading: intermediateLoading } = useQuery({
    queryKey: ['/api/plans/features', 'intermediate'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/plans/features?tier=intermediate`);
      return await response.json() as PlanFeature[];
    },
  });

  // Buscar estatísticas dos planos
  const { data: planStats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/plans/statistics'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/plans/statistics`);
      return await response.json();
    },
  });

  // Adicionar novo recurso
  const addFeatureMutation = useMutation({
    mutationFn: async (feature: typeof newFeature) => {
      const response = await apiRequest('POST', '/api/plans/features', feature);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Recurso adicionado",
        description: "O novo recurso foi adicionado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/plans/features'] });
      setNewFeature({
        feature_key: "",
        feature_name: "",
        feature_description: "",
        subscription_tier: activeTab as "none" | "basic" | "intermediate",
        is_enabled: true
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao adicionar recurso",
        description: error.message || "Ocorreu um erro ao adicionar o recurso",
        variant: "destructive",
      });
    },
  });

  // Atualizar status do recurso
  const updateFeatureMutation = useMutation({
    mutationFn: async ({ id, is_enabled }: { id: number, is_enabled: boolean }) => {
      const response = await apiRequest('PATCH', `/api/plans/features/${id}`, { is_enabled });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Recurso atualizado",
        description: "O status do recurso foi atualizado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/plans/features'] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar recurso",
        description: error.message || "Ocorreu um erro ao atualizar o status do recurso",
        variant: "destructive",
      });
    },
  });

  // Remover recurso
  const deleteFeatureMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/plans/features/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Recurso removido",
        description: "O recurso foi removido com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/plans/features'] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover recurso",
        description: error.message || "Ocorreu um erro ao remover o recurso",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação básica
    if (!newFeature.feature_key || !newFeature.feature_name) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha pelo menos a chave e o nome do recurso",
        variant: "destructive",
      });
      return;
    }
    
    addFeatureMutation.mutate({
      ...newFeature,
      subscription_tier: activeTab as "none" | "basic" | "intermediate"
    });
  };

  const formatUserCount = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };
  
  const getPlanName = (tier: string): string => {
    switch (tier) {
      case "none": return "Gratuito";
      case "basic": return "Básico";
      case "intermediate": return "Intermediário";
      default: return tier;
    }
  };
  
  // Atualizar o estado dos limites de mensagens quando os dados são carregados
  useEffect(() => {
    if (planMessageLimits) {
      const limits: {[key: string]: number} = {};
      planMessageLimits.forEach(plan => {
        limits[plan.tier] = plan.limit;
      });
      setMessageLimits(limits);
    }
  }, [planMessageLimits]);

  useEffect(() => {
    setNewFeature(prev => ({
      ...prev,
      subscription_tier: activeTab as "none" | "basic" | "intermediate"
    }));
  }, [activeTab]);
  
  // Handler para atualizar o limite de mensagens
  const handleUpdateLimit = (tier: "none" | "basic" | "intermediate") => {
    const limit = messageLimits[tier];
    if (limit === undefined) return;
    
    updateLimitMutation.mutate({ tier, limit });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-primary-800">
          Planos e Assinaturas
        </h2>
      </div>
      
      {/* Tabs para navegação principal */}
      <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="precos">Preços e Recursos</TabsTrigger>
          <TabsTrigger value="mensagens">Limites de Mensagens</TabsTrigger>
        </TabsList>
        
        <TabsContent value="mensagens" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Limites de Mensagens por Plano</CardTitle>
              <CardDescription>
                Defina quantas mensagens cada plano pode enviar por mês. Uma mensagem é contada como a combinação do envio + resposta do sistema.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {limitsLoading ? (
                <div className="text-center py-10">
                  <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mx-auto" />
                  <p className="mt-2 text-muted-foreground">Carregando limites de mensagens...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Plano Gratuito */}
                  <div className="bg-gray-50 dark:bg-gray-900/40 p-4 rounded-lg border">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
                      <div>
                        <h3 className="text-lg font-medium">Plano Gratuito</h3>
                        <p className="text-sm text-muted-foreground">
                          Limite de mensagens para usuários sem assinatura
                        </p>
                      </div>
                      <Badge className="mt-2 md:mt-0 bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100">
                        <Users className="mr-1 h-3.5 w-3.5" />
                        {statsLoading ? "..." : formatUserCount(planStats?.none_users || 0)} usuários
                      </Badge>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center justify-between mb-2">
                          <Label htmlFor="none-limit" className="text-sm">
                            Limite de mensagens:
                          </Label>
                          <span className="text-sm font-medium">
                            {messageLimits.none?.toLocaleString() || "..."} mensagens
                          </span>
                        </div>
                        <Input
                          id="none-limit"
                          type="number"
                          min="0"
                          className="w-full"
                          value={messageLimits.none === undefined ? "" : messageLimits.none}
                          onChange={(e) => setMessageLimits(prev => ({
                            ...prev,
                            none: e.target.value ? parseInt(e.target.value) : undefined
                          }))}
                        />
                      </div>
                      <Button 
                        onClick={() => handleUpdateLimit("none")}
                        disabled={messageLimits.none === undefined || updateLimitMutation.isPending}
                      >
                        {updateLimitMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        Salvar
                      </Button>
                    </div>
                  </div>
                  
                  {/* Plano Básico */}
                  <div className="bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-100 dark:border-blue-900/20">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
                      <div>
                        <h3 className="text-lg font-medium">Plano Básico</h3>
                        <p className="text-sm text-muted-foreground">
                          Limite de mensagens para assinantes do plano básico
                        </p>
                      </div>
                      <Badge className="mt-2 md:mt-0 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                        <Users className="mr-1 h-3.5 w-3.5" />
                        {statsLoading ? "..." : formatUserCount(planStats?.basic_users || 0)} usuários
                      </Badge>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center justify-between mb-2">
                          <Label htmlFor="basic-limit" className="text-sm">
                            Limite de mensagens:
                          </Label>
                          <span className="text-sm font-medium">
                            {messageLimits.basic?.toLocaleString() || "..."} mensagens
                          </span>
                        </div>
                        <Input
                          id="basic-limit"
                          type="number"
                          min="0"
                          className="w-full"
                          value={messageLimits.basic === undefined ? "" : messageLimits.basic}
                          onChange={(e) => setMessageLimits(prev => ({
                            ...prev,
                            basic: e.target.value ? parseInt(e.target.value) : undefined
                          }))}
                        />
                      </div>
                      <Button 
                        onClick={() => handleUpdateLimit("basic")}
                        disabled={messageLimits.basic === undefined || updateLimitMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        {updateLimitMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        Salvar
                      </Button>
                    </div>
                  </div>
                  
                  {/* Plano Intermediário */}
                  <div className="bg-amber-50/50 dark:bg-amber-900/10 p-4 rounded-lg border border-amber-100 dark:border-amber-900/20">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
                      <div>
                        <h3 className="text-lg font-medium flex items-center">
                          Plano Intermediário
                          <Crown className="ml-2 h-4 w-4 text-amber-500" />
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Limite de mensagens para assinantes do plano intermediário
                        </p>
                      </div>
                      <Badge className="mt-2 md:mt-0 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100">
                        <Users className="mr-1 h-3.5 w-3.5" />
                        {statsLoading ? "..." : formatUserCount(planStats?.intermediate_users || 0)} usuários
                      </Badge>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center justify-between mb-2">
                          <Label htmlFor="intermediate-limit" className="text-sm">
                            Limite de mensagens:
                          </Label>
                          <span className="text-sm font-medium">
                            {messageLimits.intermediate?.toLocaleString() || "..."} mensagens
                          </span>
                        </div>
                        <Input
                          id="intermediate-limit"
                          type="number"
                          min="0"
                          className="w-full"
                          value={messageLimits.intermediate === undefined ? "" : messageLimits.intermediate}
                          onChange={(e) => setMessageLimits(prev => ({
                            ...prev,
                            intermediate: e.target.value ? parseInt(e.target.value) : undefined
                          }))}
                        />
                      </div>
                      <Button 
                        onClick={() => handleUpdateLimit("intermediate")}
                        disabled={messageLimits.intermediate === undefined || updateLimitMutation.isPending}
                        className="bg-amber-600 hover:bg-amber-700 text-white"
                      >
                        {updateLimitMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        Salvar
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="precos">
          {/* Cards de resumo */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Plano Gratuito</CardTitle>
                <CardDescription>Usuários sem assinatura</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statsLoading ? "..." : formatUserCount(planStats?.none_users || 0)}
                  <span className="text-xs font-normal text-muted-foreground ml-2">
                    usuários
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {statsLoading ? "..." : (planStats?.none_percent || 0).toFixed(1)}% do total
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Plano Básico
                  <PlanPriceBadge tier="basic" />
                </CardTitle>
                <CardDescription>2.500 mensagens por mês</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statsLoading ? "..." : formatUserCount(planStats?.basic_users || 0)}
                  <span className="text-xs font-normal text-muted-foreground ml-2">
                    usuários
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {statsLoading ? "..." : (planStats?.basic_percent || 0).toFixed(1)}% do total
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Plano Intermediário
                  <PlanPriceBadge tier="intermediate" />
                </CardTitle>
                <CardDescription>5.000 mensagens por mês</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {statsLoading ? "..." : formatUserCount(planStats?.intermediate_users || 0)}
                  <span className="text-xs font-normal text-muted-foreground ml-2">
                    usuários
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {statsLoading ? "..." : (planStats?.intermediate_percent || 0).toFixed(1)}% do total
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Gerenciamento de recursos dos planos */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Recursos dos Planos</CardTitle>
              <CardDescription>
                Gerencie os recursos disponíveis em cada plano de assinatura
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="basic">
                    Básico
                  </TabsTrigger>
                  <TabsTrigger value="intermediate">
                    Intermediário
                    <Crown className="ml-1 h-3.5 w-3.5 text-amber-500" />
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="basic" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    {basicLoading ? (
                      <p className="text-center py-4 text-muted-foreground">Carregando recursos...</p>
                    ) : basicFeatures && basicFeatures.length > 0 ? (
                      basicFeatures.map((feature) => (
                        <div
                          key={feature.id}
                          className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border rounded-md hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition-colors"
                        >
                          <div className="flex-1 w-full mb-3 md:mb-0">
                            <div className="flex items-center">
                              <h4 className="font-medium text-lg">{feature.feature_name}</h4>
                              {feature.is_enabled && (
                                <Badge className="ml-2 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                                  <Check className="mr-1 h-3 w-3" />
                                  Ativo
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1 mb-2">
                              {feature.feature_description || "Sem descrição"}
                            </p>
                          </div>
                          <div className="flex items-center space-x-3 self-end md:self-auto w-full md:w-auto justify-end">
                            <div className="flex items-center space-x-2">
                              <Switch
                                id={`feature-${feature.id}`}
                                checked={feature.is_enabled}
                                onCheckedChange={(checked) =>
                                  updateFeatureMutation.mutate({ id: feature.id, is_enabled: checked })
                                }
                              />
                              <Label htmlFor={`feature-${feature.id}`} className="text-sm font-medium">
                                {feature.is_enabled ? "Ativo" : "Inativo"}
                              </Label>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive border-destructive/20 hover:bg-destructive/10"
                              onClick={() => {
                                if (window.confirm("Tem certeza que deseja excluir este recurso? Esta ação não pode ser desfeita.")) {
                                  deleteFeatureMutation.mutate(feature.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Remover
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center py-4 text-muted-foreground">
                        Não há recursos para o plano Básico
                      </p>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="intermediate" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    {intermediateLoading ? (
                      <p className="text-center py-4 text-muted-foreground">Carregando recursos...</p>
                    ) : intermediateFeatures && intermediateFeatures.length > 0 ? (
                      intermediateFeatures.map((feature) => (
                        <div
                          key={feature.id}
                          className={cn(
                            "flex flex-col md:flex-row items-start md:items-center justify-between p-4 border rounded-md hover:bg-amber-50/30 dark:hover:bg-amber-900/20 transition-colors",
                            feature.is_enabled && "border-amber-200 bg-amber-50/30 dark:bg-amber-900/10 dark:border-amber-700/40"
                          )}
                        >
                          <div className="flex-1 w-full mb-3 md:mb-0">
                            <div className="flex items-center">
                              <h4 className="font-medium text-lg">{feature.feature_name}</h4>
                              {feature.is_enabled && (
                                <Badge className="ml-2 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100">
                                  <Crown className="mr-1 h-3 w-3" />
                                  Premium
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1 mb-2">
                              {feature.feature_description || "Sem descrição"}
                            </p>
                          </div>
                          <div className="flex items-center space-x-3 self-end md:self-auto w-full md:w-auto justify-end">
                            <div className="flex items-center space-x-2">
                              <Switch
                                id={`feature-${feature.id}`}
                                checked={feature.is_enabled}
                                onCheckedChange={(checked) =>
                                  updateFeatureMutation.mutate({ id: feature.id, is_enabled: checked })
                                }
                              />
                              <Label htmlFor={`feature-${feature.id}`} className="text-sm font-medium">
                                {feature.is_enabled ? "Ativo" : "Inativo"}
                              </Label>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive border-destructive/20 hover:bg-destructive/10"
                              onClick={() => {
                                if (window.confirm("Tem certeza que deseja excluir este recurso? Esta ação não pode ser desfeita.")) {
                                  deleteFeatureMutation.mutate(feature.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Remover
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center py-4 text-muted-foreground">
                        Não há recursos para o plano Intermediário
                      </p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
              
              {/* Formulário para adicionar novo recurso - simplificado */}
              <div className="mt-8 border-t pt-6">
                <h3 className="text-lg font-medium mb-4 flex items-center">
                  <Plus className="mr-2 h-5 w-5 text-primary" />
                  {activeTab === "basic" 
                    ? "Adicionar novo recurso ao plano Básico" 
                    : "Adicionar novo recurso ao plano Intermediário"}
                </h3>
                
                <form onSubmit={handleSubmit} className="space-y-5 bg-gray-50 dark:bg-gray-900/40 p-5 rounded-lg border">
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="feature_key">Chave do Recurso</Label>
                      <Input
                        id="feature_key"
                        placeholder="ex: advanced_analytics"
                        value={newFeature.feature_key}
                        onChange={(e) => setNewFeature(prev => ({ ...prev, feature_key: e.target.value }))}
                      />
                      <p className="text-xs text-muted-foreground mt-1">Identificador único para o recurso (sem espaços)</p>
                    </div>
                    
                    <div>
                      <Label htmlFor="feature_name">Nome do Recurso</Label>
                      <Input
                        id="feature_name"
                        placeholder="ex: Análise Avançada"
                        value={newFeature.feature_name}
                        onChange={(e) => setNewFeature(prev => ({ ...prev, feature_name: e.target.value }))}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="feature_description">Descrição</Label>
                      <Textarea
                        id="feature_description"
                        placeholder="Descreva o recurso..."
                        value={newFeature.feature_description}
                        onChange={(e) => setNewFeature(prev => ({ ...prev, feature_description: e.target.value }))}
                      />
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="is_enabled"
                        checked={newFeature.is_enabled}
                        onCheckedChange={(checked) => setNewFeature(prev => ({ ...prev, is_enabled: checked }))}
                      />
                      <Label htmlFor="is_enabled">Ativar recurso</Label>
                    </div>
                  </div>
                  
                  <Button type="submit" disabled={addFeatureMutation.isPending}>
                    {addFeatureMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adicionando...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar Recurso
                      </>
                    )}
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}