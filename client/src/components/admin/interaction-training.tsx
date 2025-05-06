import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { Loader2, BrainCircuit, MessagesSquare, CheckCircle, Database, Calendar } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { formatDistanceToNow, format } from "date-fns";
import { pt, enUS } from "date-fns/locale";

// Tipo para sessão de chat
interface ChatSession {
  id: number;
  started_at: string;
  language: string;
}

// Tipo para resposta de sessões recentes
interface RecentSessionsResponse {
  count: number;
  cutoffDate: string;
  sessions: ChatSession[];
}

export function InteractionTraining() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const dateLocale = language === "pt" ? pt : enUS;
  
  // Estado para controlar os parâmetros de processamento
  const [daysAgo, setDaysAgo] = useState<number>(7);
  const [maxInteractions, setMaxInteractions] = useState<number>(50);
  const [autoCategories, setAutoCategories] = useState<boolean>(true);

  // Buscar sessões recentes
  const { 
    data: recentSessions,
    isLoading: isLoadingSessions,
    refetch: refetchSessions
  } = useQuery<RecentSessionsResponse>({
    queryKey: ["/api/training/interactions/recent-sessions", daysAgo],
    queryFn: async () => {
      const response = await apiRequest(
        "GET", 
        `/api/training/interactions/recent-sessions?daysAgo=${daysAgo}`
      );
      return await response.json();
    },
    refetchOnWindowFocus: false
  });

  // Mutation para processar interações como documentos de treinamento
  const processMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        "POST", 
        "/api/training/interactions/process", 
        { daysAgo, maxInteractions }
      );
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: t("admin.training.interactionsProcessed"),
        description: `${data.processedCount} interactions successfully converted to training documents`,
        variant: "default"
      });
      
      // Atualizar documentos de treinamento e categorias
      queryClient.invalidateQueries({ queryKey: ["/api/training/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/training/categories"] });
    },
    onError: (error: Error) => {
      toast({
        title: t("admin.training.processingError"),
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Renderizar estatísticas sobre as sessões recentes
  const renderSessionStats = () => {
    if (isLoadingSessions) {
      return (
        <div className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      );
    }

    if (!recentSessions || recentSessions.count === 0) {
      return (
        <div className="text-center p-6 text-muted-foreground">
          <MessagesSquare className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p>{t("admin.training.noRecentSessions")}</p>
        </div>
      );
    }

    return (
      <div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-card rounded-md p-4 border">
            <div className="flex items-center">
              <MessagesSquare className="h-5 w-5 mr-2 text-primary" />
              <h4 className="font-medium">{t("admin.training.totalSessions")}</h4>
            </div>
            <p className="text-2xl font-bold mt-2">{recentSessions.count}</p>
          </div>
          
          <div className="bg-card rounded-md p-4 border">
            <div className="flex items-center">
              <Calendar className="h-5 w-5 mr-2 text-primary" />
              <h4 className="font-medium">{t("admin.training.periodCovered")}</h4>
            </div>
            <p className="text-sm mt-2">
              {format(new Date(recentSessions.cutoffDate), "PPP", { locale: dateLocale })} - {t("admin.training.today")}
            </p>
          </div>
          
          <div className="bg-card rounded-md p-4 border">
            <div className="flex items-center">
              <Database className="h-5 w-5 mr-2 text-primary" />
              <h4 className="font-medium">{t("admin.training.toBeProcessed")}</h4>
            </div>
            <p className="text-2xl font-bold mt-2">
              {Math.min(recentSessions.count, maxInteractions)}
            </p>
          </div>
        </div>
        
        {recentSessions.sessions && recentSessions.sessions.length > 0 && (
          <div className="mt-4">
            <h4 className="font-medium mb-2">{t("admin.training.recentSessionsList")}</h4>
            <div className="max-h-[200px] overflow-y-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2">{t("admin.training.sessionId")}</th>
                    <th className="text-left p-2">{t("admin.training.startDate")}</th>
                    <th className="text-left p-2">{t("admin.training.language")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recentSessions.sessions.slice(0, 10).map((session: any) => (
                    <tr key={session.id} className="hover:bg-muted/50">
                      <td className="p-2">{session.id}</td>
                      <td className="p-2">
                        {formatDistanceToNow(new Date(session.started_at), { 
                          addSuffix: true,
                          locale: dateLocale
                        })}
                      </td>
                      <td className="p-2">
                        <Badge variant="outline">
                          {session.language === "pt" ? "Português" : "English"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {recentSessions.sessions.length > 10 && (
                    <tr>
                      <td colSpan={3} className="p-2 text-center text-muted-foreground">
                        {t("admin.training.andMoreSessions", { count: recentSessions.sessions.length - 10 })}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center">
          <BrainCircuit className="h-6 w-6 mr-2 text-primary" />
          <CardTitle>{t("admin.training.interactionTraining")}</CardTitle>
        </div>
        <CardDescription>
          {t("admin.training.interactionTrainingDescription")}
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            {renderSessionStats()}
          </div>
          
          <div className="space-y-4 border-l pl-4">
            <h4 className="font-medium text-sm">{t("admin.training.processingOptions")}</h4>
            
            <div className="space-y-2">
              <Label>{t("admin.training.timeRange")}: {daysAgo} {t("admin.training.days")}</Label>
              <Slider
                value={[daysAgo]}
                min={1}
                max={30}
                step={1}
                onValueChange={(value) => setDaysAgo(value[0])}
              />
              <p className="text-xs text-muted-foreground">
                {t("admin.training.timeRangeDescription")}
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>{t("admin.training.maxSessions")}</Label>
              <Input
                type="number"
                value={maxInteractions}
                onChange={(e) => setMaxInteractions(parseInt(e.target.value) || 10)}
                min={5}
                max={200}
              />
              <p className="text-xs text-muted-foreground">
                {t("admin.training.maxSessionsDescription")}
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-categories">{t("admin.training.autoCategories")}</Label>
                <Switch
                  id="auto-categories"
                  checked={autoCategories}
                  onCheckedChange={setAutoCategories}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t("admin.training.autoCategoriesDescription")}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
      
      <Separator className="my-2" />
      
      <CardFooter className="flex justify-between pt-4">
        <Button 
          variant="outline" 
          onClick={() => refetchSessions()}
          disabled={isLoadingSessions}
        >
          {isLoadingSessions ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <MessagesSquare className="h-4 w-4 mr-2" />
          )}
          {t("admin.training.refreshSessions")}
        </Button>
        
        <Button 
          onClick={() => processMutation.mutate()}
          disabled={processMutation.isPending || isLoadingSessions || !recentSessions || recentSessions.count === 0}
        >
          {processMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <BrainCircuit className="h-4 w-4 mr-2" />
          )}
          {t("admin.training.processInteractions")}
        </Button>
      </CardFooter>
    </Card>
  );
}