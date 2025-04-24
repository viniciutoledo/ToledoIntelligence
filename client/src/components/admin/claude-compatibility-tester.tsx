import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ClaudeCompatibilityTester = () => {
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  const handleTestCompatibility = async () => {
    if (!apiKey) {
      toast({
        title: "Chave API obrigatória",
        description: "Por favor, insira uma chave API Anthropic válida",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiRequest('POST', '/api/admin/llm/claude-compatibility-test', { apiKey });
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Erro ao testar compatibilidade:', error);
      toast({
        title: "Erro de teste",
        description: error instanceof Error ? error.message : "Falha ao testar compatibilidade",
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
        <CardTitle>Teste de Compatibilidade Claude</CardTitle>
        <CardDescription>
          Este teste verifica a compatibilidade entre diferentes formatos de API Claude.
          Útil para diagnosticar problemas com a API Anthropic/Claude.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="anthropic-api-key">Chave API Anthropic</Label>
            <Input
              id="anthropic-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
            />
          </div>

          {results && (
            <div className="mt-4 space-y-2 border rounded-md p-4">
              <h3 className="font-medium text-sm">Resultados dos testes:</h3>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs">Claude 2 com formato prompt</span>
                  {renderResultStatus(
                    results.results.claude2_prompt_format, 
                    results.results.errors.claude2_prompt_format
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs">Claude 3 com formato messages</span>
                  {renderResultStatus(
                    results.results.claude3_messages_format, 
                    results.results.errors.claude3_messages_format
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs">Claude 2 com formato messages</span>
                  {renderResultStatus(
                    results.results.claude2_with_messages_format, 
                    results.results.errors.claude2_with_messages_format
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs">Claude 3 com formato prompt</span>
                  {renderResultStatus(
                    results.results.claude3_with_prompt_format, 
                    results.results.errors.claude3_with_prompt_format
                  )}
                </div>
              </div>

              {results.compatibility_summary && (
                <div className="mt-4 text-sm space-y-1 border-t pt-2">
                  <div className="flex items-center">
                    <span className="font-medium mr-2">Formato preferido Claude 2:</span>
                    <span>{results.compatibility_summary.claude2_preferred_format}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium mr-2">Formato preferido Claude 3:</span>
                    <span>{results.compatibility_summary.claude3_preferred_format}</span>
                  </div>
                  <div className="flex items-center text-xs text-muted-foreground mt-1">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    <span>{results.compatibility_summary.recommendation}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter>
        <Button 
          onClick={handleTestCompatibility} 
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? 'Testando...' : 'Testar Compatibilidade Claude'}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ClaudeCompatibilityTester;