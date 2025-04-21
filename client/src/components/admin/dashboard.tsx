import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/hooks/use-language";
import { Loader2, Users, MessageCircle, Clock, BarChart2 } from "lucide-react";
import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/card";

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
}

export function AdminDashboard() {
  const { t } = useLanguage();

  // Consulta as estatísticas do dashboard
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/stats"],
    // Fallback para valores iniciais enquanto a API de estatísticas estiver em desenvolvimento
    initialData: {
      userCount: 0,
      technicianCount: 0,
      adminCount: 0,
      activeUsers: 0,
      blockedUsers: 0,
      totalChatSessions: 0,
      activeChatSessions: 0,
      messageCount: 0,
      averageResponseTime: 0,
    }
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Cartão de Usuários */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-start">
            <div>
              <CardDescription>{t("admin.users")}</CardDescription>
              <CardTitle className="text-3xl font-bold mt-2">
                {stats.userCount}
              </CardTitle>
              <div className="text-sm text-neutral-500 mt-1">
                {stats.technicianCount} {t("auth.technician")} / {stats.adminCount} {t("auth.admin")}
              </div>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 text-sm">
            <div className="flex justify-between">
              <span>{t("admin.active")}</span>
              <span className="font-medium">{stats.activeUsers}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("admin.blocked")}</span>
              <span className="font-medium">{stats.blockedUsers}</span>
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
                {stats.totalChatSessions}
              </CardTitle>
              <div className="text-sm text-neutral-500 mt-1">
                {stats.activeChatSessions} {t("admin.activeSessions")}
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
                {stats.messageCount}
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
                {stats.averageResponseTime > 0 
                  ? `${stats.averageResponseTime.toFixed(1)}s` 
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
  );
}