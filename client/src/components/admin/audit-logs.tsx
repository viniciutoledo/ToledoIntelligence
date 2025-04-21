import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/hooks/use-language";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, AlertTriangle, Info, AlertCircle, CheckCircle } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";

interface AuditLog {
  id: number;
  created_at: string;
  user_id: number | null;
  action: string;
  details: any;
  ip_address: string | null;
}

export function AuditLogs() {
  const { t, language } = useLanguage();

  // Consulta os registros de auditoria
  const { data: logs, isLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/admin/logs"],
    staleTime: 30000, // 30 segundos
  });

  // Formata a data com base no idioma
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const locale = language === "pt" ? ptBR : enUS;
    
    return {
      relative: formatDistanceToNow(date, {
        addSuffix: true,
        locale,
      }),
      full: format(date, "Pp", { locale }),
    };
  };

  // Traduz uma ação de log para um texto legível
  const getActionText = (action: string) => {
    const actionMap: Record<string, string> = {
      user_login: t("admin.actionUserLogin"),
      user_logout: t("admin.actionUserLogout"),
      user_registered: t("admin.actionUserRegistered"),
      user_blocked: t("admin.actionUserBlocked"),
      user_unblocked: t("admin.actionUserUnblocked"),
      llm_config_updated: t("admin.actionLlmConfigUpdated"),
      avatar_updated: t("admin.actionAvatarUpdated"),
      chat_session_started: t("admin.actionChatSessionStarted"),
      chat_session_ended: t("admin.actionChatSessionEnded"),
      subscription_checkout_started: t("admin.actionSubscriptionCheckoutStarted"),
      subscription_activated: t("admin.actionSubscriptionActivated"),
      subscription_cancelled: t("admin.actionSubscriptionCancelled"),
    };

    return actionMap[action] || action;
  };

  // Obtém o ícone apropriado para o tipo de ação
  const getActionIcon = (action: string) => {
    if (action.includes("login") || action.includes("registered")) {
      return <Info className="h-4 w-4 text-blue-500" />;
    } else if (action.includes("blocked")) {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    } else if (action.includes("unblocked") || action.includes("activated")) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else {
      return <Info className="h-4 w-4 text-neutral-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="p-8 text-center border rounded-lg bg-neutral-50">
        <AlertTriangle className="h-8 w-8 text-yellow-500 mb-2 mx-auto" />
        <h3 className="text-lg font-medium">{t("admin.noLogsFound")}</h3>
        <p className="text-neutral-500 mt-1">{t("admin.noLogsFoundDesc")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("admin.logTime")}</TableHead>
            <TableHead>{t("admin.logAction")}</TableHead>
            <TableHead>{t("admin.logUser")}</TableHead>
            <TableHead>{t("admin.logDetails")}</TableHead>
            <TableHead>{t("admin.logIp")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => {
            const dates = formatDate(log.created_at);
            return (
              <TableRow key={log.id}>
                <TableCell title={dates.full}>
                  {dates.relative}
                </TableCell>
                <TableCell>
                  <div className="flex items-center">
                    {getActionIcon(log.action)}
                    <span className="ml-2">{getActionText(log.action)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {log.user_id ? `ID: ${log.user_id}` : t("admin.system")}
                </TableCell>
                <TableCell>
                  {log.details ? (
                    <pre className="text-xs bg-neutral-50 p-2 rounded whitespace-pre-wrap max-w-xs overflow-auto">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>{log.ip_address || "-"}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}