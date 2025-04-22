import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useTraining } from "@/hooks/use-training";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FileText, UploadCloud, MoreVertical, Check, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface DocumentFormData {
  name: string;
  description: string | null;
  file?: File | null;
}

export function TrainingDocument() {
  const { t } = useTranslation();
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

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h3 className="text-sm font-medium mb-2 text-neutral-500">
          {t("admin.training.newDocumentTraining")} <span className="text-xs">via documento</span>
        </h3>
        <div className="bg-white rounded-md border">
          <div className="p-3">
            <div className="space-y-3">
              <div className="relative">
                <Label htmlFor="document_file" className="text-xs text-neutral-500">
                  {t("admin.training.documentFileLabel")}
                </Label>
                <div className="mt-1 flex items-center justify-center border-2 border-dashed border-neutral-200 rounded-md py-6 px-4">
                  {selectedFile ? (
                    <div className="text-center">
                      <FileText className="mx-auto h-10 w-10 text-neutral-400" />
                      <div className="mt-2 text-sm text-neutral-600">{selectedFile.name}</div>
                      <div className="mt-1 text-xs text-neutral-500">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedFile(null);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = "";
                          }
                        }}
                        className="mt-2 text-xs text-red-500 hover:text-red-600"
                      >
                        <X className="h-3 w-3 mr-1" /> {t("common.remove")}
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <UploadCloud className="mx-auto h-10 w-10 text-neutral-400" />
                      <div className="mt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isSubmitting}
                          className="text-xs"
                        >
                          {t("admin.training.selectDocumentFile")}
                        </Button>
                      </div>
                      <div className="mt-1 text-xs text-neutral-500">
                        {t("admin.training.documentSizeLimit")}
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
                <Label htmlFor="document_description" className="text-xs text-neutral-500">
                  {t("admin.training.descriptionLabel")}
                </Label>
                <Textarea
                  id="document_description"
                  placeholder={t("admin.training.documentDescriptionPlaceholder")}
                  value={documentDescription}
                  onChange={(e) => setDocumentDescription(e.target.value)}
                  className="mt-1 resize-none text-sm min-h-[80px]"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>
          <div className="border-t p-3 flex justify-between items-center">
            <div className="flex items-center">
              <FileText className="h-5 w-5 mr-2 text-neutral-500" />
              <span className="text-xs text-neutral-500">{t("admin.training.supportedDocumentFormats")}</span>
            </div>
            <Button
              size="sm"
              type="button"
              onClick={handleDocumentSubmit}
              disabled={isSubmitting || !selectedFile}
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
                t("admin.training.submitDocument")
              )}
            </Button>
          </div>
        </div>
      </div>

      <div>
        <div className="space-y-4">
          {documentsLoading ? (
            <div className="text-center py-4">{t("common.loading")}</div>
          ) : fileDocuments.length === 0 ? (
            <div className="text-center py-8 bg-neutral-50 rounded-lg border border-dashed">
              <FileText className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
              <p className="text-neutral-500">
                {t("admin.training.noDocumentTrainings")}
              </p>
              <p className="text-sm text-neutral-400 mt-1">
                {t("admin.training.uploadDocumentToTrain")}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {fileDocuments.map((doc) => (
                <div key={doc.id} className="bg-white border rounded-md hover:border-neutral-300 transition-colors">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-700 truncate">
                        {doc.name}
                      </p>
                      <p className="text-xs text-neutral-500 mt-1 truncate">
                        {doc.description || t("admin.training.noDescription")}
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