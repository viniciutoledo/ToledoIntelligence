import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Search, CheckCircle2, XCircle } from "lucide-react";
import { useTraining } from "@/hooks/use-training";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function TrainingTest() {
  const { documents, documentsLoading } = useTraining();
  const [query, setQuery] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [response, setResponse] = useState<{
    text: string;
    usedDocument: boolean;
    documentName?: string;
  } | null>(null);

  const testDocuments = documents?.filter(doc => doc.status === "completed") || [];

  const handleTestQuery = async () => {
    if (!query || !selectedDocumentId) return;

    setIsSubmitting(true);

    try {
      // Aqui enviamos a consulta para teste com o documento específico
      const response = await fetch("/api/training/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, documentId: selectedDocumentId }),
      });

      if (!response.ok) {
        throw new Error("Falha ao testar o conhecimento");
      }

      const data = await response.json();
      setResponse({
        text: data.response,
        usedDocument: data.usedDocument,
        documentName: data.documentName,
      });
    } catch (error) {
      console.error("Erro ao testar conhecimento:", error);
      setResponse({
        text: "Ocorreu um erro ao testar o conhecimento. Por favor, tente novamente.",
        usedDocument: false,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (documentsLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Documento para Teste</label>
            <Select 
              value={selectedDocumentId} 
              onValueChange={setSelectedDocumentId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um documento" />
              </SelectTrigger>
              <SelectContent>
                {testDocuments.length === 0 ? (
                  <SelectItem value="none" disabled>
                    Nenhum documento disponível
                  </SelectItem>
                ) : (
                  testDocuments.map(doc => (
                    <SelectItem key={doc.id} value={doc.id.toString()}>
                      {doc.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Pergunta de Teste</label>
            <div className="flex gap-2">
              <Input 
                value={query} 
                onChange={e => setQuery(e.target.value)} 
                placeholder="Faça uma pergunta específica sobre o documento..."
              />
              <Button
                type="button"
                onClick={handleTestQuery}
                disabled={isSubmitting || !query || !selectedDocumentId}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Testar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {response && (
        <div className="space-y-3 mt-4">
          <Alert className={cn(
            response.usedDocument ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"
          )}>
            <div className="flex items-center gap-2">
              {response.usedDocument ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-amber-500" />
              )}
              <AlertTitle>
                {response.usedDocument
                  ? `Documento "${response.documentName}" utilizado com sucesso!`
                  : "Documento não foi utilizado na resposta"}
              </AlertTitle>
            </div>
            <AlertDescription className="mt-2">
              {response.usedDocument
                ? "A resposta contém conhecimento do documento selecionado."
                : "A resposta foi gerada sem consultar o documento. Verifique se suas configurações de treinamento estão ativadas."}
            </AlertDescription>
          </Alert>
          
          <div className="border rounded-md p-3">
            <p className="text-sm font-medium mb-1">Resposta da IA:</p>
            <div className="bg-neutral-50 p-3 rounded">
              <p className="whitespace-pre-wrap text-sm">{response.text}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
