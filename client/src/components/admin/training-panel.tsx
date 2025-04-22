import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrainingText } from "@/components/admin/training-text";
import { TrainingWebsite } from "@/components/admin/training-website";
import { TrainingDocument } from "@/components/admin/training-document";
import { TrainingVideo } from "@/components/admin/training-video";
import { FileText, Globe, FileVideo, File } from "lucide-react";

export function TrainingPanel() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("text");

  return (
    <div className="p-6">
      <div className="flex flex-col space-y-1.5 mb-6">
        <h2 className="text-2xl font-semibold tracking-tight">
          {t("admin.training.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("admin.training.description")}
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="grid grid-cols-4 h-auto p-1">
          <TabsTrigger
            value="text"
            className={`flex items-center gap-2 py-2 ${
              activeTab === "text"
                ? "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                : ""
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>{t("admin.training.textTab")}</span>
          </TabsTrigger>
          <TabsTrigger
            value="website"
            className={`flex items-center gap-2 py-2 ${
              activeTab === "website"
                ? "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                : ""
            }`}
          >
            <Globe className="h-4 w-4" />
            <span>{t("admin.training.websiteTab")}</span>
          </TabsTrigger>
          <TabsTrigger
            value="document"
            className={`flex items-center gap-2 py-2 ${
              activeTab === "document"
                ? "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                : ""
            }`}
          >
            <File className="h-4 w-4" />
            <span>{t("admin.training.documentTab")}</span>
          </TabsTrigger>
          <TabsTrigger
            value="video"
            className={`flex items-center gap-2 py-2 ${
              activeTab === "video"
                ? "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                : ""
            }`}
          >
            <FileVideo className="h-4 w-4" />
            <span>{t("admin.training.videoTab")}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="text" className="mt-6">
          <TrainingText />
        </TabsContent>

        <TabsContent value="website" className="mt-6">
          <TrainingWebsite />
        </TabsContent>

        <TabsContent value="document" className="mt-6">
          <TrainingDocument />
        </TabsContent>

        <TabsContent value="video" className="mt-6">
          <TrainingVideo />
        </TabsContent>
      </Tabs>
    </div>
  );
}