import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, CheckCircle, Crown, FileUp, MessageCircle, MessageSquareDiff, PieChart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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

type MessageLimit = {
  hasReachedLimit: boolean;
  messageCount: number;
  maxMessages: number;
  remainingMessages: number;
};

export default function PlanResources() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [featureAccess, setFeatureAccess] = useState<Record<string, boolean>>({});

  // Buscar recursos disponíveis para o plano do usuário
  const { data: features, isLoading: featuresLoading } = useQuery({
    queryKey: ['/api/plans/features', user?.subscription_tier],
    queryFn: async () => {
      if (!user) return [];
      const response = await apiRequest('GET', `/api/plans/features?tier=${user.subscription_tier}`);
      return await response.json() as PlanFeature[];
    },
    enabled: !!user,
  });

  // Buscar limite de mensagens
  const { data: messageLimit, isLoading: limitLoading } = useQuery({
    queryKey: ['/api/user/check-message-limit'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/user/check-message-limit');
      return await response.json() as MessageLimit;
    },
    enabled: !!user,
    refetchInterval: 60000, // Atualizar a cada minuto
  });

  // Verificar acesso a recursos específicos
  useEffect(() => {
    if (!features || features.length === 0) return;

    const checkFeatureAccess = async () => {
      const accessMap: Record<string, boolean> = {};
      
      for (const feature of features.filter(f => f.is_enabled)) {
        try {
          const response = await apiRequest('GET', `/api/user/check-feature-access/${feature.feature_key}`);
          const { hasAccess } = await response.json();
          accessMap[feature.feature_key] = hasAccess;
        } catch (error) {
          console.error(`Erro ao verificar acesso ao recurso ${feature.feature_key}:`, error);
          accessMap[feature.feature_key] = false;
        }
      }
      
      setFeatureAccess(accessMap);
    };

    checkFeatureAccess();
  }, [features]);

  // Determinar o nome do plano
  const getPlanName = (tier: string | undefined) => {
    switch (tier) {
      case 'basic': return 'Plano Básico';
      case 'intermediate': return 'Plano Intermediário';
      default: return 'Plano Gratuito';
    }
  };

  // Determinar o preço do plano
  const getPlanPrice = (tier: string | undefined) => {
    switch (tier) {
      case 'basic': return 'R$29,90/mês';
      case 'intermediate': return 'R$39,90/mês';
      default: return 'Gratuito';
    }
  };

  // Ícones para os recursos
  const getFeatureIcon = (key: string) => {
    switch (key) {
      case 'reports': return <PieChart className="h-5 w-5" />;
      case 'report_exports': return <FileUp className="h-5 w-5" />;
      case 'priority_support': return <Crown className="h-5 w-5" />;
      case 'advanced_analysis': return <MessageSquareDiff className="h-5 w-5" />;
      default: return <CheckCircle className="h-5 w-5" />;
    }
  };

  // Cálculo de porcentagem do uso de mensagens
  const getMessageUsagePercentage = () => {
    if (!messageLimit) return 0;
    return (messageLimit.messageCount / messageLimit.maxMessages) * 100;
  };

  // Determinando a cor da barra de progresso
  const getProgressColor = () => {
    const percentage = getMessageUsagePercentage();
    if (percentage > 90) return 'bg-destructive';
    if (percentage > 70) return 'bg-amber-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            {user?.subscription_tier === 'intermediate' && (
              <Crown className="h-5 w-5 mr-2 text-amber-500" />
            )}
            {getPlanName(user?.subscription_tier)}
          </CardTitle>
          <CardDescription>
            {getPlanPrice(user?.subscription_tier)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Exibir limite de mensagens */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <MessageCircle className="h-4 w-4 mr-2" />
                <span className="text-sm font-medium">Uso de mensagens</span>
              </div>
              <div className="text-sm">
                {limitLoading ? (
                  <Skeleton className="h-4 w-20" />
                ) : (
                  <span>
                    {messageLimit?.messageCount} / {messageLimit?.maxMessages}
                  </span>
                )}
              </div>
            </div>
            {limitLoading ? (
              <Skeleton className="h-2 w-full" />
            ) : (
              <Progress
                value={getMessageUsagePercentage()}
                className="h-2"
                indicatorClassName={getProgressColor()}
              />
            )}
            {messageLimit?.hasReachedLimit && (
              <Alert variant="destructive" className="mt-2 py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Limite atingido</AlertTitle>
                <AlertDescription>
                  Você atingiu o limite de mensagens do seu plano. Considere fazer upgrade para continuar usando.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="pt-2">
            <h4 className="text-sm font-medium mb-3">Recursos disponíveis</h4>
            {featuresLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <div className="space-y-2">
                {features && features.filter(f => f.is_enabled).map((feature) => (
                  <div 
                    key={feature.id} 
                    className={`flex items-center p-2 rounded-md border ${
                      featureAccess[feature.feature_key] 
                        ? 'border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800' 
                        : 'border-muted bg-muted/20'
                    }`}
                  >
                    <div className={`mr-3 ${featureAccess[feature.feature_key] ? 'text-green-500' : 'text-muted-foreground'}`}>
                      {getFeatureIcon(feature.feature_key)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{feature.feature_name}</p>
                      {feature.feature_description && (
                        <p className="text-xs text-muted-foreground">{feature.feature_description}</p>
                      )}
                    </div>
                    {featureAccess[feature.feature_key] ? (
                      <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                        Disponível
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-muted text-muted-foreground">
                        Indisponível
                      </Badge>
                    )}
                  </div>
                ))}

                {features && features.filter(f => f.is_enabled).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum recurso disponível para seu plano atual.
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter>
          {user?.subscription_tier === 'none' && (
            <Button className="w-full" variant="default">
              Fazer upgrade do plano
            </Button>
          )}
          {user?.subscription_tier === 'basic' && (
            <Button className="w-full" variant="outline">
              <Crown className="mr-2 h-4 w-4" />
              Atualizar para o plano Intermediário
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}