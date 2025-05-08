import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/hooks/use-language";
import { Loader2, Users, MessageCircle, Clock, BarChart2, MonitorSmartphone, Activity } from "lucide-react";
import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DashboardStats {
  userCount: number;
  technicianCount: number;
  adminCount: number;
  activeUsers: number;
  blockedUsers: number;
  totalChatSessions: number;
  activeChatSessions: number;
  messageCount: number;
  averageResponseTime: number;
  // Estatísticas de widgets
  widgetCount: number;
  activeWidgets: number;
  widgetSessions: number;
  widgetMessages: number;
  widgetUsersImpacted: number;
}

export function AdminDashboard() {
  const { t } = useLanguage();

  // Consulta as estatísticas do dashboard
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/stats"],
    refetchOnMount: true, // Sempre atualizar ao montar o componente
    refetchOnWindowFocus: true, // Atualizar quando a janela ganhar foco
    staleTime: 30000, // Considerar dados obsoletos após 30 segundos
    // Removido initialData para forçar a busca real dos dados
  });

  if (isLoading || !stats) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  // Valores iniciais para quando a API não retornar dados
  const defaultStats: DashboardStats = {
    userCount: 0,
    technicianCount: 0,
    adminCount: 0,
    activeUsers: 0,
    blockedUsers: 0,
    totalChatSessions: 0,
    activeChatSessions: 0,
    messageCount: 0,
    averageResponseTime: 0,
    widgetCount: 0,
    activeWidgets: 0,
    widgetSessions: 0, 
    widgetMessages: 0,
    widgetUsersImpacted: 0,
  };
  
  // Combina os valores retornados pela API com os valores padrão
  const displayStats = { ...defaultStats, ...stats };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="platform" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="platform">{t("admin.platformStats")}</TabsTrigger>
          <TabsTrigger value="widgets">{t("admin.widgetsStats")}</TabsTrigger>
        </TabsList>
        
        <TabsContent value="platform" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Cartão de Usuários */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <CardDescription>{t("admin.users")}</CardDescription>
                    <CardTitle className="text-3xl font-bold mt-2">
                      {displayStats.userCount}
                    </CardTitle>
                    <div className="text-sm text-neutral-500 mt-1">
                      {displayStats.technicianCount} {t("auth.technician")} / {displayStats.adminCount} {t("auth.admin")}
                    </div>
                  </div>
                  <div className="bg-blue-100 p-3 rounded-full">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                <div className="mt-4 text-sm">
                  <div className="flex justify-between">
                    <span>{t("admin.active")}</span>
                    <span className="font-medium">{displayStats.activeUsers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("admin.blocked")}</span>
                    <span className="font-medium">{displayStats.blockedUsers}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cartão de Sessões de Chat */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <CardDescription>{t("admin.chatSessions")}</CardDescription>
                    <CardTitle className="text-3xl font-bold mt-2">
                      {displayStats.totalChatSessions}
                    </CardTitle>
                    <div className="text-sm text-neutral-500 mt-1">
                      {displayStats.activeChatSessions} {t("admin.activeSessions")}
                    </div>
                  </div>
                  <div className="bg-green-100 p-3 rounded-full">
                    <MessageCircle className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cartão de Mensagens */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <CardDescription>{t("admin.totalMessages")}</CardDescription>
                    <CardTitle className="text-3xl font-bold mt-2">
                      {displayStats.messageCount}
                    </CardTitle>
                  </div>
                  <div className="bg-purple-100 p-3 rounded-full">
                    <BarChart2 className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cartão de Tempo de Resposta */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <CardDescription>{t("admin.avgResponseTime")}</CardDescription>
                    <CardTitle className="text-3xl font-bold mt-2">
                      {displayStats.averageResponseTime > 0 
                        ? `${displayStats.averageResponseTime.toFixed(1)}s` 
                        : "-"}
                    </CardTitle>
                  </div>
                  <div className="bg-amber-100 p-3 rounded-full">
                    <Clock className="h-6 w-6 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="widgets" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Cartão de Total de Widgets */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <CardDescription>{t("admin.widgetsTotal")}</CardDescription>
                    <CardTitle className="text-3xl font-bold mt-2">
                      {displayStats.widgetCount}
                    </CardTitle>
                    <div className="text-sm text-neutral-500 mt-1">
                      {displayStats.activeWidgets} {t("admin.active")}
                    </div>
                  </div>
                  <div className="bg-indigo-100 p-3 rounded-full">
                    <MonitorSmartphone className="h-6 w-6 text-indigo-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cartão de Sessões de Widget */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <CardDescription>{t("admin.widgetSessions")}</CardDescription>
                    <CardTitle className="text-3xl font-bold mt-2">
                      {displayStats.widgetSessions}
                    </CardTitle>
                    <div className="text-sm text-neutral-500 mt-1">
                      {displayStats.widgetUsersImpacted} {t("admin.uniqueVisitors")}
                    </div>
                  </div>
                  <div className="bg-cyan-100 p-3 rounded-full">
                    <Activity className="h-6 w-6 text-cyan-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cartão de Mensagens de Widget */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <CardDescription>{t("admin.widgetMessages")}</CardDescription>
                    <CardTitle className="text-3xl font-bold mt-2">
                      {displayStats.widgetMessages}
                    </CardTitle>
                    <div className="text-sm text-neutral-500 mt-1">
                      {t("admin.widgetInteractions")}
                    </div>
                  </div>
                  <div className="bg-emerald-100 p-3 rounded-full">
                    <MessageCircle className="h-6 w-6 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}