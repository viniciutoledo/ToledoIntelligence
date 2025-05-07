import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useTraining } from "@/hooks/use-training";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileText, MoreVertical, Check, ClipboardIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";

export function TrainingText() {
  // Estamos sobrescrevendo o hook de tradução para mostrar as chaves diretas
  const { i18n } = useTranslation();
  // Este é um hook fictício que apenas retorna a chave de tradução
  const t = (key: string) => key;
  const { 
    documents,
    documentsLoading,
    createTextDocumentMutation,
    deleteDocumentMutation,
  } = useTraining();
  
  const [textContent, setTextContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const textDocuments = documents?.filter(doc => doc.document_type === "text") || [];
  
  const handleTextSubmit = async () => {
    if (!textContent.trim()) return;
    
    setIsSubmitting(true);
    
    try {
      await createTextDocumentMutation.mutateAsync({
        name: `Treinamento de texto ${new Date().toLocaleString()}`,
        content: textContent,
        description: null,
      });
      
      setTextContent("");
    } catch (error) {
      console.error("Error submitting text:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDocument = async (id: number) => {
    try {
      await deleteDocumentMutation.mutateAsync(id);
    } catch (error) {
      console.error("Error deleting document:", error);
    }
  };

  const formatDate = (date: string) => {
    const dateObj = new Date(date);
    return format(
      dateObj,
      "d MMM yyyy, HH:mm",
      { locale: i18n.language === 'pt' ? ptBR : enUS }
    );
  };
  
  return (
    <div>
      {/* Cabeçalho do novo treinamento */}
      <div className="flex items-center mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
          <FileText className="h-4 w-4 text-primary" />
        </div>
        <h3 className="ml-2 text-base font-medium">Novo Treinamento de Texto</h3>
      </div>

      {/* Área de input do texto */}
      <div className="mb-6 rounded-lg border bg-card">
        <div className="p-4">
          <Textarea
            placeholder="Digite o conteúdo de texto para treinar o modelo de IA..."
            value={textContent}
            onChange={e => setTextContent(e.target.value)}
            className="min-h-[120px] resize-none border-0 bg-transparent p-0 text-sm ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        <div className="flex items-center justify-between border-t bg-muted/20 px-4 py-2">
          <div className="flex items-center text-xs text-muted-foreground">
            <span>Digite ou cole o conteúdo de texto</span>
          </div>
          <Button
            type="button" 
            onClick={handleTextSubmit}
            disabled={isSubmitting || !textContent.trim()}
            size="sm"
            className="h-8"
          >
            {isSubmitting ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processando...
              </span>
            ) : (
              "Enviar Texto"
            )}
          </Button>
        </div>
      </div>
      
      {/* Lista de documentos de treinamento */}
      <div className="space-y-2">
        {documentsLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : textDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <FileText className="h-10 w-10 text-muted-foreground/60" />
            </div>
            <h3 className="mt-4 text-lg font-medium">Nenhum Treinamento de Texto</h3>
            <p className="mt-2 text-sm text-muted-foreground text-center max-w-sm">
              Digite conteúdo de texto para treinar o modelo de IA
            </p>
          </div>
        ) : (
          <>
            <h3 className="text-base font-medium mb-2">Itens de Treinamento</h3>
            <div className="space-y-2">
              {textDocuments.map((doc) => (
                <div key={doc.id} className="rounded-lg border bg-card p-4 transition-all hover:shadow-sm">
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex-1 mr-4">
                      <div className="line-clamp-2 text-sm">
                        {doc.content}
                      </div>
                      <div className="mt-1 flex items-center text-xs text-muted-foreground">
                        <span>Item de Treinamento</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="flex flex-col gap-1">
                        <Badge className={`px-2 py-0.5 text-xs ${
                          doc.status === 'completed' || doc.status === 'indexed'
                            ? 'bg-green-100 text-green-800 border border-green-200' 
                            : doc.status === 'processing'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : doc.status === 'error'
                            ? 'bg-red-100 text-red-800 border border-red-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          {(doc.status === 'completed' || doc.status === 'indexed') && <Check className="mr-1 h-3 w-3" />}
                          {doc.status === 'completed' ? 'Concluído' : 
                           doc.status === 'indexed' ? 'Indexado' :
                           doc.status === 'processing' ? 'Processando' : 
                           doc.status === 'error' ? 'Erro' : 'Pendente'}
                        </Badge>
                        
                        {/* Barra de progresso para documentos em processamento */}
                        {doc.status === 'processing' && (
                          <div className="w-full mt-1">
                            <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                style={{ width: `${doc.progress || 0}%` }}
                              />
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5 text-right">{doc.progress || 0}%</div>
                          </div>
                        )}
                        
                        {/* Mensagem para documentos pendentes */}
                        {doc.status === 'pending' && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            Aguardando processamento...
                          </div>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Ações</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="flex cursor-pointer items-center"
                            onClick={() => navigator.clipboard.writeText(doc.content || '')}
                          >
                            <ClipboardIcon className="mr-2 h-4 w-4" />
                            <span>Copiar</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="flex cursor-pointer items-center text-red-600 focus:text-red-600" 
                            onClick={() => handleDeleteDocument(doc.id)}
                          >
                            <span>Excluir</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}