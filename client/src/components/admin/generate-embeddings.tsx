import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Database, CheckCircle, XCircle } from "lucide-react";
import { useTraining } from "@/hooks/use-training";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function GenerateEmbeddings() {
  const { toast } = useToast();
  const { documents } = useTraining();
  const [loading, setLoading] = useState(false);
  const [processingAll, setProcessingAll] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<number | null>(null);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Filtrar apenas documentos ativos e com processamento completo
  const activeDocuments = documents?.filter(doc => 
    doc.is_active && doc.status === "completed"
  ) || [];

  const handleGenerateEmbeddings = async (documentId?: number) => {
    try {
      if (documentId) {
        setSelectedDocument(documentId);
        setLoading(true);
      } else {
        setProcessingAll(true);
      }
      
      const response = await fetch("/api/training/process-embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(documentId ? { documentId } : {}),
      });

      const data = await response.json();
      
      if (response.ok) {
        setResult({
          success: true,
          message: data.message
        });
        
        toast({
          title: "Sucesso",
          description: data.message,
          variant: "default",
        });
      } else {
        setResult({
          success: false,
          message: data.message || "Ocorreu um erro ao processar embeddings."
        });
        
        toast({
          title: "Erro",
          description: data.message || "Ocorreu um erro ao processar embeddings.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Erro ao processar embeddings:", error);
      setResult({
        success: false,
        message: "Erro ao processar embeddings. Verifique o console para mais detalhes."
      });
      
      toast({
        title: "Erro",
        description: "Erro ao processar embeddings. Verifique o console para mais detalhes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setProcessingAll(false);
      setSelectedDocument(null);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Geração de Embeddings</CardTitle>
        <CardDescription>
          Gere embeddings vetoriais para aprimorar a busca semântica dos documentos.
          Isto permitirá que o sistema entenda melhor o conteúdo dos documentos.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {result && (
          <Alert variant={result.success ? "default" : "destructive"}>
            <div className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <AlertTitle>{result.success ? "Sucesso" : "Erro"}</AlertTitle>
            </div>
            <AlertDescription>{result.message}</AlertDescription>
          </Alert>
        )}
        
        {activeDocuments.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-muted-foreground">
              Não há documentos ativos disponíveis para processamento.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4">
              <h3 className="text-sm font-medium">Documentos Disponíveis</h3>
              <div className="grid gap-2">
                {activeDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between border p-3 rounded-md"
                  >
                    <div>
                      <p className="font-medium">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.document_type === "text" ? "Texto" : 
                         doc.document_type === "file" ? "Arquivo" : 
                         doc.document_type === "website" ? "Website" : "Vídeo"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleGenerateEmbeddings(doc.id)}
                      disabled={loading || processingAll || selectedDocument === doc.id}
                    >
                      {selectedDocument === doc.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <Database className="mr-2 h-4 w-4" />
                          Gerar Embeddings
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <Button
          variant="default"
          onClick={() => handleGenerateEmbeddings()}
          disabled={loading || processingAll || activeDocuments.length === 0}
          className="w-full"
        >
          {processingAll ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processando todos os documentos...
            </>
          ) : (
            <>
              <Database className="mr-2 h-4 w-4" />
              Processar Todos os Documentos
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}