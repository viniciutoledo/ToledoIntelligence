import { useState, useEffect } from "react";
import { useLanguage } from "@/hooks/use-language";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  AlertCircle, 
  ShieldAlert, 
  LockKeyhole, 
  Clock, 
  Shield,
  Loader2,
  UserX,
  Calendar,
  Key
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";

type AdvancedSecuritySettingsProps = {
  open: boolean;
  onClose: () => void;
};

export function AdvancedSecuritySettings({ open, onClose }: AdvancedSecuritySettingsProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("general");
  const [isLoading, setIsLoading] = useState(false);
  
  // Estados para configurações de segurança
  const [passwordPolicy, setPasswordPolicy] = useState({
    minLength: 6,
    requireUppercase: false,
    requireSpecialChar: false,
    requireNumber: false,
    passwordExpiration: 0, // 0 = nunca, outros valores em dias
  });
  
  const [sessionPolicy, setSessionPolicy] = useState({
    sessionTimeout: 30, // minutos
    maxConcurrentSessions: 2,
    enforceDeviceVerification: false,
  });
  
  const [securityFeatures, setSecurityFeatures] = useState({
    requireAdminApproval: false,
    twoFactorForAll: false,
    twoFactorForAdmin: false,
    detectSuspiciousLogins: true,
    ipRestrictions: false,
  });
  
  const [blockedUsers, setBlockedUsers] = useState<Array<{
    id: number;
    email: string;
    blockedAt: string;
    reason: string;
  }>>([]);
  
  // Carregar configurações
  useEffect(() => {
    if (open) {
      fetchSecuritySettings();
      fetchBlockedUsers();
    }
  }, [open]);
  
  const fetchSecuritySettings = async () => {
    try {
      setIsLoading(true);
      
      // Em uma implementação real, você buscaria estas configurações da API
      const response = await apiRequest("GET", "/api/admin/security/settings");
      
      if (response.ok) {
        const data = await response.json();
        setPasswordPolicy(data.passwordPolicy || passwordPolicy);
        setSessionPolicy(data.sessionPolicy || sessionPolicy);
        setSecurityFeatures(data.securityFeatures || securityFeatures);
      }
    } catch (error) {
      console.error("Erro ao carregar configurações de segurança:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as configurações de segurança",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const fetchBlockedUsers = async () => {
    try {
      setIsLoading(true);
      
      // Em uma implementação real, você buscaria estes usuários da API
      const response = await apiRequest("GET", "/api/admin/security/blocked-users");
      
      if (response.ok) {
        const data = await response.json();
        setBlockedUsers(data || []);
      }
    } catch (error) {
      console.error("Erro ao carregar usuários bloqueados:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const saveSecuritySettings = async () => {
    try {
      setIsLoading(true);
      
      const settings = {
        passwordPolicy,
        sessionPolicy,
        securityFeatures,
      };
      
      const response = await apiRequest("POST", "/api/admin/security/settings", settings);
      
      if (response.ok) {
        toast({
          title: "Sucesso",
          description: "Configurações de segurança salvas com sucesso",
        });
      } else {
        toast({
          title: "Erro",
          description: "Não foi possível salvar as configurações de segurança",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Erro ao salvar configurações de segurança:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao salvar as configurações",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const unblockUser = async (userId: number) => {
    try {
      setIsLoading(true);
      
      const response = await apiRequest("POST", `/api/admin/security/unblock-user/${userId}`);
      
      if (response.ok) {
        setBlockedUsers(blockedUsers.filter(user => user.id !== userId));
        toast({
          title: "Sucesso",
          description: "Usuário desbloqueado com sucesso",
        });
      } else {
        toast({
          title: "Erro",
          description: "Não foi possível desbloquear o usuário",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Erro ao desbloquear usuário:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao desbloquear o usuário",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handler para fechar o diálogo com uma confirmação se houve alterações
  const handleClose = () => {
    onClose();
  };
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center text-xl">
            <ShieldAlert className="mr-2 h-5 w-5" />
            Configurações Avançadas de Segurança
          </DialogTitle>
          <DialogDescription>
            Configure opções avançadas de segurança para proteger sua aplicação
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid grid-cols-3 mb-4 w-full">
            <TabsTrigger value="general">
              <Shield className="h-4 w-4 mr-2" />
              Geral
            </TabsTrigger>
            <TabsTrigger value="password">
              <Key className="h-4 w-4 mr-2" />
              Política de Senhas
            </TabsTrigger>
            <TabsTrigger value="blocked">
              <UserX className="h-4 w-4 mr-2" />
              Usuários Bloqueados
            </TabsTrigger>
          </TabsList>
          
          {/* Aba Geral */}
          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Autenticação</CardTitle>
                <CardDescription>
                  Configure políticas gerais de segurança para autenticação
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <Label>2FA para Administradores</Label>
                    <p className="text-sm text-muted-foreground">
                      Exigir autenticação de dois fatores para todos os administradores
                    </p>
                  </div>
                  <Switch 
                    checked={securityFeatures.twoFactorForAdmin}
                    onCheckedChange={(checked) => 
                      setSecurityFeatures({...securityFeatures, twoFactorForAdmin: checked})
                    }
                  />
                </div>
                
                <div className="flex justify-between items-center">
                  <div>
                    <Label>2FA para Todos</Label>
                    <p className="text-sm text-muted-foreground">
                      Exigir autenticação de dois fatores para todos os usuários
                    </p>
                  </div>
                  <Switch 
                    checked={securityFeatures.twoFactorForAll}
                    onCheckedChange={(checked) => 
                      setSecurityFeatures({...securityFeatures, twoFactorForAll: checked})
                    }
                  />
                </div>
                
                <div className="flex justify-between items-center">
                  <div>
                    <Label>Aprovação de Administrador</Label>
                    <p className="text-sm text-muted-foreground">
                      Exigir aprovação de administrador para novos registros
                    </p>
                  </div>
                  <Switch 
                    checked={securityFeatures.requireAdminApproval}
                    onCheckedChange={(checked) => 
                      setSecurityFeatures({...securityFeatures, requireAdminApproval: checked})
                    }
                  />
                </div>
                
                <Separator />
                
                <div className="flex justify-between items-center">
                  <div>
                    <Label>Detecção de Logins Suspeitos</Label>
                    <p className="text-sm text-muted-foreground">
                      Detectar e bloquear tentativas de login suspeitas
                    </p>
                  </div>
                  <Switch 
                    checked={securityFeatures.detectSuspiciousLogins}
                    onCheckedChange={(checked) => 
                      setSecurityFeatures({...securityFeatures, detectSuspiciousLogins: checked})
                    }
                  />
                </div>
                
                <div className="flex justify-between items-center">
                  <div>
                    <Label>Restrições de IP</Label>
                    <p className="text-sm text-muted-foreground">
                      Habilitar restrições de acesso baseadas em IP
                    </p>
                  </div>
                  <Switch 
                    checked={securityFeatures.ipRestrictions}
                    onCheckedChange={(checked) => 
                      setSecurityFeatures({...securityFeatures, ipRestrictions: checked})
                    }
                  />
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Sessões</CardTitle>
                <CardDescription>
                  Configure políticas de sessão e expiração
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tempo limite de sessão (minutos)</Label>
                    <Input 
                      type="number" 
                      value={sessionPolicy.sessionTimeout} 
                      onChange={(e) => 
                        setSessionPolicy({
                          ...sessionPolicy, 
                          sessionTimeout: parseInt(e.target.value) || 30
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      0 = sem limite de tempo
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Sessões simultâneas máximas</Label>
                    <Input 
                      type="number" 
                      value={sessionPolicy.maxConcurrentSessions} 
                      onChange={(e) => 
                        setSessionPolicy({
                          ...sessionPolicy, 
                          maxConcurrentSessions: parseInt(e.target.value) || 2
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      0 = sem limite
                    </p>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <div>
                    <Label>Verificação de Dispositivo</Label>
                    <p className="text-sm text-muted-foreground">
                      Exigir verificação para novos dispositivos ou navegadores
                    </p>
                  </div>
                  <Switch 
                    checked={sessionPolicy.enforceDeviceVerification}
                    onCheckedChange={(checked) => 
                      setSessionPolicy({...sessionPolicy, enforceDeviceVerification: checked})
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Aba Política de Senhas */}
          <TabsContent value="password" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Requisitos de Senha</CardTitle>
                <CardDescription>
                  Configure requisitos de complexidade para senhas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Comprimento mínimo de senha</Label>
                  <Input 
                    type="number" 
                    value={passwordPolicy.minLength} 
                    onChange={(e) => 
                      setPasswordPolicy({
                        ...passwordPolicy, 
                        minLength: parseInt(e.target.value) || 6
                      })
                    }
                  />
                </div>
                
                <div className="flex justify-between items-center">
                  <div>
                    <Label>Exigir letra maiúscula</Label>
                    <p className="text-sm text-muted-foreground">
                      Senhas devem conter pelo menos uma letra maiúscula
                    </p>
                  </div>
                  <Switch 
                    checked={passwordPolicy.requireUppercase}
                    onCheckedChange={(checked) => 
                      setPasswordPolicy({...passwordPolicy, requireUppercase: checked})
                    }
                  />
                </div>
                
                <div className="flex justify-between items-center">
                  <div>
                    <Label>Exigir caractere especial</Label>
                    <p className="text-sm text-muted-foreground">
                      Senhas devem conter pelo menos um caractere especial
                    </p>
                  </div>
                  <Switch 
                    checked={passwordPolicy.requireSpecialChar}
                    onCheckedChange={(checked) => 
                      setPasswordPolicy({...passwordPolicy, requireSpecialChar: checked})
                    }
                  />
                </div>
                
                <div className="flex justify-between items-center">
                  <div>
                    <Label>Exigir número</Label>
                    <p className="text-sm text-muted-foreground">
                      Senhas devem conter pelo menos um número
                    </p>
                  </div>
                  <Switch 
                    checked={passwordPolicy.requireNumber}
                    onCheckedChange={(checked) => 
                      setPasswordPolicy({...passwordPolicy, requireNumber: checked})
                    }
                  />
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <Label>Expiração de senha (dias)</Label>
                  <Input 
                    type="number" 
                    value={passwordPolicy.passwordExpiration} 
                    onChange={(e) => 
                      setPasswordPolicy({
                        ...passwordPolicy, 
                        passwordExpiration: parseInt(e.target.value) || 0
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    0 = senhas nunca expiram
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Alert variant="default" className="bg-blue-50 border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800">Importante</AlertTitle>
              <AlertDescription className="text-blue-700">
                Alterações na política de senha só se aplicarão a novas senhas criadas após a alteração
                ou quando os usuários atualizarem suas senhas existentes.
              </AlertDescription>
            </Alert>
          </TabsContent>
          
          {/* Aba Usuários Bloqueados */}
          <TabsContent value="blocked" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Usuários Bloqueados</CardTitle>
                <CardDescription>
                  Gerencie usuários que foram bloqueados no sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : blockedUsers.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Data do Bloqueio</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {blockedUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{new Date(user.blockedAt).toLocaleString()}</TableCell>
                          <TableCell>{user.reason}</TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => unblockUser(user.id)}
                            >
                              Desbloquear
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Não há usuários bloqueados no momento
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={saveSecuritySettings}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Configurações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}