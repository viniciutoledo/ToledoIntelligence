import { useState } from "react";
import { TabsContent, Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrainingDocuments } from "@/components/admin/training-documents";
import { TrainingCategories } from "@/components/admin/training-categories";
import { useLanguage } from "@/hooks/use-language";
import { TrainingProvider } from "@/hooks/use-training";

export function TrainingPanel() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("documents");

  return (
    <TrainingProvider>
      <Card className="border shadow-sm">
        <CardHeader className="bg-neutral-50 rounded-t-lg">
          <CardTitle className="text-xl font-semibold text-neutral-800 flex items-center space-x-2">
            <span>{t("admin.training.title")}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
              <TabsTrigger value="documents">{t("admin.training.documents")}</TabsTrigger>
              <TabsTrigger value="categories">{t("admin.training.categories")}</TabsTrigger>
            </TabsList>
            
            <TabsContent value="documents" className="mt-4">
              <TrainingDocuments />
            </TabsContent>
            
            <TabsContent value="categories" className="mt-4">
              <TrainingCategories />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </TrainingProvider>
  );
}