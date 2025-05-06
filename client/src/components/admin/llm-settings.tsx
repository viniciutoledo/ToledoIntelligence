import { useState, useEffect } from "react";
import { useLanguage } from "@/hooks/use-language";
import { useLlm } from "@/hooks/use-llm";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Eye, EyeOff, Loader2, Info, Search, Settings, MessageSquare, FileCog, Thermometer } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { LlmSelectionDropdown } from "./llm-selection-dropdown";
import UniversalModelTester from "./universal-model-tester";
import { TrainingTest } from "./training-test";

export function LlmSettings() {
  const { t } = useLanguage();
  const { llmData, isLoading, testConnectionMutation, saveConfigMutation } = useLlm();
  const [showApiKey, setShowApiKey] = useState(false);

  const formSchema = z.object({
    model_name: z.string().min(1, "Model is required"),
    api_key: z.string().min(1, "API key is required"),
    tone: z.enum(["formal", "normal", "casual"]).default("normal"),
    temperature: z.string().default("0.3"),
    behavior_instructions: z.string().optional(),
    should_use_training: z.boolean().default(true),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      model_name: llmData?.config?.model_name || "claude-3-7-sonnet-20250219",
      api_key: llmData?.config?.api_key || "",
      tone: llmData?.config?.tone || "normal",
      temperature: llmData?.config?.temperature || "0.3",
      behavior_instructions: llmData?.config?.behavior_instructions || "",
      should_use_training: llmData?.config?.should_use_training !== false,
    },
  });

  // Update form when data is loaded
  useEffect(() => {
    if (llmData?.config) {
      form.reset({
        model_name: llmData.config.model_name,
        api_key: llmData.config.api_key || "",
        tone: llmData.config.tone || "normal",
        temperature: llmData.config.temperature || "0.3",
        behavior_instructions: llmData.config.behavior_instructions || "",
        should_use_training: llmData.config.should_use_training !== false,
      });
    }
  }, [llmData, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    await saveConfigMutation.mutateAsync(values);
  };

  const handleTestConnection = () => {
    const values = form.getValues();
    testConnectionMutation.mutate(values);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.llmSettings")}</CardTitle>
          <CardDescription>{t("admin.llmSettingsSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin.llmSettings")}</CardTitle>
        <CardDescription>{t("admin.llmSettingsSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid grid-cols-3 mb-8">
            <TabsTrigger value="general">
              <Settings className="h-4 w-4 mr-2" />
              Configurações Gerais
            </TabsTrigger>
            <TabsTrigger value="behavior">
              <MessageSquare className="h-4 w-4 mr-2" />
              Comportamento
            </TabsTrigger>
            <TabsTrigger value="training">
              <FileCog className="h-4 w-4 mr-2" />
              Treinamento
            </TabsTrigger>
          </TabsList>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Aba de Configurações Gerais */}
              <TabsContent value="general" className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Configurações do Modelo</h3>
                  <Separator />
                
                  <FormField
                    control={form.control}
                    name="model_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Modelo de IA</FormLabel>
                        <FormControl>
                          <LlmSelectionDropdown
                            value={field.value}
                            onValueChange={field.onChange}
                          />
                        </FormControl>
                        {llmData?.config && (
                          <p className="mt-1 text-xs text-neutral-500">
                            Modelo atual: {llmData.config.model_name}{" "}
                            (Atualizado em: {formatDate(llmData.config.updated_at)})
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="api_key"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Chave API</FormLabel>
                        <div className="flex">
                          <FormControl>
                            <Input
                              type={showApiKey ? "text" : "password"}
                              className="flex-grow rounded-r-none"
                              {...field}
                            />
                          </FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-l-none"
                            onClick={() => setShowApiKey(!showApiKey)}
                          >
                            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                        <p className="mt-1 text-xs text-neutral-500">
                          Chave API (criptografada com AES-256)
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4 pt-4">
                  <h3 className="text-lg font-medium">Ferramentas de Diagnóstico</h3>
                  <Separator />
                  
                  <UniversalModelTester />
                </div>
              </TabsContent>

              {/* Aba de Comportamento */}
              <TabsContent value="behavior" className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Personalização de Comportamento</h3>
                  <Separator />

                  <FormField
                    control={form.control}
                    name="tone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tom de Comunicação</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Escolha um tom" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="formal">Formal</SelectItem>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="casual">Descontraído</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Define como a IA se comunicará com os usuários.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="temperature"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex justify-between items-center">
                          <FormLabel>Temperatura</FormLabel>
                          <div className="bg-secondary text-secondary-foreground px-2 py-1 rounded-md">
                            {field.value}
                          </div>
                        </div>
                        <FormControl>
                          <div className="flex items-center gap-4">
                            <Thermometer className="h-4 w-4 text-muted-foreground" />
                            <Slider
                              value={[parseFloat(field.value)]}
                              min={0}
                              max={1}
                              step={0.01}
                              onValueChange={(vals) => field.onChange(vals[0].toString())}
                              className="flex-1"
                            />
                          </div>
                        </FormControl>
                        <FormDescription>
                          Ajuste a criatividade da IA. Valores mais baixos (0.1-0.3) produzem respostas mais consistentes e precisas, 
                          enquanto valores mais altos (0.7-1.0) tornam as respostas mais criativas e variadas.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="behavior_instructions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Instruções de Comportamento</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Descreva como a IA deve se comportar durante as conversas..." 
                            className="resize-y min-h-[120px]"
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Forneça instruções detalhadas sobre a personalidade e comportamento da IA ao interagir com os usuários.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              {/* Aba de Treinamento */}
              <TabsContent value="training" className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Configurações de Treinamento</h3>
                  <Separator />

                  <FormField
                    control={form.control}
                    name="should_use_training"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Usar Documentos de Treinamento
                          </FormLabel>
                          <FormDescription>
                            A IA usará conhecimentos dos documentos carregados no sistema para responder perguntas.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <div className="space-y-4 mt-6">
                    <h3 className="text-lg font-medium">Teste de Documentos</h3>
                    <Separator />
                    
                    <TrainingTest />
                  </div>
                </div>
              </TabsContent>

              {/* Botões de ação (sempre visíveis em qualquer aba) */}
              <div className="flex justify-end pt-4 border-t mt-8">
                <Button
                  type="button"
                  variant="outline"
                  className="mr-2"
                  onClick={handleTestConnection}
                  disabled={testConnectionMutation.isPending}
                >
                  {testConnectionMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Testar Conexão
                </Button>
                <Button
                  type="submit"
                  disabled={saveConfigMutation.isPending}
                >
                  {saveConfigMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Salvar Configurações
                </Button>
              </div>
            </form>
          </Form>
        </Tabs>
      </CardContent>
    </Card>
  );
}
