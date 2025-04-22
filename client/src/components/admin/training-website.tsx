import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useTraining } from "@/hooks/use-training";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Globe, MoreVertical, Check, LinkIcon, ExternalLinkIcon, ClipboardIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";

export function TrainingWebsite() {
  // Estamos sobrescrevendo o hook de tradução para mostrar as chaves diretas
  const { i18n } = useTranslation();
  // Este é um hook fictício que apenas retorna a chave de tradução
  const t = (key: string) => key;
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

  const formatDate = (date: string) => {
    const dateObj = new Date(date);
    return format(
      dateObj,
      "d MMM yyyy, HH:mm",
      { locale: i18n.language === 'pt' ? ptBR : enUS }
    );
  };

  const formatUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url;
    }
  };

  return (
    <div>
      {/* Cabeçalho do novo treinamento */}
      <div className="flex items-center mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
          <Globe className="h-4 w-4 text-primary" />
        </div>
        <h3 className="ml-2 text-base font-medium">admin.training.newWebsiteTraining</h3>
      </div>

      {/* Formulário de website */}
      <div className="mb-6 rounded-lg border bg-card">
        <div className="p-4 space-y-3">
          <div>
            <Label htmlFor="website_url" className="text-sm text-muted-foreground mb-1 block">
              admin.training.websiteUrlLabel
            </Label>
            <div className="flex items-center">
              <LinkIcon className="h-4 w-4 text-muted-foreground mr-2" />
              <Input
                id="website_url"
                type="url"
                placeholder="https://..."
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                className="border-0 px-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="website_name" className="text-sm text-muted-foreground mb-1 block">
              admin.training.nameLabel <span className="text-xs text-muted-foreground">common.optional</span>
            </Label>
            <Input
              id="website_name"
              type="text"
              placeholder="admin.training.websiteNamePlaceholder"
              value={websiteName}
              onChange={(e) => setWebsiteName(e.target.value)}
              className="text-sm"
              disabled={isSubmitting}
            />
          </div>
          
          <div>
            <Label htmlFor="website_description" className="text-sm text-muted-foreground mb-1 block">
              admin.training.descriptionLabel <span className="text-xs text-muted-foreground">common.optional</span>
            </Label>
            <Textarea
              id="website_description"
              placeholder="admin.training.websiteDescriptionPlaceholder"
              value={websiteDescription}
              onChange={(e) => setWebsiteDescription(e.target.value)}
              className="resize-none text-sm min-h-[80px]"
              disabled={isSubmitting}
            />
          </div>
        </div>
        
        <div className="flex items-center justify-between border-t bg-muted/20 px-4 py-2">
          <div className="text-xs text-muted-foreground">
            admin.training.websiteInfo
          </div>
          <Button
            type="button" 
            onClick={handleWebsiteSubmit}
            disabled={isSubmitting || !websiteUrl.trim()}
            size="sm"
            className="h-8"
          >
            {isSubmitting ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                admin.training.submitWebsite
              </span>
            ) : (
              "admin.training.submitWebsite"
            )}
          </Button>
        </div>
      </div>
      
      {/* Lista de websites */}
      <div className="space-y-2">
        {documentsLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : websiteDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <Globe className="h-10 w-10 text-muted-foreground/60" />
            </div>
            <h3 className="mt-4 text-lg font-medium">{t("admin.training.noWebsiteTrainings")}</h3>
            <p className="mt-2 text-sm text-muted-foreground text-center max-w-sm">
              {t("admin.training.addWebsiteToTrain")}
            </p>
          </div>
        ) : (
          <>
            <div className="text-sm font-medium text-muted-foreground mb-2">
              {websiteDocuments.length} {websiteDocuments.length === 1 ? t("admin.training.trainingItem") : t("admin.training.trainingItems")}
            </div>
            <div className="grid gap-2">
              {websiteDocuments.map((doc) => (
                <div key={doc.id} className="rounded-lg border bg-card p-4 transition-all hover:shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 mr-4">
                      <div className="flex items-center">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/5 mr-3">
                          <Globe className="h-4 w-4 text-primary/80" />
                        </div>
                        <div>
                          <div className="font-medium text-sm">
                            {doc.name}
                          </div>
                          <div className="flex items-center text-xs text-muted-foreground mt-1">
                            <span className="mr-1">{formatUrl(doc.website_url || "")}</span>
                            {doc.website_url && (
                              <a 
                                href={doc.website_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-primary"
                              >
                                <ExternalLinkIcon className="h-3 w-3" />
                              </a>
                            )}
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
                        {t(`admin.training.statusTypes.${doc.status}`)}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">{t("common.actions")}</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="flex cursor-pointer items-center"
                            onClick={() => navigator.clipboard.writeText(doc.website_url || '')}
                          >
                            <ClipboardIcon className="mr-2 h-4 w-4" />
                            <span>{t("common.copyLink")}</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="flex cursor-pointer items-center text-red-600 focus:text-red-600" 
                            onClick={() => handleDeleteDocument(doc.id)}
                          >
                            <span>{t("common.delete")}</span>
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