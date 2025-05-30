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
import { 
  Loader2, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Edit, 
  Trash2, 
  MoreHorizontal,
  User,
  Crown,
  BadgeHelp
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
  const { language } = useLanguage();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Consulta a lista de usuários
  const { data: users, isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    staleTime: 30000, // 30 segundos
  });

  // Estado para o modal de edição
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  
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
        title: "Sucesso",
        description: "Usuário desbloqueado com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Mutação para bloquear usuários
  const blockUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      setIsLoading(true);
      const res = await apiRequest("PUT", `/api/admin/users/${userId}/block`);
      setIsLoading(false);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Sucesso",
        description: "Usuário bloqueado com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Mutação para atualizar usuários
  const updateUserMutation = useMutation({
    mutationFn: async (data: { id: number, userData: Partial<User> }) => {
      setIsLoading(true);
      const res = await apiRequest("PUT", `/api/admin/users/${data.id}`, data.userData);
      setIsLoading(false);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setIsEditOpen(false);
      toast({
        title: "Sucesso",
        description: "Usuário atualizado com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Mutação para deletar usuários
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      setIsLoading(true);
      const res = await apiRequest("DELETE", `/api/admin/users/${userId}`);
      setIsLoading(false);
      return res.ok;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setIsDeleteOpen(false);
      toast({
        title: "Sucesso",
        description: "Usuário excluído com sucesso",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Formata a data com base no idioma
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Nunca";
    
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
            Básico
          </span>
        );
      case "intermediate":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
            Intermediário
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Sem Assinatura
          </span>
        );
    }
  };

  // Renderiza o status do usuário
  const renderStatus = (isBlocked: boolean) => {
    return isBlocked ? (
      <span className="inline-flex items-center text-red-500">
        <XCircle className="w-4 h-4 mr-1" />
        Bloqueado
      </span>
    ) : (
      <span className="inline-flex items-center text-green-500">
        <CheckCircle className="w-4 h-4 mr-1" />
        Ativo
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
        <h3 className="text-lg font-medium">Nenhum usuário encontrado</h3>
        <p className="text-neutral-500 mt-1">Não há usuários registrados no sistema ainda.</p>
      </div>
    );
  }

  // Formulário de edição de usuário
  const handleEditUser = () => {
    if (!editingUser) return;
    
    // Atualiza o usuário
    updateUserMutation.mutate({
      id: editingUser.id,
      userData: {
        role: editingUser.role,
        language: editingUser.language,
        subscription_tier: editingUser.subscription_tier,
        message_count: editingUser.message_count,
        max_messages: editingUser.max_messages
      }
    });
  };
  
  // Renderização do modal de edição
  const renderEditUserDialog = () => {
    if (!editingUser) return null;
    
    return (
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Edite as informações do usuário abaixo.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label className="text-right text-sm font-medium">
                Email:
              </label>
              <div className="col-span-3">
                <p className="text-sm text-neutral-700">{editingUser.email}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="role" className="text-right text-sm font-medium">
                Função:
              </label>
              <div className="col-span-3">
                <select
                  id="role"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={editingUser.role}
                  onChange={(e) => 
                    setEditingUser({ 
                      ...editingUser, 
                      role: e.target.value as "admin" | "technician" 
                    })
                  }
                >
                  <option value="technician">Técnico</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="language" className="text-right text-sm font-medium">
                Idioma:
              </label>
              <div className="col-span-3">
                <select
                  id="language"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={editingUser.language}
                  onChange={(e) => 
                    setEditingUser({ 
                      ...editingUser, 
                      language: e.target.value as "pt" | "en" 
                    })
                  }
                >
                  <option value="pt">Português</option>
                  <option value="en">Inglês</option>
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="subscription" className="text-right text-sm font-medium">
                Assinatura:
              </label>
              <div className="col-span-3">
                <select
                  id="subscription"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={editingUser.subscription_tier}
                  onChange={(e) => {
                    const value = e.target.value as "none" | "basic" | "intermediate";
                    let maxMessages = 0;
                    
                    // Atualiza o número máximo de mensagens conforme o plano
                    if (value === "basic") {
                      maxMessages = 2500;
                    } else if (value === "intermediate") {
                      maxMessages = 5000;
                    }
                    
                    setEditingUser({ 
                      ...editingUser, 
                      subscription_tier: value,
                      max_messages: maxMessages
                    });
                  }}
                >
                  <option value="none">Sem Assinatura</option>
                  <option value="basic">Básico</option>
                  <option value="intermediate">Intermediário</option>
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="message_count" className="text-right text-sm font-medium">
                Contagem de Mensagens:
              </label>
              <div className="col-span-3">
                <input
                  id="message_count"
                  type="number"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={editingUser.message_count}
                  onChange={(e) => 
                    setEditingUser({ 
                      ...editingUser, 
                      message_count: parseInt(e.target.value) || 0
                    })
                  }
                  min="0"
                  max={editingUser.max_messages || 9999}
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleEditUser} 
              disabled={updateUserMutation.isPending}
            >
              {updateUserMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };
  
  // Renderização do diálogo de confirmação de exclusão
  const renderDeleteUserDialog = () => {
    if (!userToDelete) return null;
    
    return (
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir permanentemente o usuário {userToDelete.email}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={() => deleteUserMutation.mutate(userToDelete.id)}
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Excluir Usuário
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  };

  return (
    <div className="space-y-6">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Último Login</TableHead>
              <TableHead>Idioma</TableHead>
              <TableHead>Assinatura</TableHead>
              <TableHead>Uso de Mensagens</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.email}</TableCell>
                <TableCell>
                  {user.role === "admin" ? "Administrador" : "Técnico"}
                </TableCell>
                <TableCell>{renderStatus(user.is_blocked)}</TableCell>
                <TableCell>{formatDate(user.last_login)}</TableCell>
                <TableCell>
                  {user.language === "pt" ? "Português" : "Inglês"}
                </TableCell>
                <TableCell>{renderSubscriptionStatus(user.subscription_tier)}</TableCell>
                <TableCell className="min-w-32">
                  {renderMessageUsage(user.message_count, user.max_messages)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                    {user.is_blocked ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isLoading}
                        onClick={() => unblockUserMutation.mutate(user.id)}
                        className="bg-green-50 hover:bg-green-100 text-green-600 border-green-200"
                      >
                        {unblockUserMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : null}
                        Desbloquear
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isLoading}
                        onClick={() => blockUserMutation.mutate(user.id)}
                        className="bg-red-50 hover:bg-red-100 text-red-600 border-red-200"
                      >
                        {blockUserMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : null}
                        Bloquear
                      </Button>
                    )}
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => {
                            setEditingUser(user);
                            setIsEditOpen(true);
                          }}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Editar Usuário
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => {
                            setUserToDelete(user);
                            setIsDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir Usuário
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      {/* Dialogs */}
      {renderEditUserDialog()}
      {renderDeleteUserDialog()}
    </div>
  );
}