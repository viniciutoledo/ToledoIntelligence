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
import { Trash2, Crown, Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";

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

export default function PlanManagement() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("basic");
  const [newFeature, setNewFeature] = useState({
    feature_key: "",
    feature_name: "",
    feature_description: "",
    subscription_tier: "basic" as "none" | "basic" | "intermediate",
    is_enabled: true
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

  useEffect(() => {
    setNewFeature(prev => ({
      ...prev,
      subscription_tier: activeTab as "none" | "basic" | "intermediate"
    }));
  }, [activeTab]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-primary-800">
          {t("admin.plans")}
        </h2>
      </div>
      
      {/* Cards de resumo */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t("admin.freePlan")}</CardTitle>
            <CardDescription>{t("admin.usersWithoutSubscription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? "..." : formatUserCount(planStats?.none_users || 0)}
              <span className="text-xs font-normal text-muted-foreground ml-2">
                {t("admin.users").toLowerCase()}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {statsLoading ? "..." : (planStats?.none_percent || 0).toFixed(1)}% {t("admin.ofTotal")}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {t("admin.basicPlan")}
              <Badge className="ml-2 bg-blue-100 text-blue-800 hover:bg-blue-100">
                R$29,90
              </Badge>
            </CardTitle>
            <CardDescription>2.500 {t("admin.messagesPerMonth")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? "..." : formatUserCount(planStats?.basic_users || 0)}
              <span className="text-xs font-normal text-muted-foreground ml-2">
                {t("admin.users").toLowerCase()}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {statsLoading ? "..." : (planStats?.basic_percent || 0).toFixed(1)}% {t("admin.ofTotal")}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {t("admin.intermediatePlan")}
              <Badge className="ml-2 bg-amber-100 text-amber-800 hover:bg-amber-100">
                R$39,90
              </Badge>
            </CardTitle>
            <CardDescription>5.000 {t("admin.messagesPerMonth")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? "..." : formatUserCount(planStats?.intermediate_users || 0)}
              <span className="text-xs font-normal text-muted-foreground ml-2">
                {t("admin.users").toLowerCase()}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {statsLoading ? "..." : (planStats?.intermediate_percent || 0).toFixed(1)}% {t("admin.ofTotal")}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Gerenciamento de recursos dos planos */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>{t("admin.planFeatures")}</CardTitle>
          <CardDescription>
            {t("admin.managePlanFeatures")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic">
                {t("admin.basic")}
              </TabsTrigger>
              <TabsTrigger value="intermediate">
                {t("admin.intermediate")}
                <Crown className="ml-1 h-3.5 w-3.5 text-amber-500" />
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="space-y-4">
                {basicLoading ? (
                  <p className="text-center py-4 text-muted-foreground">{t("admin.loadingFeatures")}</p>
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
                              {t("admin.active")}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 mb-2">
                          {feature.feature_description || t("admin.noDescription")}
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
                            {feature.is_enabled ? t("admin.active") : t("admin.inactive")}
                          </Label>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive border-destructive/20 hover:bg-destructive/10"
                          onClick={() => {
                            if (window.confirm(t("admin.confirmDeleteFeature"))) {
                              deleteFeatureMutation.mutate(feature.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          {t("common.remove")}
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-4 text-muted-foreground">
                    {t("admin.noBasicPlanFeatures")}
                  </p>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="intermediate" className="space-y-4 mt-4">
              <div className="space-y-4">
                {intermediateLoading ? (
                  <p className="text-center py-4 text-muted-foreground">{t("admin.loadingFeatures")}</p>
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
                              {t("admin.premium")}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 mb-2">
                          {feature.feature_description || t("admin.noDescription")}
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
                            {feature.is_enabled ? t("admin.active") : t("admin.inactive")}
                          </Label>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive border-destructive/20 hover:bg-destructive/10"
                          onClick={() => {
                            if (window.confirm(t("admin.confirmDeleteFeature"))) {
                              deleteFeatureMutation.mutate(feature.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          {t("common.remove")}
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-4 text-muted-foreground">
                    {t("admin.noIntermediatePlanFeatures")}
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
                ? t("admin.addNewBasicFeature") 
                : t("admin.addNewPremiumFeature")}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-5 bg-gray-50 dark:bg-gray-900/40 p-5 rounded-lg border">
              <div className="space-y-3">
                <Label htmlFor="feature_name" className="text-base font-medium">{t("admin.featureName")}</Label>
                <Input
                  id="feature_name"
                  placeholder={activeTab === "basic" 
                    ? t("admin.featureNamePlaceholderBasic") 
                    : t("admin.featureNamePlaceholderPremium")}
                  value={newFeature.feature_name}
                  onChange={(e) =>
                    setNewFeature({ ...newFeature, feature_name: e.target.value })
                  }
                  className="text-base"
                />
                <p className="text-sm text-muted-foreground">{t("admin.featureNameHelp")}</p>
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="feature_description" className="text-base font-medium">
                  {t("admin.featureDescription")} <span className="text-sm font-normal text-muted-foreground">({t("common.optional")})</span>
                </Label>
                <Textarea
                  id="feature_description"
                  placeholder={t("admin.featureDescriptionPlaceholder")}
                  value={newFeature.feature_description}
                  onChange={(e) =>
                    setNewFeature({ ...newFeature, feature_description: e.target.value })
                  }
                  rows={2}
                  className="text-base"
                />
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="feature_key" className="text-base font-medium">{t("admin.technicalID")}</Label>
                <Input
                  id="feature_key"
                  placeholder={activeTab === "basic" ? "interaction_limit" : "priority_support"}
                  value={newFeature.feature_key}
                  onChange={(e) =>
                    setNewFeature({ ...newFeature, feature_key: e.target.value })
                  }
                  className="font-mono text-sm"
                />
                <p className="text-sm text-muted-foreground">{t("admin.technicalIDHelp")}</p>
              </div>
              
              <div className="flex items-center space-x-2 p-3 bg-white dark:bg-gray-900 rounded border">
                <Switch
                  id="is_enabled"
                  checked={newFeature.is_enabled}
                  onCheckedChange={(checked) =>
                    setNewFeature({ ...newFeature, is_enabled: checked })
                  }
                />
                <Label htmlFor="is_enabled" className="font-medium">
                  {newFeature.is_enabled 
                    ? t("admin.featureWillBeEnabled") 
                    : t("admin.featureWillBeDisabled")}
                </Label>
              </div>
              
              <div className="pt-2 flex justify-end">
                <Button 
                  type="submit" 
                  disabled={addFeatureMutation.isPending}
                  size="lg"
                  className={cn(
                    "px-8",
                    activeTab === "intermediate" && "bg-amber-600 hover:bg-amber-700"
                  )}
                >
                  {addFeatureMutation.isPending ? (
                    <div className="flex items-center">
                      <div className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                      <span>{t("admin.adding")}</span>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <Plus className="mr-2 h-4 w-4" />
                      <span>{t("admin.addFeature")}</span>
                    </div>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}