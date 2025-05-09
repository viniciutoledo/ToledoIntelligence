import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Check, Database, FileText, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { apiRequest } from "@/lib/queryClient";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface RAGTestResult {
  query: string;
  topics: string[];
  documents: Array<{
    id: number;
    title: string;
    content: string;
  }>;
  response: string;
}

export function RagPerformanceTest() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [testQuery, setTestQuery] = useState("");
  const [result, setResult] = useState<RAGTestResult | null>(null);

  const runTest = async () => {
    if (!testQuery.trim()) {
      toast({
        title: t("Campo obrigatório"),
        description: t("Digite uma consulta para testar o sistema RAG"),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/admin/test-rag", { query: testQuery });
      const data = await response.json();
      
      setResult(data);
      toast({
        title: t("Teste concluído"),
        description: t("A consulta foi processada com sucesso"),
      });
    } catch (error) {
      console.error("Erro ao testar RAG:", error);
      toast({
        title: t("Erro"),
        description: t("Não foi possível testar o sistema RAG"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("Teste de Recuperação Semântica de Documentos")}</CardTitle>
          <CardDescription>
            {t("Teste como o sistema RAG recupera documentos relevantes com base na consulta")}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4">
            <div className="flex items-center gap-2">
              <Input
                placeholder={t("Digite uma consulta técnica para testar...")}
                value={testQuery}
                onChange={(e) => setTestQuery(e.target.value)}
                className="flex-1"
              />
              <Button 
                onClick={runTest} 
                disabled={isLoading}
                className="w-24"
              >
                {isLoading ? t("Testando...") : t("Testar")}
              </Button>
            </div>

            {result && (
              <Tabs defaultValue="overview" className="mt-4">
                <TabsList className="mb-4">
                  <TabsTrigger value="overview">{t("Visão Geral")}</TabsTrigger>
                  <TabsTrigger value="topics">{t("Tópicos")}</TabsTrigger>
                  <TabsTrigger value="documents">{t("Documentos")}</TabsTrigger>
                  <TabsTrigger value="response">{t("Resposta")}</TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="space-y-4">
                  <Alert>
                    <Search className="h-4 w-4" />
                    <AlertTitle>{t("Consulta")}</AlertTitle>
                    <AlertDescription>{result.query}</AlertDescription>
                  </Alert>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">{t("Tópicos Extraídos")}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{result.topics.length}</div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">{t("Documentos Encontrados")}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{result.documents.length}</div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">{t("Tamanho da Resposta")}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{result.response.length} {t("caracteres")}</div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
                
                <TabsContent value="topics">
                  <Card>
                    <CardHeader>
                      <CardTitle>{t("Tópicos Extraídos da Consulta")}</CardTitle>
                      <CardDescription>
                        {t("Estes são os tópicos identificados e usados para recuperar documentos relevantes")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {result.topics.length === 0 ? (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>{t("Nenhum tópico encontrado")}</AlertTitle>
                          <AlertDescription>
                            {t("Não foi possível extrair tópicos relevantes da consulta")}
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <ul className="list-disc pl-5 space-y-2">
                          {result.topics.map((topic, index) => (
                            <li key={index} className="text-md">
                              {topic}
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="documents">
                  <Card>
                    <CardHeader>
                      <CardTitle>{t("Documentos Recuperados")}</CardTitle>
                      <CardDescription>
                        {t("Documentos encontrados na base de conhecimento relacionados à consulta")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {result.documents.length === 0 ? (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>{t("Nenhum documento encontrado")}</AlertTitle>
                          <AlertDescription>
                            {t("Não foram encontrados documentos relevantes para esta consulta")}
                          </AlertDescription>
                        </Alert>
                      ) : (
                        <Accordion type="single" collapsible className="w-full">
                          {result.documents.map((doc, index) => (
                            <AccordionItem key={index} value={`item-${index}`}>
                              <AccordionTrigger className="text-md font-medium flex items-center">
                                <FileText className="h-4 w-4 mr-2 inline-block" />
                                <span className="truncate">{doc.title || `Documento #${doc.id}`}</span>
                              </AccordionTrigger>
                              <AccordionContent>
                                <ScrollArea className="h-[200px] w-full rounded-md border p-4">
                                  <div className="whitespace-pre-wrap">{doc.content}</div>
                                </ScrollArea>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="response">
                  <Card>
                    <CardHeader>
                      <CardTitle>{t("Resposta Gerada")}</CardTitle>
                      <CardDescription>
                        {t("Resposta gerada pelo sistema com base nos documentos recuperados")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                        <div className="whitespace-pre-wrap">{result.response}</div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex justify-between border-t pt-4">
          <div className="flex items-center text-sm text-muted-foreground">
            <Database className="h-4 w-4 mr-1" />
            {t("O sistema RAG utiliza embeddings semânticos para recuperar documentos relevantes")}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}