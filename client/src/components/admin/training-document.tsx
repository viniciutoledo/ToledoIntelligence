import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useTraining } from "@/hooks/use-training";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FileText, UploadCloud, MoreVertical, Check, X, Download, FileIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";

interface DocumentFormData {
  name: string;
  description: string | null;
  file?: File | null;
}

export function TrainingDocument() {
  const { t, i18n } = useTranslation();
  const {
    documents,
    documentsLoading,
    createFileDocumentMutation,
    deleteDocumentMutation,
  } = useTraining();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [documentDescription, setDocumentDescription] = useState("");

  const fileDocuments = documents?.filter(doc => doc.document_type === "file") || [];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Check if file is PDF, DOCX, etc.
      const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain'];
      if (validTypes.includes(file.type)) {
        setSelectedFile(file);
      } else {
        alert(t("admin.training.invalidDocumentFormat"));
        e.target.value = "";
      }
    }
  };

  const handleDocumentSubmit = async () => {
    if (!selectedFile || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("name", selectedFile.name);
      formData.append("description", documentDescription || "");
      formData.append("document_type", "file");
      
      await createFileDocumentMutation.mutateAsync(formData);

      // Reset form
      setSelectedFile(null);
      setDocumentDescription("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error submitting document:", error);
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

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    
    if (extension === 'pdf') {
      return <FileText className="h-4 w-4 text-red-500" />;
    } else if (['doc', 'docx'].includes(extension || '')) {
      return <FileText className="h-4 w-4 text-blue-500" />;
    } else if (['txt'].includes(extension || '')) {
      return <FileText className="h-4 w-4 text-gray-500" />;
    } else {
      return <FileIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div>
      {/* Cabeçalho do novo treinamento */}
      <div className="flex items-center mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
          <FileText className="h-4 w-4 text-primary" />
        </div>
        <h3 className="ml-2 text-base font-medium">Novo Treinamento de Documento</h3>
      </div>

      {/* Área de upload de documento */}
      <div className="mb-6 rounded-lg border bg-card">
        <div className="p-4 space-y-4">
          <div>
            <Label htmlFor="document_file" className="text-sm text-muted-foreground mb-1 block">
              Arquivo de Documento
            </Label>
            
            <div className="mt-1 flex items-center justify-center border-2 border-dashed rounded-lg py-6 px-4 transition-colors hover:border-primary/50 cursor-pointer">
              {selectedFile ? (
                <div className="text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    {getFileIcon(selectedFile.name)}
                  </div>
                  <div className="mt-2 text-sm font-medium">{selectedFile.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                    className="mt-3 text-xs"
                  >
                    <X className="h-3 w-3 mr-1" /> Remover
                  </Button>
                </div>
              ) : (
                <div 
                  className="text-center" 
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <UploadCloud className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isSubmitting}
                      className="text-xs"
                    >
                      Selecionar Arquivo de Documento
                    </Button>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Tamanho máximo: 50MB. Formatos suportados: PDF, DOC, DOCX, TXT
                  </div>
                </div>
              )}
              <input
                id="document_file"
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                onChange={handleFileChange}
                className="hidden"
                disabled={isSubmitting}
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="document_description" className="text-sm text-muted-foreground mb-1 block">
              Descrição <span className="text-xs text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id="document_description"
              placeholder="Digite uma descrição para o documento (opcional)"
              value={documentDescription}
              onChange={(e) => setDocumentDescription(e.target.value)}
              className="resize-none text-sm min-h-[80px]"
              disabled={isSubmitting}
            />
          </div>
        </div>
        
        <div className="flex items-center justify-between border-t bg-muted/20 px-4 py-2">
          <div className="text-xs text-muted-foreground">
            Formatos suportados: PDF, DOC, DOCX, TXT
          </div>
          <Button
            type="button" 
            onClick={handleDocumentSubmit}
            disabled={isSubmitting || !selectedFile}
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
              "Enviar Documento"
            )}
          </Button>
        </div>
      </div>
      
      {/* Lista de documentos */}
      <div className="space-y-2">
        {documentsLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : fileDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <FileText className="h-10 w-10 text-muted-foreground/60" />
            </div>
            <h3 className="mt-4 text-lg font-medium">Nenhum Treinamento de Documento</h3>
            <p className="mt-2 text-sm text-muted-foreground text-center max-w-sm">
              Faça upload de um documento para treinar o modelo de IA
            </p>
          </div>
        ) : (
          <>
            <div className="text-sm font-medium text-muted-foreground mb-2">
              {fileDocuments.length} {fileDocuments.length === 1 ? "Item de Treinamento" : "Itens de Treinamento"}
            </div>
            <div className="grid gap-2">
              {fileDocuments.map((doc) => (
                <div key={doc.id} className="rounded-lg border bg-card p-4 transition-all hover:shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 mr-4">
                      <div className="flex items-center">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/5 mr-3">
                          {getFileIcon(doc.name || "document.pdf")}
                        </div>
                        <div>
                          <div className="font-medium text-sm">
                            {doc.name}
                          </div>
                          {doc.description && (
                            <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                              {doc.description}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">
                            {formatDate(doc.created_at)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={`px-2 py-0.5 text-xs ${
                        doc.status === 'completed' 
                          ? 'bg-green-100 text-green-800 border border-green-200' 
                          : doc.status === 'processing'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : doc.status === 'error'
                          ? 'bg-red-100 text-red-800 border border-red-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {doc.status === 'completed' && <Check className="mr-1 h-3 w-3" />}
                        {doc.status === 'completed' ? 'Concluído' : 
                         doc.status === 'processing' ? 'Processando' : 
                         doc.status === 'error' ? 'Erro' : 'Pendente'}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Ações</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {doc.file_path && (
                            <DropdownMenuItem
                              className="flex cursor-pointer items-center"
                              onClick={() => window.open(`/api/training/documents/${doc.id}/download`, '_blank')}
                            >
                              <Download className="mr-2 h-4 w-4" />
                              <span>Download</span>
                            </DropdownMenuItem>
                          )}
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