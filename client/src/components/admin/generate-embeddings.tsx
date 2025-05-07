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
  const { documents, processEmbeddingsMutation } = useTraining();
  const [selectedDocument, setSelectedDocument] = useState<number | null>(null);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Filtrar apenas documentos ativos e com processamento completo
  // Também exibir documentos em status "indexed" como já processados
  const activeDocuments = documents?.filter(doc => 
    doc.is_active && (doc.status === "completed" || doc.status === "indexed")
  ) || [];

  const handleGenerateEmbeddings = async (documentId?: number) => {
    try {
      if (documentId) {
        setSelectedDocument(documentId);
      }
      
      const data = await processEmbeddingsMutation.mutateAsync(documentId);
      
      setResult({
        success: true,
        message: data.message
      });
    } catch (error) {
      console.error("Erro ao processar embeddings:", error);
      
      setResult({
        success: false,
        message: error instanceof Error 
          ? error.message 
          : "Erro ao processar embeddings. Verifique o console para mais detalhes."
      });
    } finally {
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
                      disabled={processEmbeddingsMutation.isPending || selectedDocument === doc.id}
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
          disabled={processEmbeddingsMutation.isPending || activeDocuments.length === 0}
          className="w-full"
        >
          {processEmbeddingsMutation.isPending ? (
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