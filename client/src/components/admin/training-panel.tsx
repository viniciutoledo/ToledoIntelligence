import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrainingText } from "@/components/admin/training-text";
import { TrainingWebsite } from "@/components/admin/training-website";
import { TrainingDocument } from "@/components/admin/training-document";
import { TrainingVideo } from "@/components/admin/training-video";
import { FileText, Globe, FileVideo, File, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";

export function TrainingPanel() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("text");
  const [searchQuery, setSearchQuery] = useState("");

  // Extrair iniciais do nome para o avatar
  const getInitials = (name: string) => {
    if (!name) return "AV";
    const parts = name.split(" ");
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const avatarInitials = user?.email ? getInitials(user.email.split('@')[0]) : "AV";

  return (
    <div className="flex flex-col h-full">
      {/* Cabeçalho */}
      <div className="p-6 border-b">
        <h1 className="text-2xl font-semibold">Treinamento</h1>
      </div>

      <div className="flex-1 flex flex-col overflow-auto">
        <div className="p-6 flex-1">
          {/* Título da seção */}
          <h2 className="text-xl font-medium mb-6">Toledo IA</h2>
          
          {/* Área do avatar e informações do modelo */}
          <div className="flex mb-6">
            <div className="w-10 h-10 flex-shrink-0 mr-4">
              <Avatar className="w-10 h-10 border border-primary/20">
                <AvatarFallback className="bg-primary-foreground text-primary">
                  {avatarInitials}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">
                admin.training.modelDescription
              </p>
              <div className="mt-1 flex items-center">
                <div className="flex items-center text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                  <span className="mr-1">admin.training.currentModel: </span>
                  <span className="font-medium">GPT-4o</span>
                </div>
              </div>
            </div>
          </div>

          {/* Área de pesquisa de documentos de treinamento */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="admin.training.searchTraining"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Tabs de treinamento */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-4"
          >
            <TabsList className="inline-flex h-10 border rounded-md p-1 bg-background">
              <TabsTrigger
                value="text"
                className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-md px-3 py-1.5 text-sm font-medium"
              >
                Texto
              </TabsTrigger>
              <TabsTrigger
                value="website"
                className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-md px-3 py-1.5 text-sm font-medium"
              >
                Website
              </TabsTrigger>
              <TabsTrigger
                value="document"
                className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-md px-3 py-1.5 text-sm font-medium"
              >
                Documento
              </TabsTrigger>
              <TabsTrigger
                value="video"
                className="data-[state=active]:bg-primary data-[state=active]:text-white rounded-md px-3 py-1.5 text-sm font-medium"
              >
                Vídeo
              </TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="mt-4 focus-visible:outline-none">
              <TrainingText />
            </TabsContent>

            <TabsContent value="website" className="mt-4 focus-visible:outline-none">
              <TrainingWebsite />
            </TabsContent>

            <TabsContent value="document" className="mt-4 focus-visible:outline-none">
              <TrainingDocument />
            </TabsContent>

            <TabsContent value="video" className="mt-4 focus-visible:outline-none">
              <TrainingVideo />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}