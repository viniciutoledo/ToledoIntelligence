import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTier, setSelectedTier] = useState<'none' | 'basic' | 'intermediate'>('basic');
  const [newFeature, setNewFeature] = useState({
    feature_key: '',
    feature_name: '',
    feature_description: '',
    is_enabled: true
  });

  // Buscar recursos dos planos
  const { data: features, isLoading: featuresLoading } = useQuery({
    queryKey: ['/api/plans/features'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/plans/features');
      return await response.json() as PlanFeature[];
    },
  });

  // Buscar usuários para visualizar uso
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['/api/admin/users'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/users');
      return await response.json() as User[];
    },
  });

  // Filtrar recursos por plano selecionado
  const filteredFeatures = features?.filter(
    feature => feature.subscription_tier === selectedTier
  );

  // Mutation para atualizar um recurso
  const updateFeatureMutation = useMutation({
    mutationFn: async ({ featureId, data }: { featureId: number, data: Partial<PlanFeature> }) => {
      const response = await apiRequest('PUT', `/api/admin/plans/features/${featureId}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Recurso atualizado",
        description: "Recurso do plano atualizado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/plans/features'] });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o recurso. Tente novamente.",
        variant: "destructive",
      });
      console.error("Erro ao atualizar recurso:", error);
    }
  });

  // Mutation para adicionar um recurso
  const addFeatureMutation = useMutation({
    mutationFn: async (data: typeof newFeature & { subscription_tier: string }) => {
      const response = await apiRequest('POST', '/api/admin/plans/features', data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Recurso adicionado",
        description: "Novo recurso adicionado ao plano com sucesso.",
      });
      setNewFeature({
        feature_key: '',
        feature_name: '',
        feature_description: '',
        is_enabled: true
      });
      queryClient.invalidateQueries({ queryKey: ['/api/plans/features'] });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o recurso. Tente novamente.",
        variant: "destructive",
      });
      console.error("Erro ao adicionar recurso:", error);
    }
  });

  // Mutation para redefinir o contador de mensagens de um usuário
  const resetMessageCountMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest('POST', `/api/admin/users/${userId}/reset-message-count`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Contador redefinido",
        description: "Contador de mensagens redefinido com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Não foi possível redefinir o contador. Tente novamente.",
        variant: "destructive",
      });
      console.error("Erro ao redefinir contador:", error);
    }
  });

  // Mutation para atualizar o plano de um usuário
  const updateUserPlanMutation = useMutation({
    mutationFn: async ({ userId, tier }: { userId: number, tier: 'none' | 'basic' | 'intermediate' }) => {
      const response = await apiRequest('PUT', `/api/admin/users/${userId}/subscription`, { subscription_tier: tier });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Plano atualizado",
        description: "Plano do usuário atualizado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o plano. Tente novamente.",
        variant: "destructive",
      });
      console.error("Erro ao atualizar plano:", error);
    }
  });

  // Função para atualizar estado de um recurso
  const handleToggleFeature = (featureId: number, is_enabled: boolean) => {
    updateFeatureMutation.mutate({
      featureId,
      data: { is_enabled: !is_enabled }
    });
  };

  // Função para adicionar novo recurso
  const handleAddFeature = () => {
    if (!newFeature.feature_key || !newFeature.feature_name) {
      toast({
        title: "Campos incompletos",
        description: "Preencha pelo menos a chave e o nome do recurso.",
        variant: "destructive",
      });
      return;
    }

    addFeatureMutation.mutate({
      ...newFeature,
      subscription_tier: selectedTier
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gerenciamento de Planos</h2>
      </div>

      <Tabs defaultValue="features" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="features">Recursos dos Planos</TabsTrigger>
          <TabsTrigger value="users">Uso dos Usuários</TabsTrigger>
          <TabsTrigger value="limits">Limites e Quotas</TabsTrigger>
        </TabsList>

        {/* Aba de Recursos dos Planos */}
        <TabsContent value="features" className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Button 
              variant={selectedTier === 'none' ? 'default' : 'outline'} 
              onClick={() => setSelectedTier('none')}
              className="flex flex-col items-center p-6"
            >
              <span className="text-lg font-bold">Plano Gratuito</span>
              <span className="text-xs mt-1">Recursos básicos</span>
            </Button>
            <Button 
              variant={selectedTier === 'basic' ? 'default' : 'outline'} 
              onClick={() => setSelectedTier('basic')}
              className="flex flex-col items-center p-6"
            >
              <span className="text-lg font-bold">Plano Básico</span>
              <span className="text-xs mt-1">R$29,90/mês - 2500 interações</span>
            </Button>
            <Button 
              variant={selectedTier === 'intermediate' ? 'default' : 'outline'} 
              onClick={() => setSelectedTier('intermediate')}
              className="flex flex-col items-center p-6"
            >
              <span className="text-lg font-bold">Plano Intermediário</span>
              <span className="text-xs mt-1">R$39,90/mês - 5000 interações</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Recursos do Plano {selectedTier === 'none' ? 'Gratuito' : selectedTier === 'basic' ? 'Básico' : 'Intermediário'}</CardTitle>
                <CardDescription>
                  Gerencie os recursos disponíveis para este plano
                </CardDescription>
              </CardHeader>
              <CardContent>
                {featuresLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredFeatures && filteredFeatures.length > 0 ? (
                      <div className="grid grid-cols-1 gap-2">
                        {filteredFeatures.map((feature) => (
                          <div key={feature.id} className="flex items-center justify-between border p-3 rounded-md">
                            <div className="flex-1">
                              <h4 className="font-medium">{feature.feature_name}</h4>
                              <p className="text-sm text-muted-foreground">{feature.feature_description || 'Sem descrição'}</p>
                              <Badge variant="outline" className="mt-1">{feature.feature_key}</Badge>
                            </div>
                            <Switch
                              checked={feature.is_enabled}
                              onCheckedChange={() => handleToggleFeature(feature.id, feature.is_enabled)}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
                        Nenhum recurso cadastrado para este plano.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex flex-col">
                <div className="w-full border-t pt-4 mb-4">
                  <h4 className="font-medium mb-2">Adicionar novo recurso</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <Label htmlFor="feature_key">Chave do recurso</Label>
                      <Input
                        id="feature_key"
                        placeholder="Ex: reports_export"
                        value={newFeature.feature_key}
                        onChange={(e) => setNewFeature({...newFeature, feature_key: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="feature_name">Nome do recurso</Label>
                      <Input
                        id="feature_name"
                        placeholder="Ex: Exportação de relatórios"
                        value={newFeature.feature_name}
                        onChange={(e) => setNewFeature({...newFeature, feature_name: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2 mb-4">
                    <Label htmlFor="feature_description">Descrição (opcional)</Label>
                    <Input
                      id="feature_description"
                      placeholder="Descrição do recurso"
                      value={newFeature.feature_description}
                      onChange={(e) => setNewFeature({...newFeature, feature_description: e.target.value})}
                    />
                  </div>
                  <div className="flex items-center space-x-2 mb-4">
                    <Switch
                      id="feature_enabled"
                      checked={newFeature.is_enabled}
                      onCheckedChange={(checked) => setNewFeature({...newFeature, is_enabled: checked})}
                    />
                    <Label htmlFor="feature_enabled">Habilitado</Label>
                  </div>
                  <Button 
                    onClick={handleAddFeature} 
                    disabled={addFeatureMutation.isPending}
                    className="w-full"
                  >
                    {addFeatureMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Adicionar Recurso
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>

        {/* Aba de Uso dos Usuários */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Uso dos Planos por Usuário</CardTitle>
              <CardDescription>
                Visualize e gerencie limites de uso dos usuários
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <div className="space-y-4">
                  {users && users.filter(user => user.role === 'technician').length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-2 text-left">Usuário</th>
                            <th className="p-2 text-left">Plano</th>
                            <th className="p-2 text-left">Uso</th>
                            <th className="p-2 text-left">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.filter(user => user.role === 'technician').map((user) => (
                            <tr key={user.id} className="border-b">
                              <td className="p-2">{user.email}</td>
                              <td className="p-2">
                                <select
                                  className="p-1 border rounded"
                                  value={user.subscription_tier}
                                  onChange={(e) => updateUserPlanMutation.mutate({
                                    userId: user.id,
                                    tier: e.target.value as 'none' | 'basic' | 'intermediate'
                                  })}
                                >
                                  <option value="none">Gratuito</option>
                                  <option value="basic">Básico</option>
                                  <option value="intermediate">Intermediário</option>
                                </select>
                              </td>
                              <td className="p-2">
                                <div className="text-sm">
                                  <div className="flex items-center">
                                    <span className="font-medium">{user.message_count}</span>
                                    <span className="mx-1">/</span>
                                    <span>{user.max_messages}</span>
                                    <span className="ml-1 text-xs text-muted-foreground">mensagens</span>
                                  </div>
                                  <div className="w-full bg-muted rounded-full h-2 mt-1">
                                    <div 
                                      className={`h-2 rounded-full ${
                                        (user.message_count / user.max_messages) > 0.9 
                                          ? 'bg-destructive' 
                                          : (user.message_count / user.max_messages) > 0.7 
                                            ? 'bg-amber-500' 
                                            : 'bg-green-500'
                                      }`}
                                      style={{ 
                                        width: `${Math.min(100, (user.message_count / user.max_messages) * 100)}%` 
                                      }}
                                    ></div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  disabled={resetMessageCountMutation.isPending}
                                  onClick={() => resetMessageCountMutation.mutate(user.id)}
                                >
                                  {resetMessageCountMutation.isPending && resetMessageCountMutation.variables === user.id && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  )}
                                  Redefinir contador
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhum usuário técnico encontrado.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba de Limites e Quotas */}
        <TabsContent value="limits" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Plano Gratuito</CardTitle>
                <CardDescription>
                  Configurações do plano gratuito
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Limite de mensagens:</span>
                  <span className="font-medium">50</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Acesso a relatórios:</span>
                  <XCircle className="h-4 w-4 text-destructive" />
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Exportação:</span>
                  <XCircle className="h-4 w-4 text-destructive" />
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Suporte prioritário:</span>
                  <XCircle className="h-4 w-4 text-destructive" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Plano Básico</CardTitle>
                <CardDescription>
                  R$29,90/mês
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Limite de mensagens:</span>
                  <span className="font-medium">2500</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Acesso a relatórios básicos:</span>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Exportação:</span>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Suporte prioritário:</span>
                  <XCircle className="h-4 w-4 text-destructive" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Plano Intermediário</CardTitle>
                <CardDescription>
                  R$39,90/mês
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Limite de mensagens:</span>
                  <span className="font-medium">5000</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Acesso a relatórios avançados:</span>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Exportação avançada:</span>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Suporte prioritário:</span>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Configurações Globais</CardTitle>
              <CardDescription>
                Configurações que afetam todos os planos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max_messages_free">Mensagens - Plano Gratuito</Label>
                  <Input
                    id="max_messages_free"
                    type="number"
                    placeholder="50"
                    defaultValue={50}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_sessions_free">Sessões - Plano Gratuito</Label>
                  <Input
                    id="max_sessions_free"
                    type="number"
                    placeholder="3"
                    defaultValue={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_messages_basic">Mensagens - Plano Básico</Label>
                  <Input
                    id="max_messages_basic"
                    type="number"
                    placeholder="2500"
                    defaultValue={2500}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_sessions_basic">Sessões - Plano Básico</Label>
                  <Input
                    id="max_sessions_basic"
                    type="number"
                    placeholder="Ilimitado"
                    defaultValue={0}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_messages_intermediate">Mensagens - Plano Intermediário</Label>
                  <Input
                    id="max_messages_intermediate"
                    type="number"
                    placeholder="5000"
                    defaultValue={5000}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max_sessions_intermediate">Sessões - Plano Intermediário</Label>
                  <Input
                    id="max_sessions_intermediate"
                    type="number"
                    placeholder="Ilimitado"
                    defaultValue={0}
                  />
                </div>
              </div>
              <Button className="w-full mt-4">
                Salvar Configurações
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}