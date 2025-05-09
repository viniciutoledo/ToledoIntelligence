import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, Settings, Database, RefreshCw, CheckCircle2, XCircle,
  ArrowUpDown, AlertTriangle, Save, Link2, FileSpreadsheet, Info
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";

interface ERPSystem {
  id: string;
  name: string;
  type: string;
  status: "connected" | "disconnected" | "error";
  lastSync: string | null;
  apiUrl: string;
  apiKey: string;
  syncEnabled: boolean;
  syncInterval: number;
}

interface SyncRecord {
  id: string;
  systemId: string;
  systemName: string;
  timestamp: string;
  status: "success" | "error";
  itemsProcessed: number;
  description: string;
}

interface MappingField {
  id: string;
  sourceField: string;
  targetField: string;
  description: string;
  required: boolean;
  active: boolean;
}

// Schema para validação do formulário de integração
const integrationSchema = z.object({
  name: z.string().min(3, {
    message: "O nome deve ter pelo menos 3 caracteres.",
  }),
  type: z.string().min(1, {
    message: "O tipo de sistema é obrigatório.",
  }),
  apiUrl: z.string().url({
    message: "URL da API inválida."
  }),
  apiKey: z.string().min(10, {
    message: "Chave de API inválida ou muito curta."
  }),
  syncInterval: z.coerce.number().min(5, {
    message: "O intervalo de sincronização deve ser no mínimo 5 minutos."
  }),
  syncEnabled: z.boolean().default(false),
});

type IntegrationFormValues = z.infer<typeof integrationSchema>;

