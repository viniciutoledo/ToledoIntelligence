import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useTraining } from "@/hooks/use-training";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Globe, MoreVertical, Check } from "lucide-react";
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
    createWebsiteDocumentMutation,
    deleteDocumentMutation,
  } = useTraining();

  const [websiteUrl, setWebsiteUrl] = useState("");
  const [websiteName, setWebsiteName] = useState("");
  const [websiteDescription, setWebsiteDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const websiteDocuments = documents?.filter(doc => doc.document_type === "website") || [];

  const handleWebsiteSubmit = async () => {
    if (!websiteUrl.trim() || isSubmitting) return;

    setIsSubmitting(true);

    try {
      await createWebsiteDocumentMutation.mutateAsync({
        name: websiteName || websiteUrl,
        description: websiteDescription || null,
        website_url: websiteUrl,
      });

      // Reset form
      setWebsiteUrl("");
      setWebsiteName("");
      setWebsiteDescription("");
    } catch (error) {
      console.error("Error submitting website:", error);
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
          {t("admin.training.newWebsiteTraining")} <span className="text-xs">via website</span>
        </h3>
        <div className="bg-white rounded-md border">
          <div className="p-3">
            <div className="space-y-3">
              <div>
                <Label htmlFor="website_url" className="text-xs text-neutral-500">
                  {t("admin.training.websiteUrlLabel")}
                </Label>
                <Input
                  id="website_url"
                  type="url"
                  placeholder="https://..."
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  className="mt-1 text-sm"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <Label htmlFor="website_name" className="text-xs text-neutral-500">
                  {t("admin.training.nameLabel")}
                </Label>
                <Input
                  id="website_name"
                  type="text"
                  placeholder={t("admin.training.websiteNamePlaceholder")}
                  value={websiteName}
                  onChange={(e) => setWebsiteName(e.target.value)}
                  className="mt-1 text-sm"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <Label htmlFor="website_description" className="text-xs text-neutral-500">
                  {t("admin.training.descriptionLabel")}
                </Label>
                <Textarea
                  id="website_description"
                  placeholder={t("admin.training.websiteDescriptionPlaceholder")}
                  value={websiteDescription}
                  onChange={(e) => setWebsiteDescription(e.target.value)}
                  className="mt-1 resize-none text-sm min-h-[80px]"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>
          <div className="border-t p-3 flex justify-between items-center">
            <div className="flex items-center">
              <Globe className="h-5 w-5 mr-2 text-neutral-500" />
              <span className="text-xs text-neutral-500">{t("admin.training.websiteInfo")}</span>
            </div>
            <Button
              size="sm"
              type="button"
              onClick={handleWebsiteSubmit}
              disabled={isSubmitting || !websiteUrl.trim()}
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
                t("admin.training.submitWebsite")
              )}
            </Button>
          </div>
        </div>
      </div>

      <div>
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
                {t("admin.training.addWebsiteToTrain")}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {websiteDocuments.map((doc) => (
                <div key={doc.id} className="bg-white border rounded-md hover:border-neutral-300 transition-colors">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-700 truncate">
                        {doc.name}
                      </p>
                      <p className="text-xs text-neutral-500 mt-1 truncate">
                        {doc.website_url}
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