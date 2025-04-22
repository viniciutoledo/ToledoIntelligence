import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useTraining } from "@/hooks/use-training";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Globe, Plus, MoreVertical, AlertCircle } from "lucide-react";
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

export function TrainingWebsite() {
  const { t } = useTranslation();
  const { 
    documents,
    documentsLoading,
    createDocumentMutation,
  } = useTraining();
  
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const websiteDocuments = documents?.filter(doc => doc.document_type === "website") || [];
  
  const handleWebsiteSubmit = async () => {
    if (!websiteUrl.trim()) return;
    
    setIsSubmitting(true);
    
    try {
      await createDocumentMutation.mutateAsync({
        name: `Website training ${new Date().toLocaleString()}`,
        document_type: "website",
        website_url: websiteUrl,
        description: null,
      });
      
      setWebsiteUrl("");
    } catch (error) {
      console.error("Error submitting website:", error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium mb-2">
          {t("admin.training.newWebsiteTraining")}
        </h2>
        <div className="bg-white border rounded-lg p-4">
          <div className="relative">
            <Input
              placeholder={t("admin.training.enterWebsiteUrl")}
              value={websiteUrl}
              onChange={e => setWebsiteUrl(e.target.value)}
              className="p-4 text-sm"
            />
          </div>
          <div className="flex justify-end mt-4">
            <Button
              type="button" 
              onClick={handleWebsiteSubmit}
              disabled={isSubmitting || !websiteUrl.trim()}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              {t("admin.training.submitWebsite")}
            </Button>
          </div>
        </div>
      </div>
      
      <div>
        <h2 className="text-lg font-medium mb-2">
          {t("admin.training.trainedWebsites")}
        </h2>
        
        <div className="space-y-4">
          {documentsLoading ? (
            <div className="text-center py-4">{t("common.loading")}</div>
          ) : websiteDocuments.length === 0 ? (
            <div className="text-center py-8 bg-neutral-50 rounded-lg border border-dashed">
              <Globe className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
              <p className="text-neutral-500">
                {t("admin.training.noWebsiteTrainings")}
              </p>
              <p className="text-sm text-neutral-400 mt-1">
                {t("admin.training.enterWebsiteToTrain")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {websiteDocuments.map((doc) => (
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
                    <div className="flex items-center text-sm text-blue-600">
                      <Globe className="h-4 w-4 mr-2" />
                      <a href={doc.website_url} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">
                        {doc.website_url}
                      </a>
                    </div>
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