export function ERPIntegration() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [systems, setSystems] = useState<ERPSystem[]>([]);
  const [syncRecords, setSyncRecords] = useState<SyncRecord[]>([]);
  const [selectedSystem, setSelectedSystem] = useState<ERPSystem | null>(null);
  const [activeTab, setActiveTab] = useState("systems");
  const [fieldMappings, setFieldMappings] = useState<MappingField[]>([]);
  const [isAddingSystem, setIsAddingSystem] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Dados simulados para demonstração
  const dummySystems: ERPSystem[] = [
    {
      id: "erp-001",
      name: "SAP PM - Produção",
      type: "sap",
      status: "connected",
      lastSync: "2025-04-22T14:30:22Z",
      apiUrl: "https://api.example.com/sap/pm",
      apiKey: "sap_api_key_123",
      syncEnabled: true,
      syncInterval: 60
    },
    {
      id: "erp-002",
      name: "Oracle EAM - Homologação",
      type: "oracle",
      status: "disconnected",
      lastSync: "2025-04-15T09:12:45Z",
      apiUrl: "https://api.example.com/oracle/eam",
      apiKey: "oracle_api_key_456",
      syncEnabled: false,
      syncInterval: 120
    },
    {
      id: "erp-003",
      name: "Maximo Asset Management",
      type: "maximo",
      status: "error",
      lastSync: "2025-04-10T16:47:33Z",
      apiUrl: "https://api.example.com/maximo",
      apiKey: "maximo_api_key_789",
      syncEnabled: true,
      syncInterval: 30
    }
  ];

  const dummySyncRecords: SyncRecord[] = [
    {
      id: "sync-001",
      systemId: "erp-001",
      systemName: "SAP PM - Produção",
      timestamp: "2025-04-22T14:30:22Z",
      status: "success",
      itemsProcessed: 148,
      description: "Sincronização completa de ordens de serviço e análises técnicas"
    },
    {
      id: "sync-002",
      systemId: "erp-001",
      systemName: "SAP PM - Produção",
      timestamp: "2025-04-22T13:30:22Z",
      status: "success",
      itemsProcessed: 56,
      description: "Sincronização incremental"
    },
    {
      id: "sync-003",
      systemId: "erp-002",
      systemName: "Oracle EAM - Homologação",
      timestamp: "2025-04-15T09:12:45Z",
      status: "success",
      itemsProcessed: 89,
      description: "Sincronização completa"
    },
    {
      id: "sync-004",
      systemId: "erp-003",
      systemName: "Maximo Asset Management",
      timestamp: "2025-04-10T16:47:33Z",
      status: "error",
      itemsProcessed: 23,
      description: "Erro durante sincronização: timeout na API externa"
    }
  ];

  const dummyFieldMappings: MappingField[] = [
    {
      id: "field-001",
      sourceField: "circuitName",
      targetField: "EQUIPMENT_NAME",
      description: "Nome do circuito/equipamento",
      required: true,
      active: true
    },
    {
      id: "field-002",
      sourceField: "description",
      targetField: "DEFECT_TEXT",
      description: "Descrição do problema/defeito",
      required: true,
      active: true
    },
    {
      id: "field-003",
      sourceField: "analysis",
      targetField: "ANALYSIS_LONG_TEXT",
      description: "Análise técnica detalhada",
      required: true,
      active: true
    },
    {
      id: "field-004",
      sourceField: "modelUsed",
      targetField: "AI_MODEL_USED",
      description: "Modelo de IA utilizado",
      required: false,
      active: true
    },
    {
      id: "field-005",
      sourceField: "tags",
      targetField: "CATEGORY_TAGS",
      description: "Tags de categorização",
      required: false,
      active: true
    },
    {
      id: "field-006",
      sourceField: "createdAt",
      targetField: "CREATED_TIMESTAMP",
      description: "Data e hora da criação",
      required: true,
      active: true
    },
    {
      id: "field-007",
      sourceField: "userId",
      targetField: "TECHNICIAN_ID",
      description: "ID do técnico",
      required: true,
      active: true
    },
    {
      id: "field-008",
      sourceField: "userName",
      targetField: "TECHNICIAN_NAME",
      description: "Nome do técnico",
      required: false,
      active: true
    },
    {
      id: "field-009",
      sourceField: "accuracy",
      targetField: "AI_CONFIDENCE",
      description: "Precisão/confiança da análise",
      required: false,
      active: false
    }
  ];

  // Form para adicionar/editar sistema
  const form = useForm<IntegrationFormValues>({
    resolver: zodResolver(integrationSchema),
    defaultValues: {
      name: "",
      type: "",
      apiUrl: "",
      apiKey: "",
      syncInterval: 60,
      syncEnabled: false,
    },
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Em produção, buscar dados reais da API
      // const systemsResponse = await apiRequest("GET", "/api/integrations/systems");
      // const systemsData = await systemsResponse.json();
      // setSystems(systemsData);
      
      // const syncResponse = await apiRequest("GET", "/api/integrations/sync-records");
      // const syncData = await syncResponse.json();
      // setSyncRecords(syncData);
      
      // Usando dados simulados para demonstração
      setSystems(dummySystems);
      setSyncRecords(dummySyncRecords);
      setFieldMappings(dummyFieldMappings);
      
    } catch (error) {
      console.error("Erro ao buscar dados de integração:", error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível obter as informações de integração.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStartSync = async (systemId: string) => {
    try {
      setIsLoading(true);
      // Em produção, chamar API real
      // await apiRequest("POST", `/api/integrations/sync/${systemId}`);
      
      // Simulação para demo
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast({
        title: "Sincronização iniciada",
        description: "A sincronização com o sistema ERP foi iniciada e está em andamento.",
      });
      
      // Atualizar registros
      const newRecord: SyncRecord = {
        id: `sync-${Date.now()}`,
        systemId,
        systemName: systems.find(s => s.id === systemId)?.name || "",
        timestamp: new Date().toISOString(),
        status: "success",
        itemsProcessed: Math.floor(Math.random() * 100) + 1,
        description: "Sincronização manual iniciada pelo usuário"
      };
      
      setSyncRecords([newRecord, ...syncRecords]);
      
      // Atualizar status do sistema
      setSystems(systems.map(system => 
        system.id === systemId 
          ? { ...system, status: "connected", lastSync: new Date().toISOString() } 
          : system
      ));
      
    } catch (error) {
      console.error("Erro ao iniciar sincronização:", error);
      toast({
        title: "Erro de sincronização",
        description: "Não foi possível iniciar a sincronização com o sistema.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSync = async (systemId: string, enabled: boolean) => {
    try {
      // Em produção, chamar API real
      // await apiRequest("PATCH", `/api/integrations/systems/${systemId}`, { syncEnabled: enabled });
      
      // Simulação para demo
      setSystems(systems.map(system => 
        system.id === systemId 
          ? { ...system, syncEnabled: enabled } 
          : system
      ));
      
      toast({
        title: enabled ? "Sincronização ativada" : "Sincronização desativada",
        description: `A sincronização automática foi ${enabled ? "ativada" : "desativada"} para este sistema.`,
      });
    } catch (error) {
      console.error("Erro ao alterar configuração de sincronização:", error);
      toast({
        title: "Erro de configuração",
        description: "Não foi possível alterar a configuração de sincronização.",
        variant: "destructive",
      });
    }
  };

  const handleToggleMapping = async (fieldId: string, active: boolean) => {
    try {
      // Em produção, chamar API real
      // await apiRequest("PATCH", `/api/integrations/mappings/${fieldId}`, { active });
      
      // Simulação para demo
      setFieldMappings(fieldMappings.map(field => 
        field.id === fieldId 
          ? { ...field, active } 
          : field
      ));
      
      toast({
        title: active ? "Campo ativado" : "Campo desativado",
        description: `O mapeamento de campo foi ${active ? "ativado" : "desativado"}.`,
      });
    } catch (error) {
      console.error("Erro ao alterar mapeamento:", error);
      toast({
        title: "Erro de configuração",
        description: "Não foi possível alterar o mapeamento de campo.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Nunca";
    return format(new Date(dateString), "dd/MM/yyyy HH:mm", {
      locale: ptBR,
    });
  };

  const onSubmit = async (values: IntegrationFormValues) => {
    try {
      if (isEditing && selectedSystem) {
        // Em produção, chamar API real para editar
        // await apiRequest("PATCH", `/api/integrations/systems/${selectedSystem.id}`, values);
        
        // Simulação para demo
        setSystems(systems.map(system => 
          system.id === selectedSystem.id 
            ? { 
                ...system, 
                name: values.name,
                type: values.type,
                apiUrl: values.apiUrl,
                apiKey: values.apiKey,
                syncInterval: values.syncInterval,
                syncEnabled: values.syncEnabled
              } 
            : system
        ));
        
        toast({
          title: "Sistema atualizado",
          description: "As configurações do sistema ERP foram atualizadas com sucesso.",
        });
      } else {
        // Em produção, chamar API real para criar
        // const response = await apiRequest("POST", "/api/integrations/systems", values);
        // const newSystem = await response.json();
        
        // Simulação para demo
        const newSystem: ERPSystem = {
          id: `erp-${Date.now()}`,
          name: values.name,
          type: values.type,
          status: "disconnected",
          lastSync: null,
          apiUrl: values.apiUrl,
          apiKey: values.apiKey,
          syncInterval: values.syncInterval,
          syncEnabled: values.syncEnabled
        };
        
        setSystems([...systems, newSystem]);
        
        toast({
          title: "Sistema adicionado",
          description: "O novo sistema ERP foi adicionado com sucesso.",
        });
      }
      
      setIsAddingSystem(false);
      setIsEditing(false);
      form.reset();
      
    } catch (error) {
      console.error("Erro ao salvar sistema:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações do sistema.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (system: ERPSystem) => {
    setSelectedSystem(system);
    setIsEditing(true);
    form.reset({
      name: system.name,
      type: system.type,
      apiUrl: system.apiUrl,
      apiKey: system.apiKey,
      syncInterval: system.syncInterval,
      syncEnabled: system.syncEnabled
    });
    setIsAddingSystem(true);
  };

  const handleDelete = async (systemId: string) => {
    try {
      // Em produção, chamar API real
      // await apiRequest("DELETE", `/api/integrations/systems/${systemId}`);
      
      // Simulação para demo
      setSystems(systems.filter(system => system.id !== systemId));
      
      toast({
        title: "Sistema removido",
        description: "O sistema ERP foi removido com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao remover sistema:", error);
      toast({
        title: "Erro ao remover",
        description: "Não foi possível remover o sistema ERP.",
        variant: "destructive",
      });
    }
  };

  const handleAddNew = () => {
    setSelectedSystem(null);
    setIsEditing(false);
    form.reset({
      name: "",
      type: "",
      apiUrl: "",
      apiKey: "",
      syncInterval: 60,
      syncEnabled: false
    });
    setIsAddingSystem(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" /> Conectado</Badge>;
      case "disconnected":
        return <Badge className="bg-neutral-100 text-neutral-800 border-neutral-200"><XCircle className="h-3 w-3 mr-1" /> Desconectado</Badge>;
      case "error":
        return <Badge className="bg-red-100 text-red-800 border-red-200"><AlertTriangle className="h-3 w-3 mr-1" /> Erro</Badge>;
      default:
        return <Badge className="bg-neutral-100 text-neutral-800">Desconhecido</Badge>;
    }
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Database className="h-6 w-6 text-primary" />
                Integração com Sistemas ERP
              </CardTitle>
              <CardDescription className="mt-2">
                Configure e gerencie a integração com sistemas de gerenciamento de manutenção
              </CardDescription>
            </div>
            
            <Button onClick={handleAddNew}>
              Adicionar Sistema
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="mb-6">
                <TabsTrigger value="systems">Sistemas</TabsTrigger>
                <TabsTrigger value="mappings">Mapeamentos</TabsTrigger>
                <TabsTrigger value="sync">Histórico de Sincronização</TabsTrigger>
              </TabsList>
              
              <TabsContent value="systems" className="mt-4">
                {systems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Database className="h-12 w-12 text-neutral-300 mb-4" />
                    <h3 className="text-lg font-medium text-neutral-700">
                      Nenhum sistema integrado
                    </h3>
                    <p className="text-neutral-500 mt-2 max-w-md">
                      Adicione sistemas ERP para começar a sincronizar análises e ordens de serviço.
                    </p>
                    <Button onClick={handleAddNew} className="mt-4">
                      Adicionar Sistema
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {systems.map((system) => (
                      <Card key={system.id} className="overflow-hidden">
                        <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-lg font-semibold text-neutral-800">
                                {system.name}
                              </h3>
                              {getStatusBadge(system.status)}
                            </div>
                            <p className="text-sm text-neutral-500 mt-1">
                              Tipo: {system.type.toUpperCase()} • 
                              Última sincronização: {formatDate(system.lastSync)}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <div className="flex items-center space-x-2">
                              <Switch
                                id={`sync-${system.id}`}
                                checked={system.syncEnabled}
                                onCheckedChange={(enabled) => handleToggleSync(system.id, enabled)}
                              />
                              <Label htmlFor={`sync-${system.id}`}>
                                Sincronização Automática
                              </Label>
                            </div>
                            
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleStartSync(system.id)}
                              disabled={isLoading}
                            >
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Sincronizar
                            </Button>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(system)}
                            >
                              <Settings className="h-4 w-4 mr-2" />
                              Configurar
                            </Button>
                          </div>
                        </div>
                        
                        <div className="p-6">
                          <h4 className="text-sm font-medium mb-2">Detalhes da Conexão</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-neutral-500">URL da API:</p>
                              <p className="text-sm font-medium">{system.apiUrl}</p>
                            </div>
                            <div>
                              <p className="text-sm text-neutral-500">Intervalo de Sincronização:</p>
                              <p className="text-sm font-medium">{system.syncInterval} minutos</p>
                            </div>
                          </div>
                          
                          <div className="mt-4 flex justify-end">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50">
                                  Remover
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Remover Sistema</DialogTitle>
                                  <DialogDescription>
                                    Tem certeza que deseja remover este sistema? Esta ação não pode ser desfeita.
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="mt-4">
                                  <p className="text-neutral-700">
                                    Sistema: <span className="font-medium">{system.name}</span>
                                  </p>
                                </div>
                                <DialogFooter className="mt-4">
                                  <Button variant="outline" onClick={() => {}}>Cancelar</Button>
                                  <Button 
                                    variant="destructive" 
                                    onClick={() => handleDelete(system.id)}
                                  >
                                    Remover Sistema
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="mappings" className="mt-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium">Mapeamento de Campos</h3>
                      <p className="text-sm text-neutral-500 mt-1">
                        Configure como os campos das análises do ToledoIA são mapeados para o seu sistema ERP
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button variant="outline">
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Exportar Mapeamento
                      </Button>
                    </div>
                  </div>
                  
                  <Table>
                    <TableCaption>Configuração de mapeamento entre o ToledoIA e sistemas ERP</TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campo ToledoIA</TableHead>
                        <TableHead>Campo ERP</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Obrigatório</TableHead>
                        <TableHead className="text-right">Ativo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fieldMappings.map((field) => (
                        <TableRow key={field.id}>
                          <TableCell className="font-medium">{field.sourceField}</TableCell>
                          <TableCell>{field.targetField}</TableCell>
                          <TableCell>{field.description}</TableCell>
                          <TableCell>
                            {field.required ? (
                              <Badge className="bg-primary/10 text-primary">Sim</Badge>
                            ) : (
                              <span className="text-neutral-500">Não</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Switch
                              checked={field.active}
                              onCheckedChange={(active) => handleToggleMapping(field.id, active)}
                              disabled={field.required}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  <div className="p-4 border rounded-md bg-neutral-50">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-neutral-800">Atenção ao mapear campos</h4>
                        <p className="text-sm text-neutral-600 mt-1">
                          Campos marcados como obrigatórios são essenciais para o funcionamento correto da integração e não podem ser desativados. Se o seu sistema ERP não possuir campos equivalentes para alguns itens obrigatórios, por favor entre em contato com o suporte.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="sync" className="mt-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium">Histórico de Sincronização</h3>
                      <p className="text-sm text-neutral-500 mt-1">
                        Acompanhe o histórico de sincronizações entre o ToledoIA e seus sistemas ERP
                      </p>
                    </div>
                  </div>
                  
                  {syncRecords.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <ArrowUpDown className="h-12 w-12 text-neutral-300 mb-4" />
                      <h3 className="text-lg font-medium text-neutral-700">
                        Nenhuma sincronização realizada
                      </h3>
                      <p className="text-neutral-500 mt-2 max-w-md">
                        Configure a sincronização e ative-a para começar a transferir dados entre sistemas.
                      </p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[400px] rounded-md border">
                      <div className="p-4">
                        {syncRecords.map((record, index) => (
                          <div key={record.id} className="py-3">
                            {index > 0 && <Separator className="my-3" />}
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium text-neutral-800">
                                    {record.systemName}
                                  </h4>
                                  {record.status === "success" ? (
                                    <Badge className="bg-green-100 text-green-800 border-green-200">
                                      <CheckCircle2 className="h-3 w-3 mr-1" /> Sucesso
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-red-100 text-red-800 border-red-200">
                                      <XCircle className="h-3 w-3 mr-1" /> Erro
                                    </Badge>
                                  )}
                                </div>
                                
                                <p className="text-sm text-neutral-500 mt-1">
                                  {formatDate(record.timestamp)}
                                </p>
                                
                                <p className="text-sm mt-2">
                                  {record.description}
                                </p>
                              </div>
                              
                              <div className="text-right">
                                <span className="text-sm text-neutral-500">
                                  Itens processados:
                                </span>
                                <p className="font-medium">
                                  {record.itemsProcessed}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                  
                  <div className="p-4 border rounded-md bg-neutral-50">
                    <div className="flex items-start gap-2">
                      <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-neutral-800">Sobre a sincronização</h4>
                        <p className="text-sm text-neutral-600 mt-1">
                          A sincronização permite que análises de circuitos realizadas no ToledoIA sejam enviadas automaticamente para seu sistema ERP, criando ordens de serviço e registros de manutenção. Isto facilita o fluxo de trabalho dos técnicos e garante que todas as análises estejam devidamente documentadas no sistema oficial da empresa.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
        
        <CardFooter className="border-t bg-neutral-50 text-sm text-neutral-500 flex items-center">
          <Link2 className="h-4 w-4 mr-2 text-neutral-400" />
          <p>
            A integração com sistemas ERP permite a gestão centralizada de manutenções e análises técnicas.
          </p>
        </CardFooter>
      </Card>
      
      {/* Dialog para adicionar/editar sistema */}
      <Dialog open={isAddingSystem} onOpenChange={setIsAddingSystem}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Editar Sistema ERP" : "Adicionar Sistema ERP"}
            </DialogTitle>
            <DialogDescription>
              Configure os detalhes de conexão com seu sistema de gerenciamento de manutenção
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Sistema</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex.: SAP PM - Produção" {...field} />
                      </FormControl>
                      <FormDescription>
                        Um nome descritivo para identificar este sistema
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Sistema</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="sap">SAP PM</SelectItem>
                          <SelectItem value="oracle">Oracle EAM</SelectItem>
                          <SelectItem value="maximo">IBM Maximo</SelectItem>
                          <SelectItem value="custom">Personalizado</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Selecione o tipo de sistema ERP para usar o template correto
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="apiUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL da API</FormLabel>
                    <FormControl>
                      <Input placeholder="https://api.example.com/erp" {...field} />
                    </FormControl>
                    <FormDescription>
                      O endereço da API de integração do sistema ERP
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="apiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chave da API</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••••••••••" {...field} />
                    </FormControl>
                    <FormDescription>
                      A chave de autenticação para acesso à API do sistema ERP
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="syncInterval"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Intervalo de Sincronização (minutos)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="60" 
                          min={5}
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        A frequência com que os dados serão sincronizados
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="syncEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <div className="flex items-center gap-2 mb-2">
                        <FormLabel>Sincronização Automática</FormLabel>
                      </div>
                      <div className="flex items-center space-x-2">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <span className="text-sm text-neutral-500">
                          {field.value ? "Ativada" : "Desativada"}
                        </span>
                      </div>
                      <FormDescription>
                        Ative para sincronizar automaticamente nos intervalos definidos
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="p-4 border rounded-md bg-blue-50">
                <div className="flex items-start gap-2">
                  <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-800">Nota sobre integração</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      Após configurar a integração, recomendamos realizar uma sincronização manual para verificar se tudo está funcionando corretamente. Verifique os logs de sincronização para identificar possíveis problemas.
                    </p>
                  </div>
                </div>
              </div>
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsAddingSystem(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  <Save className="h-4 w-4 mr-2" />
                  {isEditing ? "Atualizar" : "Adicionar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}