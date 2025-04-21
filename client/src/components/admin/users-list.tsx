import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLanguage } from "@/hooks/use-language";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";

interface User {
  id: number;
  email: string;
  role: "technician" | "admin";
  is_blocked: boolean;
  language: "pt" | "en";
  created_at: string;
  updated_at: string;
  last_login: string | null;
  subscription_tier: "none" | "basic" | "intermediate";
  message_count: number;
  max_messages: number;
}

export function UsersList() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Consulta a lista de usuários
  const { data: users, isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    staleTime: 30000, // 30 segundos
  });

  // Mutação para desbloquear usuários
  const unblockUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      setIsLoading(true);
      const res = await apiRequest("PUT", `/api/admin/users/${userId}/unblock`);
      setIsLoading(false);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: t("common.success"),
        description: t("admin.userUnblocked"),
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
  const formatDate = (dateString: string | null) => {
    if (!dateString) return t("admin.never");
    
    const date = new Date(dateString);
    const locale = language === "pt" ? ptBR : enUS;
    
    return formatDistanceToNow(date, {
      addSuffix: true,
      locale,
    });
  };

  // Renderiza o status da assinatura
  const renderSubscriptionStatus = (tier: string) => {
    switch (tier) {
      case "basic":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Basic
          </span>
        );
      case "intermediate":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            Intermediate
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {t("admin.noSubscription")}
          </span>
        );
    }
  };

  // Renderiza o status do usuário
  const renderStatus = (isBlocked: boolean) => {
    return isBlocked ? (
      <span className="inline-flex items-center text-red-500">
        <XCircle className="w-4 h-4 mr-1" />
        {t("admin.blocked")}
      </span>
    ) : (
      <span className="inline-flex items-center text-green-500">
        <CheckCircle className="w-4 h-4 mr-1" />
        {t("admin.active")}
      </span>
    );
  };

  // Renderiza o uso de mensagens
  const renderMessageUsage = (count: number, max: number) => {
    if (max === 0) return "-";
    
    const percentage = (count / max) * 100;
    let color = "bg-green-500";
    
    if (percentage > 90) {
      color = "bg-red-500";
    } else if (percentage > 70) {
      color = "bg-yellow-500";
    }
    
    return (
      <div className="w-full">
        <div className="flex justify-between text-xs mb-1">
          <span>{count} / {max}</span>
          <span>{Math.floor(percentage)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full ${color}`}
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
      </div>
    );
  };

  if (isLoadingUsers) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!users || users.length === 0) {
    return (
      <div className="p-8 text-center border rounded-lg bg-neutral-50">
        <AlertTriangle className="h-8 w-8 text-yellow-500 mb-2 mx-auto" />
        <h3 className="text-lg font-medium">{t("admin.noUsersFound")}</h3>
        <p className="text-neutral-500 mt-1">{t("admin.noUsersFoundDesc")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("admin.userEmail")}</TableHead>
            <TableHead>{t("admin.userRole")}</TableHead>
            <TableHead>{t("admin.userStatus")}</TableHead>
            <TableHead>{t("admin.userLastLogin")}</TableHead>
            <TableHead>{t("admin.userLanguage")}</TableHead>
            <TableHead>{t("admin.subscription")}</TableHead>
            <TableHead>{t("admin.messageUsage")}</TableHead>
            <TableHead>{t("admin.userActions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.email}</TableCell>
              <TableCell>
                {user.role === "admin" ? t("auth.admin") : t("auth.technician")}
              </TableCell>
              <TableCell>{renderStatus(user.is_blocked)}</TableCell>
              <TableCell>{formatDate(user.last_login)}</TableCell>
              <TableCell>
                {user.language === "pt" ? t("common.portuguese") : t("common.english")}
              </TableCell>
              <TableCell>{renderSubscriptionStatus(user.subscription_tier)}</TableCell>
              <TableCell className="min-w-32">
                {renderMessageUsage(user.message_count, user.max_messages)}
              </TableCell>
              <TableCell>
                {user.is_blocked && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isLoading}
                    onClick={() => unblockUserMutation.mutate(user.id)}
                  >
                    {unblockUserMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : null}
                    {t("admin.unblock")}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}