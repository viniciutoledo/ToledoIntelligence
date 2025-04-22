import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useTraining } from "@/hooks/use-training";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FileVideo, UploadCloud, MoreVertical, Check, X, Link2, ClipboardIcon, ExternalLink } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface VideoFormData {
  name: string;
  description: string | null;
  video_url?: string;
  file?: File | null;
}

export function TrainingVideo() {
  const { t, i18n } = useTranslation();
  const {
    documents,
    documentsLoading,
    createVideoDocumentMutation,
    deleteDocumentMutation,
  } = useTraining();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [videoDescription, setVideoDescription] = useState("");
  const [activeTab, setActiveTab] = useState("url");

  const videoDocuments = documents?.filter(doc => doc.document_type === "video") || [];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type.startsWith("video/")) {
        setSelectedFile(file);
        setVideoUrl("");
      } else {
        alert(t("admin.training.invalidVideoFormat"));
        e.target.value = "";
      }
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVideoUrl(e.target.value);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleVideoSubmit = async () => {
    if ((!videoUrl && !selectedFile) || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      
      if (selectedFile) {
        formData.append("file", selectedFile);
        formData.append("name", selectedFile.name);
        formData.append("description", videoDescription || "");
        formData.append("document_type", "video");
      } else if (videoUrl) {
        const videoName = videoUrl.split("/").pop() || `Video ${new Date().toLocaleString()}`;
        
        await createVideoDocumentMutation.mutateAsync({
          name: videoName,
          description: videoDescription || null,
          website_url: videoUrl,
        });
      }

      // Reset form
      setVideoUrl("");
      setSelectedFile(null);
      setVideoDescription("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error submitting video:", error);
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

  const getVideoThumbnail = (url: string) => {
    if (url?.includes('youtube.com') || url?.includes('youtu.be')) {
      const videoId = url.includes('youtube.com') 
        ? url.split('v=')[1]?.split('&')[0] 
        : url.split('youtu.be/')[1]?.split('?')[0];
        
      if (videoId) {
        return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
      }
    }
    
    return null;
  };

  return (
    <div>
      {/* Cabeçalho do novo treinamento */}
      <div className="flex items-center mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
          <FileVideo className="h-4 w-4 text-primary" />
        </div>
        <h3 className="ml-2 text-base font-medium">admin.training.newVideoTraining</h3>
      </div>

      {/* Área de upload de vídeo */}
      <div className="mb-6 rounded-lg border bg-card">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <div className="border-b">
            <TabsList className="flex h-10 w-full rounded-none border-b bg-transparent p-0">
              <TabsTrigger
                value="url"
                className="flex-1 rounded-none border-b-2 border-transparent px-3 py-2 data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                admin.training.videoUrlTab
              </TabsTrigger>
              <TabsTrigger
                value="upload"
                className="flex-1 rounded-none border-b-2 border-transparent px-3 py-2 data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                admin.training.videoFileTab
              </TabsTrigger>
            </TabsList>
          </div>
          
          <div className="p-4 space-y-4">
            <TabsContent value="url" className="m-0">
              <div>
                <Label htmlFor="video_url" className="text-sm text-muted-foreground mb-1 block">
                  admin.training.videoUrlLabel
                </Label>
                <div className="flex items-center">
                  <Link2 className="h-4 w-4 text-muted-foreground mr-2" />
                  <Input
                    id="video_url"
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={videoUrl}
                    onChange={handleUrlChange}
                    className="border-0 px-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
                  />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="upload" className="m-0">
              <div>
                <Label htmlFor="video_file" className="text-sm text-muted-foreground mb-1 block">
                  admin.training.videoFileLabel
                </Label>
                
                <div className="mt-1 flex items-center justify-center border-2 border-dashed rounded-lg py-6 px-4 transition-colors hover:border-primary/50 cursor-pointer">
                  {selectedFile ? (
                    <div className="text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <FileVideo className="h-6 w-6 text-primary" />
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
                        <X className="h-3 w-3 mr-1" /> common.remove
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
                          admin.training.selectVideoFile
                        </Button>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        admin.training.videoSizeLimit
                      </div>
                    </div>
                  )}
                  <input
                    id="video_file"
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </TabsContent>
            
            <div>
              <Label htmlFor="video_description" className="text-sm text-muted-foreground mb-1 block">
                admin.training.descriptionLabel <span className="text-xs text-muted-foreground">common.optional</span>
              </Label>
              <Textarea
                id="video_description"
                placeholder="admin.training.videoDescriptionPlaceholder"
                value={videoDescription}
                onChange={(e) => setVideoDescription(e.target.value)}
                className="resize-none text-sm min-h-[80px]"
                disabled={isSubmitting}
              />
            </div>
          </div>
          
          <div className="flex items-center justify-between border-t bg-muted/20 px-4 py-2">
            <div className="text-xs text-muted-foreground">
              {activeTab === 'url' 
                ? "admin.training.supportedVideoServices" 
                : "admin.training.supportedVideoFormats"}
            </div>
            <Button
              type="button" 
              onClick={handleVideoSubmit}
              disabled={isSubmitting || (activeTab === 'url' ? !videoUrl : !selectedFile)}
              size="sm"
              className="h-8"
            >
              {isSubmitting ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  admin.training.submitVideo
                </span>
              ) : (
                "admin.training.submitVideo"
              )}
            </Button>
          </div>
        </Tabs>
      </div>
      
      {/* Lista de vídeos */}
      <div className="space-y-2">
        {documentsLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : videoDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <FileVideo className="h-10 w-10 text-muted-foreground/60" />
            </div>
            <h3 className="mt-4 text-lg font-medium">admin.training.noVideoTrainings</h3>
            <p className="mt-2 text-sm text-muted-foreground text-center max-w-sm">
              admin.training.uploadVideoToTrain
            </p>
          </div>
        ) : (
          <>
            <h3 className="text-base font-medium mb-2">admin.training.noVideoTrainings</h3>
            <div className="grid gap-2">
              {videoDocuments.map((doc) => (
                <div key={doc.id} className="rounded-lg border bg-card p-4 transition-all hover:shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 mr-4">
                      <div className="flex">
                        {doc.website_url && getVideoThumbnail(doc.website_url) ? (
                          <div className="w-20 h-14 rounded-md overflow-hidden mr-3 flex-shrink-0 bg-muted">
                            <img 
                              src={getVideoThumbnail(doc.website_url)} 
                              alt={doc.name} 
                              className="w-full h-full object-cover" 
                            />
                          </div>
                        ) : (
                          <div className="flex h-14 w-20 items-center justify-center rounded-md bg-primary/5 mr-3 flex-shrink-0">
                            <FileVideo className="h-6 w-6 text-primary/80" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-sm">
                            {doc.name}
                          </div>
                          {doc.website_url && (
                            <div className="flex items-center text-xs text-muted-foreground mt-1">
                              <span className="truncate max-w-[200px]">{doc.website_url}</span>
                              <a 
                                href={doc.website_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="ml-1 text-muted-foreground hover:text-primary"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          )}
                          {doc.description && (
                            <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                              {doc.description}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">
                            admin.training.videoSizeLimit
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className="px-2 py-0.5 text-xs bg-green-100 text-green-800 border border-green-200">
                        <Check className="mr-1 h-3 w-3" />
                        Treinado
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">common.actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {doc.website_url && (
                            <DropdownMenuItem
                              className="flex cursor-pointer items-center"
                              onClick={() => navigator.clipboard.writeText(doc.website_url || '')}
                            >
                              <ClipboardIcon className="mr-2 h-4 w-4" />
                              <span>common.copyLink</span>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem 
                            className="flex cursor-pointer items-center text-red-600 focus:text-red-600" 
                            onClick={() => handleDeleteDocument(doc.id)}
                          >
                            <span>common.delete</span>
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