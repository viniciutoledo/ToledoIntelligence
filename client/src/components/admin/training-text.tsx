import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useTraining } from "@/hooks/use-training";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileText, MoreVertical, Check } from "lucide-react";
import { 
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export function TrainingText() {
  const { t } = useTranslation();
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
  
  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h3 className="text-sm font-medium mb-2 text-neutral-500">
          {t("admin.training.newTextTraining")} <span className="text-xs">via texto</span>
        </h3>
        <div className="relative bg-white rounded-md border">
          <div className="p-3 flex items-start">
            <div className="w-full">
              <Textarea
                placeholder={t("admin.training.enterTextContent")}
                value={textContent}
                onChange={e => setTextContent(e.target.value)}
                className="min-h-[100px] resize-none border-0 p-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <div className="absolute bottom-3 right-3 flex items-center space-x-1 text-xs text-neutral-400">
                <span>{textContent.length}</span>
                <span>/</span>
                <span>1000</span>
              </div>
            </div>
          </div>
          <div className="border-t p-3 flex justify-between items-center">
            <div className="flex items-center">
              <FileText className="h-5 w-5 mr-2 text-neutral-500" />
              <span className="text-xs text-neutral-500">{t("admin.training.supportedFileTypes")}</span>
            </div>
            <Button
              size="sm"
              type="button" 
              onClick={handleTextSubmit}
              disabled={isSubmitting || !textContent.trim()}
              className="bg-primary hover:bg-primary/90 text-white text-xs py-1 px-3 h-8"
            >
              {isSubmitting ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t("common.processing")}
                </span>
              ) : (
                t("admin.training.submitText")
              )}
            </Button>
          </div>
        </div>
      </div>
      
      <div>        
        <div className="space-y-4">
          {documentsLoading ? (
            <div className="text-center py-4">{t("common.loading")}</div>
          ) : textDocuments.length === 0 ? (
            <div className="text-center py-8 bg-neutral-50 rounded-lg border border-dashed">
              <FileText className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
              <p className="text-neutral-500">
                {t("admin.training.noTextTrainings")}
              </p>
              <p className="text-sm text-neutral-400 mt-1">
                {t("admin.training.enterTextToTrain")}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {textDocuments.map((doc) => (
                <div key={doc.id} className="bg-white border rounded-md hover:border-neutral-300 transition-colors">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-700 truncate">
                        {doc.content?.substring(0, 80)}...
                      </p>
                    </div>
                    <div className="flex items-center ml-4 space-x-2">
                      <Badge className={`text-xs px-2 py-0.5 ${
                        doc.status === 'completed' 
                          ? 'bg-green-50 text-green-700 border border-green-200' 
                          : doc.status === 'processing'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : doc.status === 'error'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                      }`}>
                        {doc.status === 'completed' && <Check className="h-3 w-3 mr-1" />}
                        {t(`admin.training.statusTypes.${doc.status}`)}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">{t("common.actions")}</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[160px]">
                          <DropdownMenuItem 
                            className="text-red-600 cursor-pointer focus:text-red-600" 
                            onClick={() => handleDeleteDocument(doc.id)}
                          >
                            {t("common.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}