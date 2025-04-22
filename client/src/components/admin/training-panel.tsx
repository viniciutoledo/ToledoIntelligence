import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrainingDocuments } from "@/components/admin/training-documents";
import { TrainingCategories } from "@/components/admin/training-categories";

export function TrainingPanel() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("documents");

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-1.5">
        <h2 className="text-2xl font-semibold tracking-tight">{t("admin.training")}</h2>
        <p className="text-muted-foreground">{t("admin.trainingDescription")}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="documents">{t("admin.training.documents")}</TabsTrigger>
          <TabsTrigger value="categories">{t("admin.training.categories")}</TabsTrigger>
        </TabsList>
        <TabsContent value="documents" className="space-y-4">
          <TrainingDocuments />
        </TabsContent>
        <TabsContent value="categories" className="space-y-4">
          <TrainingCategories />
        </TabsContent>
      </Tabs>
    </div>
  );
}