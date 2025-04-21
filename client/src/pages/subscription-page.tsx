import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: string;
  features: string[];
  messageLimit: number;
  recommended?: boolean;
}

export default function SubscriptionPage() {
  const { user } = useAuth();
  const { t, i18n } = useLanguage();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [messageCount, setMessageCount] = useState(0);
  const [messageLimit, setMessageLimit] = useState(0);

  // Texto baseado no idioma atual
  const isPortuguese = i18n.language === 'pt';

  // Planos de assinatura
  const plans: SubscriptionPlan[] = [
    {
      id: 'basic',
      name: isPortuguese ? 'Básico' : 'Basic',
      description: isPortuguese 
        ? 'Ideal para técnicos com volume moderado de manutenções' 
        : 'Ideal for technicians with moderate maintenance volume',
      price: isPortuguese ? 'R$ 29,90/mês' : 'R$ 29.90/month',
      features: isPortuguese
        ? [
            'Análise de placas de circuito',
            'Suporte a arquivos CAD',
            'Acesso ao suporte por email',
            '2.500 mensagens por mês'
          ]
        : [
            'Circuit board analysis',
            'CAD file support',
            'Email support',
            '2,500 messages per month'
          ],
      messageLimit: 2500
    },
    {
      id: 'intermediate',
      name: isPortuguese ? 'Intermediário' : 'Intermediate',
      description: isPortuguese 
        ? 'Perfeito para técnicos com maior volume de trabalho' 
        : 'Perfect for technicians with higher workload',
      price: isPortuguese ? 'R$ 39,90/mês' : 'R$ 39.90/month',
      features: isPortuguese
        ? [
            'Todas as funcionalidades do plano Básico',
            'Prioridade no suporte',
            'Análise avançada de componentes',
            '5.000 mensagens por mês'
          ]
        : [
            'All Basic plan features',
            'Priority support',
            'Advanced component analysis',
            '5,000 messages per month'
          ],
      messageLimit: 5000,
      recommended: true
    }
  ];

  // Buscar dados da assinatura atual do usuário
  useEffect(() => {
    if (!user) return;

    const fetchSubscriptionData = async () => {
      try {
        const response = await apiRequest('GET', '/api/user/subscription');
        const data = await response.json();
        
        setCurrentPlan(data.tier);
        setMessageCount(data.messageCount);
        setMessageLimit(data.maxMessages);
      } catch (error) {
        console.error('Erro ao buscar dados de assinatura:', error);
      }
    };

    fetchSubscriptionData();
  }, [user]);

  // Manipular a seleção de plano
  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId);
  };

  // Manipular o checkout
  const handleCheckout = async () => {
    if (!selectedPlan) return;
    
    setLoading(true);
    
    try {
      const response = await apiRequest('POST', '/api/subscription/checkout', {
        plan: selectedPlan
      });
      
      const { checkoutUrl } = await response.json();
      
      // Redirecionar para a página de checkout do Stripe
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      }
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('subscription.checkoutError'),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Manipular o cancelamento
  const handleCancelSubscription = async () => {
    if (!currentPlan || currentPlan === 'none') return;
    
    setLoading(true);
    
    try {
      await apiRequest('POST', '/api/subscription/cancel');
      
      toast({
        title: t('common.success'),
        description: t('subscription.cancelSuccess'),
      });
      
      // Atualizar o plano atual para refletir o cancelamento
      setCurrentPlan('none');
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('subscription.cancelError'),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-2">
        {t('subscription.title')}
      </h1>
      <p className="text-muted-foreground mb-8">
        {t('subscription.subtitle')}
      </p>

      {/* Status da assinatura atual */}
      <div className="bg-muted p-4 rounded-lg mb-8">
        <h2 className="font-medium mb-2">{t('subscription.currentStatus')}</h2>
        <div className="flex flex-col sm:flex-row gap-4">
          <div>
            <span className="text-muted-foreground">{t('subscription.currentPlan')}: </span>
            <span className="font-medium">
              {currentPlan === 'basic' ? (isPortuguese ? 'Básico' : 'Basic') : 
               currentPlan === 'intermediate' ? (isPortuguese ? 'Intermediário' : 'Intermediate') : 
               (isPortuguese ? 'Nenhum' : 'None')}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">{t('subscription.messageUsage')}: </span>
            <span className="font-medium">
              {messageCount} / {messageLimit === 0 ? '∞' : messageLimit}
            </span>
          </div>
        </div>
      </div>

      {/* Grade de planos */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {plans.map((plan) => (
          <Card 
            key={plan.id} 
            className={`relative ${
              selectedPlan === plan.id ? 'border-primary' : ''
            } ${
              plan.recommended ? 'border-blue-500' : ''
            }`}
          >
            {plan.recommended && (
              <Badge className="absolute top-4 right-4 bg-blue-500">
                {isPortuguese ? 'Recomendado' : 'Recommended'}
              </Badge>
            )}
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-4">{plan.price}</div>
              <ul className="space-y-2">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <Check className="h-5 w-5 text-green-500 mr-2 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                variant={selectedPlan === plan.id ? "default" : "outline"}
                onClick={() => handleSelectPlan(plan.id)}
                disabled={loading || (currentPlan === plan.id)}
              >
                {currentPlan === plan.id
                  ? (isPortuguese ? 'Plano Atual' : 'Current Plan')
                  : (isPortuguese ? 'Selecionar Plano' : 'Select Plan')}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Botões de ação */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        {selectedPlan && selectedPlan !== currentPlan && (
          <Button 
            size="lg"
            onClick={handleCheckout}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isPortuguese ? 'Continuar para Pagamento' : 'Continue to Payment'}
          </Button>
        )}
        
        {currentPlan && currentPlan !== 'none' && (
          <Button 
            variant="outline" 
            size="lg"
            onClick={handleCancelSubscription}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isPortuguese ? 'Cancelar Assinatura' : 'Cancel Subscription'}
          </Button>
        )}
      </div>
    </div>
  );
}