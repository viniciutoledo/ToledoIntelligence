import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrainingDocuments } from "@/components/admin/training-documents";
import { TrainingCategories } from "@/components/admin/training-categories";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export function TrainingPanel() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("documents");

  return (
    <Card className="shadow-md">
      <CardHeader className="bg-gradient-to-r from-primary-50 to-accent-50 border-b">
        <CardTitle className="flex items-center text-xl">
          <span className="text-primary">{t("admin.training")}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex flex-col p-4 md:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="border-b pb-2 mb-6">
              <TabsList className="bg-transparent p-0 h-auto">
                <TabsTrigger 
                  value="documents" 
                  className="text-sm font-medium border-b-2 border-transparent pb-1 px-4 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none data-[state=active]:shadow-none"
                >
                  {t("admin.training.documents")}
                </TabsTrigger>
                <TabsTrigger 
                  value="categories" 
                  className="text-sm font-medium border-b-2 border-transparent pb-1 px-4 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none data-[state=active]:shadow-none"
                >
                  {t("admin.training.categories")}
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="documents" className="mt-0">
              <TrainingDocuments />
            </TabsContent>
            <TabsContent value="categories" className="mt-0">
              <TrainingCategories />
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  );
}