import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const OpenAICompatibilityTester = () => {
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  const handleTestOpenAI = async () => {
    if (!apiKey) {
      toast({
        title: "Chave API obrigatória",
        description: "Por favor, insira uma chave API OpenAI válida",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      // Usar o endpoint de teste de LLM para testar a conexão OpenAI
      const response = await apiRequest('POST', '/api/admin/llm/test', {
        model_name: 'gpt-3.5-turbo',
        api_key: apiKey
      });
      const data = await response.json();
      
      // Obter informações adicionais de diagnóstico
      const diagResponse = await apiRequest('GET', '/api/debug/llm-diagnostics');
      const diagData = await diagResponse.json();
      
      // Combinar os resultados
      const openaiResults = {
        connection_test: {
          success: data.success
        },
        key_info: {
          is_valid_format: apiKey.startsWith('sk-'),
          length: apiKey.length
        },
        // Adicionar informações de diagnóstico se disponíveis
        openai_diagnostic: diagData.debug?.openai_diagnostic || null,
      };
      
      setResults(openaiResults);
      
      if (openaiResults.connection_test.success) {
        toast({
          title: "Conexão bem-sucedida",
          description: "A API da OpenAI está funcionando corretamente",
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
      console.error('Erro ao testar OpenAI:', error);
      toast({
        title: "Erro de teste",
        description: error instanceof Error ? error.message : "Falha ao testar a API OpenAI",
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
        <CardTitle>Teste de API OpenAI</CardTitle>
        <CardDescription>
          Este teste verifica a conexão com a API da OpenAI e diagnostica possíveis problemas.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="openai-api-key">Chave API OpenAI</Label>
            <Input
              id="openai-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
            />
          </div>

          {results && (
            <div className="mt-4 space-y-2 border rounded-md p-4">
              <h3 className="font-medium text-sm">Resultados do diagnóstico OpenAI:</h3>

              <div className="grid grid-cols-1 gap-2">
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
                
                {results.openai_diagnostic && (
                  <>
                    <div className="text-xs">
                      <span className="font-medium">Caracteres originais:</span>{' '}
                      {results.openai_diagnostic.key_original_length}
                    </div>
                    
                    <div className="text-xs">
                      <span className="font-medium">Caracteres após limpeza:</span>{' '}
                      {results.openai_diagnostic.key_cleaned_length}
                    </div>
                  </>
                )}

                {results.connection_test.error && (
                  <div className="mt-2 p-2 bg-red-50 dark:bg-red-950 rounded-md text-xs overflow-auto max-h-[200px]">
                    <p className="font-medium">Erro:</p>
                    <p className="whitespace-pre-wrap text-red-700 dark:text-red-400">
                      {results.connection_test.error}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter>
        <Button 
          onClick={handleTestOpenAI} 
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? 'Testando...' : 'Testar Conexão OpenAI'}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default OpenAICompatibilityTester;