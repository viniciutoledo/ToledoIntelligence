import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { AlertCircle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Lista de provedores e modelos
const providers = [
  {
    name: 'OpenAI',
    models: [
      'gpt-4.1',
      'gpt-4.1-mini',
      'o4-mini',
      'o3',
      'gpt-4o',
      'gpt-4o-mini',
      'o3-mini-beta',
      'o1',
      'gpt-4-turbo'
    ],
    apiKeyPlaceholder: 'sk-...'
  },
  {
    name: 'Anthropic',
    models: [
      'claude-3-5-sonnet',
      'claude-3-7-sonnet-20250219',
      'claude-3-5-haiku',
      'claude-3-haiku-20240307',
      'claude-3-sonnet-20240229',
      'claude-3-opus-20240229'
    ],
    apiKeyPlaceholder: 'sk-ant-...'
  },
  {
    name: 'Meta',
    models: [
      'llama-3.3',
      'llama-3-8b',
      'llama-3-70b'
    ],
    apiKeyPlaceholder: 'api-key...'
  },
  {
    name: 'Alibaba',
    models: [
      'qwen-2.5-max',
      'qwen-plus',
      'qwen-max',
      'qwen-7b'
    ],
    apiKeyPlaceholder: 'api-key...'
  },
  {
    name: 'Deepseek',
    models: [
      'deepseek-v3',
      'deepseek-chat',
      'deepseek-coder'
    ],
    apiKeyPlaceholder: 'api-key...'
  },
  {
    name: 'Maritaca',
    models: [
      'sabia-3',
      'maritalk'
    ],
    apiKeyPlaceholder: 'api-key...'
  }
];

const UniversalModelTester = () => {
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState('OpenAI');
  const [model, setModel] = useState('gpt-4o');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('test');
  const { toast } = useToast();

  // Obtém o placeholder correto para o provedor atual
  const getApiKeyPlaceholder = () => {
    const selectedProvider = providers.find(p => p.name === provider);
    return selectedProvider?.apiKeyPlaceholder || 'Chave API...';
  };

  // Obtém a lista de modelos para o provedor atual
  const getModels = () => {
    const selectedProvider = providers.find(p => p.name === provider);
    return selectedProvider?.models || [];
  };

  const handleProviderChange = (value: string) => {
    setProvider(value);
    // Resetar o modelo para o primeiro da lista do novo provedor
    const selectedProvider = providers.find(p => p.name === value);
    if (selectedProvider && selectedProvider.models.length > 0) {
      setModel(selectedProvider.models[0]);
    }
  };

  const handleTest = async () => {
    if (!apiKey) {
      toast({
        title: "Chave API obrigatória",
        description: "Por favor, insira uma chave API válida",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      // Testar a conexão com o modelo selecionado
      const response = await apiRequest('POST', '/api/admin/llm/test', {
        model_name: model,
        api_key: apiKey
      });
      
      const data = await response.json();
      
      // Obter informações adicionais de diagnóstico
      const diagResponse = await apiRequest('GET', '/api/debug/llm-diagnostics');
      const diagData = await diagResponse.json();
      
      const testResults = {
        connection_test: {
          success: data.success,
          error: data.error
        },
        key_info: {
          is_valid_format: apiKey.startsWith(provider === 'OpenAI' ? 'sk-' : (provider === 'Anthropic' ? 'sk-ant-' : '')),
          length: apiKey.length
        },
        provider_info: {
          name: provider,
          model: model
        },
        diagnostic_data: diagData.debug || null
      };
      
      setResults(testResults);
      
      if (testResults.connection_test.success) {
        toast({
          title: "Conexão bem-sucedida",
          description: `A API ${provider} está funcionando corretamente com o modelo ${model}`,
          variant: "default"
        });
      } else {
        toast({
          title: "Falha na conexão",
          description: "Verifique os detalhes do erro para mais informações",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro ao testar conexão:', error);
      setResults({
        connection_test: {
          success: false,
          error: error instanceof Error ? error.message : "Erro de conexão"
        },
        key_info: {
          is_valid_format: apiKey.startsWith(provider === 'OpenAI' ? 'sk-' : (provider === 'Anthropic' ? 'sk-ant-' : '')),
          length: apiKey.length
        },
        provider_info: {
          name: provider,
          model: model
        }
      });
      
      toast({
        title: "Erro de teste",
        description: error instanceof Error ? error.message : "Falha ao testar a API",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderResultStatus = (success: boolean, error?: string) => {
    if (success) {
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    } else {
      return (
        <div className="flex items-center gap-2">
          <XCircle className="h-5 w-5 text-red-500" />
          {error && <span className="text-xs text-muted-foreground truncate max-w-[250px]" title={error}>{error}</span>}
        </div>
      );
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Teste Universal de Modelo</CardTitle>
        <CardDescription>
          Teste a conexão com qualquer provedor de LLM e qualquer modelo disponível.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs 
          defaultValue="test" 
          value={activeTab} 
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="test">Teste de Conexão</TabsTrigger>
            <TabsTrigger value="results" disabled={!results}>Resultados</TabsTrigger>
          </TabsList>
          
          <TabsContent value="test" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="provider">Provedor</Label>
                <Select
                  value={provider}
                  onValueChange={handleProviderChange}
                >
                  <SelectTrigger id="provider">
                    <SelectValue placeholder="Selecione um provedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((p) => (
                      <SelectItem key={p.name} value={p.name}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="model">Modelo</Label>
                <Select
                  value={model}
                  onValueChange={setModel}
                >
                  <SelectTrigger id="model">
                    <SelectValue placeholder="Selecione um modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    {getModels().map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="api-key">Chave API</Label>
              <Input
                id="api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={getApiKeyPlaceholder()}
              />
              <p className="text-xs text-muted-foreground">
                Chave de autenticação para o provedor {provider}
              </p>
            </div>
          </TabsContent>
          
          <TabsContent value="results" className="space-y-4 pt-4">
            {results && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-2 border rounded-md p-4">
                  <h3 className="font-medium text-sm">Informações do Teste:</h3>
                  
                  <div className="text-xs">
                    <span className="font-medium">Provedor:</span>{' '}
                    {results.provider_info.name}
                  </div>
                  
                  <div className="text-xs">
                    <span className="font-medium">Modelo:</span>{' '}
                    {results.provider_info.model}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-2 border rounded-md p-4">
                  <h3 className="font-medium text-sm">Resultados da Conexão:</h3>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-xs">Status da conexão</span>
                    {renderResultStatus(
                      results.connection_test.success,
                      results.connection_test.error
                    )}
                  </div>
                  
                  <div className="text-xs mt-2">
                    <span className="font-medium">Formato da chave:</span>{' '}
                    {results.key_info.is_valid_format ? 
                      <span className="text-green-500">Válido</span> : 
                      <span className="text-red-500">Inválido</span>}
                  </div>
                  
                  <div className="text-xs">
                    <span className="font-medium">Comprimento da chave:</span>{' '}
                    {results.key_info.length} caracteres
                  </div>
                </div>
                
                {results.connection_test.error && (
                  <div className="mt-2 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md text-xs overflow-auto max-h-[200px]">
                    <p className="font-medium">Detalhes do Erro:</p>
                    <p className="whitespace-pre-wrap text-red-700 dark:text-red-400 mt-1">
                      {results.connection_test.error}
                    </p>
                  </div>
                )}
                
                {results.diagnostic_data && (
                  <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md text-xs">
                    <p className="font-medium">Informações Adicionais:</p>
                    <p className="whitespace-pre-wrap mt-1">
                      {JSON.stringify(results.diagnostic_data, null, 2)}
                    </p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <CardFooter>
        {activeTab === 'test' ? (
          <Button 
            onClick={handleTest} 
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testando...
              </>
            ) : 'Testar Conexão'}
          </Button>
        ) : (
          <Button 
            onClick={() => setActiveTab('test')} 
            variant="outline"
            className="w-full"
          >
            Voltar para o Teste
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default UniversalModelTester;