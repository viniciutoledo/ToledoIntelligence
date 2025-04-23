import { useQuery, useMutation } from "@tanstack/react-query";
import { useLanguage } from "@/hooks/use-language";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, Info, AlertCircle, CheckCircle, Plus } from "lucide-react";
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
  const { toast } = useToast();

  // Consulta os registros de auditoria
  const { data: logs, isLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/admin/logs"],
    staleTime: 30000, // 30 segundos
  });
  
  // Mutação para criar logs de exemplo
  const createExampleLogsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/create-example-logs");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/logs"] });
      toast({
        title: t("common.success"),
        description: "Logs de exemplo criados com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
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
      user_login: "Login de usuário",
      user_logout: "Logout de usuário",
      user_registered: "Usuário registrado",
      user_blocked: "Usuário bloqueado",
      user_unblocked: "Usuário desbloqueado",
      llm_config_updated: "Configuração LLM atualizada",
      avatar_updated: "Avatar atualizado",
      chat_session_started: "Sessão de chat iniciada",
      chat_session_ended: "Sessão de chat finalizada",
      subscription_checkout_started: "Checkout de assinatura iniciado",
      subscription_activated: "Assinatura ativada",
      subscription_cancelled: "Assinatura cancelada",
      account_blocked: "Conta bloqueada",
      "2fa_enabled": "Autenticação de dois fatores ativada",
      "2fa_disabled": "Autenticação de dois fatores desativada",
      language_changed: "Idioma alterado",
      llm_config_created: "Configuração LLM criada",
      llm_config_activated: "Configuração LLM ativada",
      avatar_created: "Avatar criado",
      avatar_activated: "Avatar ativado",
      avatar_reset: "Avatar redefinido para o padrão",
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
  
  // Formata os detalhes do log de uma forma mais amigável
  const formatLogDetails = (action: string, details: any) => {
    try {
      // Converte detalhes do formato JSON para um objeto se for uma string
      const detailsObj = typeof details === 'string' ? JSON.parse(details) : details;
      
      // Formação amigável para diferentes tipos de ações
      if (action === 'user_login') {
        return `Usuário fez login ${detailsObj.ip ? `do IP ${detailsObj.ip}` : ''}`;
      } 
      else if (action === 'user_logout') {
        return 'Usuário saiu do sistema';
      } 
      else if (action === 'user_registered') {
        return `Nova conta criada com email: ${detailsObj.email || 'não informado'}`;
      } 
      else if (action === 'user_blocked') {
        return `Usuário bloqueado por ${detailsObj.reason || 'razões de segurança'}`;
      } 
      else if (action === 'user_unblocked') {
        return 'Acesso do usuário restaurado';
      } 
      else if (action === 'llm_config_updated') {
        return `Configuração do modelo IA atualizada para ${detailsObj.model || 'novo modelo'}`;
      } 
      else if (action === 'avatar_updated') {
        return 'Imagem ou configuração do avatar foi alterada';
      } 
      else if (action === 'chat_session_started') {
        return 'Nova conversa de chat iniciada';
      } 
      else if (action === 'chat_session_ended') {
        return `Conversa de chat finalizada após ${detailsObj.duration || 'algum tempo'}`;
      } 
      else if (action === 'subscription_checkout_started') {
        return `Iniciou assinatura do plano ${detailsObj.plan || ''}`;
      } 
      else if (action === 'subscription_activated') {
        return `Assinatura do plano ${detailsObj.plan || ''} foi ativada`;
      } 
      else if (action === 'subscription_cancelled') {
        return 'Assinatura foi cancelada';
      } 
      else {
        // Para ações não mapeadas, retorna uma versão simplificada do JSON
        const keysToShow = Object.keys(detailsObj).slice(0, 3);
        return keysToShow.map(key => `${key}: ${detailsObj[key]}`).join(', ');
      }
    } catch (error) {
      // Em caso de erro ao processar, retorna os detalhes originais
      return typeof details === 'string' ? details : JSON.stringify(details, null, 2);
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
        <h3 className="text-lg font-medium">Nenhum registro encontrado</h3>
        <p className="text-neutral-500 mt-1">Não há registros de auditoria no sistema ainda.</p>
        <Button 
          className="mt-4"
          variant="outline"
          onClick={() => createExampleLogsMutation.mutate()}
          disabled={createExampleLogsMutation.isPending}
        >
          {createExampleLogsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <Plus className="h-4 w-4 mr-2" />
          Criar Logs de Exemplo
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Hora</TableHead>
            <TableHead>Ação</TableHead>
            <TableHead>Usuário</TableHead>
            <TableHead>Detalhes</TableHead>
            <TableHead>Endereço IP</TableHead>
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
                  {log.user_id ? `ID: ${log.user_id}` : "Sistema"}
                </TableCell>
                <TableCell>
                  {log.details ? (
                    <div className="text-sm p-2 rounded max-w-xs">
                      {formatLogDetails(log.action, log.details)}
                    </div>
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