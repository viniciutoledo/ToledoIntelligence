import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileText, Search, BookOpen } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RAGTestResult {
  query: string;
  topics: string[];
  documents: Array<{
    name: string;
    content: string;
    relevance?: number;
  }>;
  response: string;
  processingTime: number;
}

const RagPerformance = () => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<RAGTestResult | null>(null);
  const [testHistory, setTestHistory] = useState<RAGTestResult[]>([]);
  const { toast } = useToast();

  // Carregar histórico de testes do localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('rag_test_history');
    if (savedHistory) {
      try {
        setTestHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Erro ao carregar histórico de testes RAG:', e);
      }
    }
  }, []);

  // Salvar histórico de testes no localStorage
  useEffect(() => {
    if (testHistory.length > 0) {
      localStorage.setItem('rag_test_history', JSON.stringify(testHistory.slice(0, 20)));
    }
  }, [testHistory]);

  const runTest = async () => {
    if (!query.trim()) {
      toast({
        title: 'Consulta vazia',
        description: 'Por favor, digite uma consulta para testar',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      const startTime = Date.now();
      const response = await apiRequest('POST', '/api/admin/test-rag', { query });
      const data = await response.json();
      const endTime = Date.now();
      
      const result: RAGTestResult = {
        query,
        topics: data.topics || [],
        documents: data.documents || [],
        response: data.response || 'Sem resposta',
        processingTime: endTime - startTime
      };
      
      setTestResult(result);
      setTestHistory(prev => [result, ...prev].slice(0, 20));
      
      toast({
        title: 'Teste RAG concluído',
        description: `Encontrados ${result.documents.length} documentos relevantes`
      });
    } catch (error) {
      toast({
        title: 'Erro ao testar o sistema RAG',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadTest = (test: RAGTestResult) => {
    setQuery(test.query);
    setTestResult(test);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Análise de Desempenho RAG</CardTitle>
          <CardDescription>
            Teste e analise o sistema de Recuperação Aumentada por Geração (RAG)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Digite uma consulta para testar o sistema RAG..."
                className="flex-1"
              />
              <Button 
                onClick={runTest} 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Testar
                  </>
                )}
              </Button>
            </div>
            
            <Tabs defaultValue="result" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="result">Resultado</TabsTrigger>
                <TabsTrigger value="documents">Documentos ({testResult?.documents.length || 0})</TabsTrigger>
                <TabsTrigger value="history">Histórico ({testHistory.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="result" className="space-y-4 mt-4">
                {testResult ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="text-xs">
                        Tempo: {testResult.processingTime}ms
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Documentos: {testResult.documents.length}
                      </Badge>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">Tópicos Identificados:</h4>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {testResult.topics.map((topic, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {topic}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">Resposta:</h4>
                      <Card className="mt-1">
                        <CardContent className="p-4">
                          <p className="whitespace-pre-wrap text-sm">{testResult.response}</p>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="mx-auto h-12 w-12 mb-4 opacity-20" />
                    <p>Execute um teste para ver os resultados</p>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="documents" className="mt-4">
                {testResult && testResult.documents.length > 0 ? (
                  <div className="space-y-4">
                    {testResult.documents.map((doc, index) => (
                      <Card key={index}>
                        <CardHeader className="py-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-medium flex items-center">
                              <FileText className="h-4 w-4 mr-2" />
                              {doc.name}
                            </CardTitle>
                            {doc.relevance && (
                              <Badge variant="outline" className="text-xs">
                                Relevância: {(doc.relevance * 100).toFixed(1)}%
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="py-2">
                          <ScrollArea className="h-32">
                            <p className="text-xs whitespace-pre-wrap">{doc.content.substring(0, 500)}...</p>
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="mx-auto h-12 w-12 mb-4 opacity-20" />
                    <p>Nenhum documento relevante encontrado</p>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="history" className="mt-4">
                {testHistory.length > 0 ? (
                  <div className="space-y-2">
                    {testHistory.map((test, index) => (
                      <Card key={index} className="cursor-pointer hover:bg-accent/50" onClick={() => loadTest(test)}>
                        <CardContent className="p-3">
                          <div className="flex justify-between items-center">
                            <div className="truncate flex-1">
                              <p className="font-medium truncate">{test.query}</p>
                              <p className="text-xs text-muted-foreground">
                                {test.documents.length} documentos • {test.processingTime}ms
                              </p>
                            </div>
                            <div className="flex gap-1">
                              {test.topics.slice(0, 3).map((topic, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {topic}
                                </Badge>
                              ))}
                              {test.topics.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{test.topics.length - 3}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Nenhum teste no histórico</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RagPerformance;