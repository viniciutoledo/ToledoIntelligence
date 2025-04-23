import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Crown, Save, RefreshCw } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

// Tipo PlanPricing importado do esquema
type PlanPricing = {
  id: number;
  subscription_tier: "none" | "basic" | "intermediate";
  name: string;
  price: number; // Armazenado em centavos
  currency: "USD" | "BRL";
  description: string | null;
  created_at: Date;
  updated_at: Date;
};

// Schema para validação de formulário
const pricingFormSchema = z.object({
  subscription_tier: z.enum(["none", "basic", "intermediate"]),
  name: z.string().min(1, "Nome é obrigatório"),
  price: z.coerce.number().int().min(0, "O preço deve ser um número positivo"),
  currency: z.enum(["USD", "BRL"]),
  description: z.string().nullable().optional(),
});

export default function PlanPricing() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("basic");

  // Buscar preços dos planos
  const { data: planPricing, isLoading: pricingLoading } = useQuery({
    queryKey: ['/api/plans/pricing'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/plans/pricing`);
      return await response.json() as PlanPricing[];
    },
  });

  // Editar preço do plano
  const updatePriceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: Partial<PlanPricing> }) => {
      const response = await apiRequest('PUT', `/api/admin/plans/pricing/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Preço atualizado",
        description: "O preço do plano foi atualizado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/plans/pricing'] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar preço",
        description: error.message || "Ocorreu um erro ao atualizar o preço do plano",
        variant: "destructive",
      });
    },
  });

  // Criar preço do plano (caso não exista)
  const createPriceMutation = useMutation({
    mutationFn: async (data: Omit<PlanPricing, 'id' | 'created_at' | 'updated_at'>) => {
      const response = await apiRequest('POST', `/api/admin/plans/pricing`, data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Preço criado",
        description: "O preço do plano foi criado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/plans/pricing'] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar preço",
        description: error.message || "Ocorreu um erro ao criar o preço do plano",
        variant: "destructive",
      });
    },
  });

  // Função para renderizar o formulário de um plano
  const renderPlanForm = (tier: "basic" | "intermediate") => {
    const pricingData = planPricing?.find(p => p.subscription_tier === tier);
    
    const form = useForm<z.infer<typeof pricingFormSchema>>({
      resolver: zodResolver(pricingFormSchema),
      defaultValues: {
        subscription_tier: tier,
        name: pricingData?.name || (tier === "basic" ? "Plano Básico" : "Plano Intermediário"),
        price: pricingData ? pricingData.price / 100 : tier === "basic" ? 29.90 : 39.90, // Converter de centavos para reais
        currency: pricingData?.currency || "BRL",
        description: pricingData?.description || null,
      },
    });

    const onSubmit = (values: z.infer<typeof pricingFormSchema>) => {
      // Converter o preço de reais para centavos
      const priceInCents = Math.round(values.price * 100);
      const data = { ...values, price: priceInCents };
      
      if (pricingData) {
        updatePriceMutation.mutate({
          id: pricingData.id,
          data
        });
      } else {
        createPriceMutation.mutate(data);
      }
    };

    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Plano</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome do plano" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preço</FormLabel>
                  <FormControl>
                    <div className="flex">
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Preço do plano"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Preço em valores reais (29.90, 39.90)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Moeda</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a moeda" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="BRL">Real (BRL)</SelectItem>
                    <SelectItem value="USD">Dólar (USD)</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição (opcional)</FormLabel>
                <FormControl>
                  <Input placeholder="Descrição do plano" {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button 
            type="submit" 
            className="w-full" 
            disabled={updatePriceMutation.isPending || createPriceMutation.isPending}
          >
            {updatePriceMutation.isPending || createPriceMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salvar Preço do Plano
              </>
            )}
          </Button>
        </form>
      </Form>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Preços dos Planos</CardTitle>
          <CardDescription>
            Gerencie os preços dos planos de assinatura
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pricingLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
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
                {renderPlanForm("basic")}
              </TabsContent>
              
              <TabsContent value="intermediate" className="space-y-4 mt-4">
                {renderPlanForm("intermediate")}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
        <CardFooter className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Última atualização: {
              pricingLoading ? "Carregando..." : 
              planPricing && planPricing.length > 0 ? 
              new Date(Math.max(...planPricing.map(p => new Date(p.updated_at).getTime()))).toLocaleString() :
              "Nunca"
            }
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/plans/pricing'] })}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}