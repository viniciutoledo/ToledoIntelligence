import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrainingDocuments } from "@/components/admin/training-documents";
import { TrainingCategories } from "@/components/admin/training-categories";
import { TrainingText } from "@/components/admin/training-text";
import { TrainingWebsite } from "@/components/admin/training-website";
import { TrainingDocument } from "@/components/admin/training-document";
import { TrainingVideo } from "@/components/admin/training-video";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAvatar } from "@/hooks/use-avatar";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export function TrainingPanel() {
  const { t } = useTranslation();
  const { avatar } = useAvatar();
  const [activeTab, setActiveTab] = useState("text");

  return (
    <Card className="shadow-md">
      <CardHeader className="bg-gradient-to-r from-primary-50 to-accent-50 border-b">
        <CardTitle className="flex items-center text-xl">
          <span className="text-primary">{t("admin.training")}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex flex-col p-4 md:p-6">
          {/* Avatar e nome do assistente */}
          <div className="flex items-center mb-8">
            <div className="relative mr-4">
              <Avatar className="h-16 w-16 border-2 border-primary-100">
                {avatar?.image_url ? (
                  <AvatarImage src={avatar.image_url} alt={avatar.name} />
                ) : (
                  <AvatarFallback className="bg-primary-100 text-primary-700 font-bold text-xl">
                    T
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
            </div>
            <div>
              <h2 className="text-xl font-semibold">{avatar?.name || "Toledo IA"}</h2>
              <p className="text-sm text-neutral-500">{t("admin.training.supportedTypes")}</p>
            </div>
            <div className="ml-auto">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
                <Input
                  placeholder={t("admin.training.searchTraining")}
                  className="pl-9 h-9 w-[260px] bg-neutral-50"
                />
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex justify-center border-b pb-2 mb-6">
              <TabsList className="bg-transparent p-0 h-auto">
                <TabsTrigger 
                  value="text" 
                  className="text-sm font-medium border-b-2 border-transparent pb-1 px-6 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent rounded-none data-[state=active]:shadow-none"
                >
                  {t("admin.training.textTab")}
                </TabsTrigger>
                <TabsTrigger 
                  value="website" 
                  className="text-sm font-medium border-b-2 border-transparent pb-1 px-6 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent rounded-none data-[state=active]:shadow-none"
                >
                  {t("admin.training.websiteTab")}
                </TabsTrigger>
                <TabsTrigger 
                  value="video" 
                  className="text-sm font-medium border-b-2 border-transparent pb-1 px-6 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent rounded-none data-[state=active]:shadow-none"
                >
                  {t("admin.training.videoTab")}
                </TabsTrigger>
                <TabsTrigger 
                  value="document" 
                  className="text-sm font-medium border-b-2 border-transparent pb-1 px-6 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent rounded-none data-[state=active]:shadow-none"
                >
                  {t("admin.training.documentTab")}
                </TabsTrigger>
                <TabsTrigger 
                  value="manage" 
                  className="text-sm font-medium border-b-2 border-transparent pb-1 px-6 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent rounded-none data-[state=active]:shadow-none"
                >
                  {t("admin.training.manageTab")}
                </TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="text" className="mt-0">
              <TrainingText />
            </TabsContent>
            
            <TabsContent value="website" className="mt-0">
              <TrainingWebsite />
            </TabsContent>
            
            <TabsContent value="video" className="mt-0">
              <TrainingVideo />
            </TabsContent>
            
            <TabsContent value="document" className="mt-0">
              <TrainingDocument />
            </TabsContent>
            
            <TabsContent value="manage" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">{t("admin.training.documents")}</h3>
                  <TrainingDocuments />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-4">{t("admin.training.categories")}</h3>
                  <TrainingCategories />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  );
}