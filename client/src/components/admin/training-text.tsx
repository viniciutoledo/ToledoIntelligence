import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useTraining } from "@/hooks/use-training";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Plus, FileText, MoreVertical } from "lucide-react";
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
    createDocumentMutation,
  } = useTraining();
  
  const [textContent, setTextContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const textDocuments = documents?.filter(doc => doc.document_type === "text") || [];
  
  const handleTextSubmit = async () => {
    if (!textContent.trim()) return;
    
    setIsSubmitting(true);
    
    try {
      await createDocumentMutation.mutateAsync({
        name: `Text training ${new Date().toLocaleString()}`,
        document_type: "text",
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
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium mb-2">
          {t("admin.training.newTextTraining")}
        </h2>
        <div className="bg-white border rounded-lg p-4">
          <div className="relative">
            <Textarea
              placeholder={t("admin.training.enterTextContent")}
              value={textContent}
              onChange={e => setTextContent(e.target.value)}
              className="min-h-[200px] resize-none p-4 text-sm"
            />
            <div className="absolute top-2 right-2 flex items-center space-x-1 text-xs text-neutral-500">
              <span>{textContent.length}</span>
              <span>/</span>
              <span>1000</span>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button
              type="button" 
              onClick={handleTextSubmit}
              disabled={isSubmitting || !textContent.trim()}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              {t("admin.training.submitText")}
            </Button>
          </div>
        </div>
      </div>
      
      <div>
        <h2 className="text-lg font-medium mb-2">
          {t("admin.training.trainedTexts")}
        </h2>
        
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
            <div className="grid grid-cols-1 gap-4">
              {textDocuments.map((doc) => (
                <Card key={doc.id} className="bg-white border shadow-sm">
                  <CardHeader className="py-3 px-4 border-b bg-neutral-50 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-sm font-medium">
                      {doc.name}
                    </CardTitle>
                    <div className="flex items-center space-x-2">
                      <Badge className={`
                        ${doc.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : ''}
                        ${doc.status === 'processing' ? 'bg-blue-100 text-blue-800' : ''}
                        ${doc.status === 'completed' ? 'bg-green-100 text-green-800' : ''}
                        ${doc.status === 'error' ? 'bg-red-100 text-red-800' : ''}
                      `}>
                        {t(`admin.training.statusTypes.${doc.status}`)}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {/* View implementation */}}>
                            {t("common.view")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {/* Delete implementation */}}>
                            {t("common.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <p className="text-sm text-neutral-600 line-clamp-3">
                      {doc.content}
                    </p>
                  </CardContent>
                  <CardFooter className="py-2 px-4 border-t bg-neutral-50 text-xs text-neutral-500">
                    {t("admin.training.trainedOn")} {format(new Date(doc.created_at), "dd/MM/yyyy HH:mm")}
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}