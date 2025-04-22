import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useTraining } from "@/hooks/use-training";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Video, Upload, MoreVertical, DownloadCloud, Play } from "lucide-react";
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

export function TrainingVideo() {
  const { t } = useTranslation();
  const { 
    documents,
    documentsLoading,
    createDocumentFileMutation,
  } = useTraining();
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const videoDocuments = documents?.filter(doc => doc.document_type === "video") || [];
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
  };
  
  const handleFileSubmit = async () => {
    if (!selectedFile) return;
    
    setIsSubmitting(true);
    
    try {
      const formData = new FormData();
      formData.append("name", `Video training ${selectedFile.name}`);
      formData.append("document_type", "video");
      formData.append("file", selectedFile);
      
      await createDocumentFileMutation.mutateAsync(formData);
      
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error submitting video:", error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium mb-2">
          {t("admin.training.newVideoTraining")}
        </h2>
        <div className="bg-white border rounded-lg p-4">
          <div className="border-2 border-dashed border-neutral-200 rounded-lg p-6 text-center">
            <input
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="hidden"
              ref={fileInputRef}
            />
            
            {selectedFile ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <div className="bg-purple-50 p-3 rounded-lg">
                    <Video className="h-8 w-8 text-purple-500" />
                  </div>
                </div>
                <div>
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-neutral-500">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <div className="flex justify-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    type="button"
                    className="bg-purple-500 hover:bg-purple-600 text-white"
                    onClick={handleFileSubmit}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center">
                        <span className="animate-spin mr-2">
                          <DownloadCloud className="h-4 w-4" />
                        </span>
                        {t("admin.training.uploading")}
                      </span>
                    ) : (
                      t("admin.training.uploadVideo")
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-center">
                  <div className="bg-neutral-100 p-3 rounded-lg">
                    <Video className="h-8 w-8 text-neutral-400" />
                  </div>
                </div>
                <div>
                  <p className="font-medium">{t("admin.training.dragOrClickUploadVideo")}</p>
                  <p className="text-sm text-neutral-500">
                    {t("admin.training.supportedVideoFormats")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {t("admin.training.browseFiles")}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div>
        <h2 className="text-lg font-medium mb-2">
          {t("admin.training.trainedVideos")}
        </h2>
        
        <div className="space-y-4">
          {documentsLoading ? (
            <div className="text-center py-4">{t("common.loading")}</div>
          ) : videoDocuments.length === 0 ? (
            <div className="text-center py-8 bg-neutral-50 rounded-lg border border-dashed">
              <Video className="h-12 w-12 text-neutral-300 mx-auto mb-3" />
              <p className="text-neutral-500">
                {t("admin.training.noVideoTrainings")}
              </p>
              <p className="text-sm text-neutral-400 mt-1">
                {t("admin.training.uploadVideoToTrain")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {videoDocuments.map((doc) => (
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
                    <div className="flex items-center text-sm">
                      <div className="relative bg-neutral-100 w-full h-24 rounded flex items-center justify-center group">
                        <Play className="h-8 w-8 text-neutral-400 group-hover:text-neutral-600 transition-colors" />
                        <div className="absolute bottom-2 right-2 text-xs text-neutral-500 bg-white px-2 py-1 rounded">
                          {doc.file_metadata?.duration || "00:00"}
                        </div>
                      </div>
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