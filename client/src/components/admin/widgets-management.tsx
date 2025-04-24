import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, MoreHorizontal, Plus, Edit, Trash2, Copy, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ChatWidget } from "@shared/schema";

// Schema para validação do formulário
const widgetFormSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres").max(100, "Nome não pode ter mais de 100 caracteres"),
  description: z.string().nullable().optional(),
  welcome_message: z.string().nullable().optional(),
  theme_color: z.string().regex(/^#[0-9A-F]{6}$/i, "Cor deve estar no formato hexadecimal (ex: #6366F1)").optional(),
  allowed_domains: z.array(z.string()).optional()
});

type WidgetFormValues = z.infer<typeof widgetFormSchema>;

// Componente principal
export default function WidgetsManagement() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState<string | null>(null);
  const [domainInput, setDomainInput] = useState("");
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);

  // Consulta para obter a lista de widgets
  const { data: widgets, isLoading } = useQuery({
    queryKey: ["/api/widgets"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/widgets");
      const data = await response.json();
      return data as ChatWidget[];
    }
  });

  // Consulta para obter detalhes de um widget específico
  const { data: selectedWidget, isLoading: isLoadingWidget } = useQuery({
    queryKey: ["/api/widgets", selectedWidgetId],
    queryFn: async () => {
      if (!selectedWidgetId) return null;
      const response = await apiRequest("GET", `/api/widgets/${selectedWidgetId}`);
      const data = await response.json();
      return data as ChatWidget;
    },
    enabled: !!selectedWidgetId
  });

  // Mutations para criar, atualizar e excluir widgets
  const createWidgetMutation = useMutation({
    mutationFn: async (data: WidgetFormValues) => {
      const response = await apiRequest("POST", "/api/widgets", {
        ...data,
        allowed_domains: allowedDomains
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/widgets"] });
      setIsCreateDialogOpen(false);
      setAllowedDomains([]);
      toast({
        title: t("Widget criado com sucesso"),
        description: t("O novo widget está pronto para ser usado"),
        variant: "default",
      });
    },
    onError: (error) => {
      toast({
        title: t("Erro ao criar widget"),
        description: error.message || t("Ocorreu um erro ao criar o widget"),
        variant: "destructive",
      });
    }
  });

  const updateWidgetMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<WidgetFormValues> }) => {
      const response = await apiRequest("PUT", `/api/widgets/${id}`, {
        ...data,
        allowed_domains: allowedDomains
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/widgets"] });
      if (selectedWidgetId) {
        queryClient.invalidateQueries({ queryKey: ["/api/widgets", selectedWidgetId] });
      }
      setIsEditDialogOpen(false);
      toast({
        title: t("Widget atualizado com sucesso"),
        description: t("As alterações foram salvas"),
        variant: "default",
      });
    },
    onError: (error) => {
      toast({
        title: t("Erro ao atualizar widget"),
        description: error.message || t("Ocorreu um erro ao atualizar o widget"),
        variant: "destructive",
      });
    }
  });

  const deleteWidgetMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/widgets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/widgets"] });
      toast({
        title: t("Widget excluído"),
        description: t("O widget foi excluído permanentemente"),
        variant: "default",
      });
    },
    onError: (error) => {
      toast({
        title: t("Erro ao excluir widget"),
        description: error.message || t("Ocorreu um erro ao excluir o widget"),
        variant: "destructive",
      });
    }
  });

  const toggleWidgetStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await apiRequest("PUT", `/api/widgets/${id}`, {
        is_active: isActive
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/widgets"] });
      if (selectedWidgetId) {
        queryClient.invalidateQueries({ queryKey: ["/api/widgets", selectedWidgetId] });
      }
      
      toast({
        title: data.is_active 
          ? t("Widget ativado") 
          : t("Widget desativado"),
        description: data.is_active 
          ? t("O widget agora está disponível para uso") 
          : t("O widget foi desativado"),
        variant: "default",
      });
    },
    onError: (error) => {
      toast({
        title: t("Erro ao alterar status do widget"),
        description: error.message || t("Ocorreu um erro ao alterar o status do widget"),
        variant: "destructive",
      });
    }
  });

  // Formulário para criar widget
  const createForm = useForm<WidgetFormValues>({
    resolver: zodResolver(widgetFormSchema),
    defaultValues: {
      name: "",
      description: "",
      welcome_message: "Olá! Como posso ajudar?",
      theme_color: "#6366F1",
      allowed_domains: []
    }
  });

  // Formulário para editar widget
  const editForm = useForm<WidgetFormValues>({
    resolver: zodResolver(widgetFormSchema),
    defaultValues: {
      name: "",
      description: "",
      welcome_message: "",
      theme_color: "#6366F1",
      allowed_domains: []
    }
  });

  // Configurar o formulário de edição quando o widget selecionado mudar
  React.useEffect(() => {
    if (selectedWidget) {
      editForm.reset({
        name: selectedWidget.name,
        description: selectedWidget.description || "",
        welcome_message: selectedWidget.welcome_message || "",
        theme_color: selectedWidget.theme_color || "#6366F1",
      });
      
      setAllowedDomains(selectedWidget.allowed_domains || []);
    }
  }, [selectedWidget, editForm]);

  // Manipuladores de eventos
  const handleCreateSubmit = (data: WidgetFormValues) => {
    createWidgetMutation.mutate(data);
  };

  const handleEditSubmit = (data: WidgetFormValues) => {
    if (selectedWidgetId) {
      updateWidgetMutation.mutate({ id: selectedWidgetId, data });
    }
  };

  const handleDeleteWidget = (id: string) => {
    if (window.confirm(t("Tem certeza que deseja excluir este widget? Esta ação não pode ser desfeita."))) {
      deleteWidgetMutation.mutate(id);
    }
  };

  const handleToggleWidgetStatus = (id: string, currentStatus: boolean) => {
    toggleWidgetStatusMutation.mutate({ id, isActive: !currentStatus });
  };

  const handleEditWidget = (id: string) => {
    setSelectedWidgetId(id);
    setIsEditDialogOpen(true);
  };

  const handleAddDomain = () => {
    if (domainInput && !allowedDomains.includes(domainInput)) {
      setAllowedDomains([...allowedDomains, domainInput]);
      setDomainInput("");
    }
  };

  const handleRemoveDomain = (domain: string) => {
    setAllowedDomains(allowedDomains.filter(d => d !== domain));
  };

  const copyToClipboard = (text: string, message: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: t("Copiado!"),
        description: message,
        variant: "default",
      });
    });
  };

  // Código de exemplo para incorporação do widget
  const getEmbedCode = (widget: ChatWidget) => {
    return `<script src="https://cdn.example.com/widget.js" id="toledoia-widget" data-api-key="${widget.api_key}"></script>`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("Widgets de Chat")}</h2>
          <p className="text-muted-foreground">
            {t("Crie widgets de chat para incorporar em seus sites e aplicativos")}
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> {t("Novo Widget")}
        </Button>
      </div>

      <Separator />

      {/* Lista de widgets */}
      {widgets && widgets.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("Nome")}</TableHead>
              <TableHead>{t("Status")}</TableHead>
              <TableHead>{t("Criado em")}</TableHead>
              <TableHead>{t("Domínios permitidos")}</TableHead>
              <TableHead className="w-[100px]">{t("Ações")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {widgets.map((widget) => (
              <TableRow key={widget.id}>
                <TableCell className="font-medium">{widget.name}</TableCell>
                <TableCell>
                  <Badge variant={widget.is_active ? "default" : "secondary"}>
                    {widget.is_active ? t("Ativo") : t("Inativo")}
                  </Badge>
                </TableCell>
                <TableCell>
                  {new Date(widget.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {widget.allowed_domains && widget.allowed_domains.length > 0 
                    ? widget.allowed_domains.length 
                    : t("Todos")}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">{t("Abrir menu")}</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditWidget(widget.id)}>
                        <Edit className="mr-2 h-4 w-4" />
                        {t("Editar")}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleToggleWidgetStatus(widget.id, widget.is_active)}
                      >
                        <Globe className="mr-2 h-4 w-4" />
                        {widget.is_active ? t("Desativar") : t("Ativar")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => copyToClipboard(widget.api_key, t("API key copiada para a área de transferência"))}>
                        <Copy className="mr-2 h-4 w-4" />
                        {t("Copiar API Key")}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => copyToClipboard(getEmbedCode(widget), t("Código de incorporação copiado"))}
                        className="text-blue-600"
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        {t("Copiar código HTML")}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDeleteWidget(widget.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t("Excluir")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <Card>
          <CardContent className="py-10 flex flex-col items-center justify-center">
            <p className="text-muted-foreground mb-4">
              {t("Você ainda não tem widgets de chat")}
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> {t("Criar seu primeiro widget")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Modal para criar novo widget */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{t("Criar novo Widget de Chat")}</DialogTitle>
            <DialogDescription>
              {t("Configure as informações do seu widget de chat para incorporá-lo em seu site.")}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-6">
              <Tabs defaultValue="general">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="general">{t("Geral")}</TabsTrigger>
                  <TabsTrigger value="security">{t("Segurança")}</TabsTrigger>
                </TabsList>
                
                <TabsContent value="general" className="space-y-4 pt-4">
                  <FormField
                    control={createForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("Nome do Widget")}</FormLabel>
                        <FormControl>
                          <Input placeholder={t("Meu Widget de Chat")} {...field} />
                        </FormControl>
                        <FormDescription>
                          {t("Nome identificador para este widget.")}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={createForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("Descrição")} ({t("opcional")})</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder={t("Uma descrição breve sobre o propósito deste widget")} 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={createForm.control}
                    name="welcome_message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("Mensagem de boas-vindas")}</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder={t("Olá! Como posso ajudar?")} 
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          {t("Esta mensagem será exibida quando o usuário abrir o chat.")}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={createForm.control}
                    name="theme_color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("Cor do tema")}</FormLabel>
                        <div className="flex items-center space-x-2">
                          <input 
                            type="color" 
                            value={field.value || "#6366F1"}
                            onChange={(e) => field.onChange(e.target.value)} 
                            className="w-12 h-8 border rounded"
                          />
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </div>
                        <FormDescription>
                          {t("Cor principal para a interface do widget.")}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
                
                <TabsContent value="security" className="space-y-4 pt-4">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium mb-2">{t("Domínios permitidos")}</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {t("O widget só funcionará nos domínios especificados. Deixe vazio para permitir todos os domínios.")}
                      </p>
                      
                      <div className="flex items-center space-x-2 mb-4">
                        <Input 
                          placeholder="example.com" 
                          value={domainInput}
                          onChange={(e) => setDomainInput(e.target.value)}
                        />
                        <Button type="button" onClick={handleAddDomain}>
                          {t("Adicionar")}
                        </Button>
                      </div>
                      
                      {allowedDomains.length > 0 ? (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {allowedDomains.map((domain) => (
                            <Badge key={domain} variant="secondary" className="pl-3 pr-2 py-1 flex items-center">
                              {domain}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-auto p-0 pl-1"
                                onClick={() => handleRemoveDomain(domain)}
                              >
                                <span className="text-xs">×</span>
                              </Button>
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {t("Nenhum domínio adicionado. O widget funcionará em qualquer domínio.")}
                        </p>
                      )}
                    </div>
                    
                    <div className="mt-4">
                      <h3 className="font-medium mb-2">{t("Dica de segurança")}</h3>
                      <p className="text-sm text-muted-foreground">
                        {t("Para maior segurança, recomendamos que você restrinja os domínios onde seu widget pode ser utilizado.")}
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  {t("Cancelar")}
                </Button>
                <Button 
                  type="submit" 
                  disabled={createWidgetMutation.isPending}
                >
                  {createWidgetMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t("Criar Widget")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Modal para editar widget */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{t("Editar Widget de Chat")}</DialogTitle>
            <DialogDescription>
              {t("Atualize as configurações do seu widget de chat.")}
            </DialogDescription>
          </DialogHeader>
          
          {isLoadingWidget ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-6">
                <Tabs defaultValue="general">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="general">{t("Geral")}</TabsTrigger>
                    <TabsTrigger value="security">{t("Segurança")}</TabsTrigger>
                    <TabsTrigger value="embed">{t("Integração")}</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="general" className="space-y-4 pt-4">
                    <FormField
                      control={editForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("Nome do Widget")}</FormLabel>
                          <FormControl>
                            <Input placeholder={t("Meu Widget de Chat")} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={editForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("Descrição")} ({t("opcional")})</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder={t("Uma descrição breve sobre o propósito deste widget")} 
                              {...field} 
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={editForm.control}
                      name="welcome_message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("Mensagem de boas-vindas")}</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder={t("Olá! Como posso ajudar?")} 
                              {...field} 
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormDescription>
                            {t("Esta mensagem será exibida quando o usuário abrir o chat.")}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={editForm.control}
                      name="theme_color"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("Cor do tema")}</FormLabel>
                          <div className="flex items-center space-x-2">
                            <input 
                              type="color" 
                              value={field.value || "#6366F1"}
                              onChange={(e) => field.onChange(e.target.value)} 
                              className="w-12 h-8 border rounded"
                            />
                            <FormControl>
                              <Input {...field} value={field.value || ""} />
                            </FormControl>
                          </div>
                          <FormDescription>
                            {t("Cor principal para a interface do widget.")}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {selectedWidget && (
                      <div className="flex items-center justify-between border p-4 rounded-md bg-muted/10">
                        <div>
                          <h4 className="font-semibold">{t("Status do Widget")}</h4>
                          <p className="text-sm text-muted-foreground">
                            {selectedWidget.is_active 
                              ? t("O widget está ativo e pode ser usado") 
                              : t("O widget está desativado")}
                          </p>
                        </div>
                        <Switch
                          checked={selectedWidget.is_active}
                          onCheckedChange={(checked) => {
                            if (selectedWidget) {
                              handleToggleWidgetStatus(selectedWidget.id, selectedWidget.is_active);
                            }
                          }}
                        />
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="security" className="space-y-4 pt-4">
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-medium mb-2">{t("Domínios permitidos")}</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          {t("O widget só funcionará nos domínios especificados. Deixe vazio para permitir todos os domínios.")}
                        </p>
                        
                        <div className="flex items-center space-x-2 mb-4">
                          <Input 
                            placeholder="example.com" 
                            value={domainInput}
                            onChange={(e) => setDomainInput(e.target.value)}
                          />
                          <Button type="button" onClick={handleAddDomain}>
                            {t("Adicionar")}
                          </Button>
                        </div>
                        
                        {allowedDomains.length > 0 ? (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {allowedDomains.map((domain) => (
                              <Badge key={domain} variant="secondary" className="pl-3 pr-2 py-1 flex items-center">
                                {domain}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto p-0 pl-1"
                                  onClick={() => handleRemoveDomain(domain)}
                                >
                                  <span className="text-xs">×</span>
                                </Button>
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {t("Nenhum domínio adicionado. O widget funcionará em qualquer domínio.")}
                          </p>
                        )}
                      </div>
                      
                      {selectedWidget && (
                        <div className="mt-6 border p-4 rounded-md bg-muted/10">
                          <h3 className="font-medium mb-2">{t("API Key")}</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            {t("Esta é a chave de API usada para autenticar seu widget.")}
                          </p>
                          
                          <div className="flex items-center space-x-2">
                            <Input 
                              type={showApiKey === selectedWidget.id ? "text" : "password"} 
                              value={selectedWidget.api_key}
                              readOnly
                            />
                            <Button
                              variant="outline" 
                              size="sm"
                              onClick={() => setShowApiKey(
                                showApiKey === selectedWidget.id ? null : selectedWidget.id
                              )}
                            >
                              {showApiKey === selectedWidget.id ? t("Ocultar") : t("Mostrar")}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(
                                selectedWidget.api_key, 
                                t("API key copiada para a área de transferência")
                              )}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-sm mt-2 text-amber-500">
                            {t("Mantenha esta chave em segurança! Não a compartilhe publicamente.")}
                          </p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="embed" className="space-y-4 pt-4">
                    {selectedWidget && (
                      <div className="space-y-4">
                        <div>
                          <h3 className="font-medium mb-2">{t("Código de incorporação")}</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            {t("Adicione este código ao seu site para incorporar o widget de chat.")}
                          </p>
                          
                          <div className="relative">
                            <Textarea 
                              value={getEmbedCode(selectedWidget)}
                              readOnly
                              rows={4}
                              className="font-mono text-sm"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="absolute top-2 right-2"
                              onClick={() => copyToClipboard(
                                getEmbedCode(selectedWidget), 
                                t("Código de incorporação copiado")
                              )}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="mt-6">
                          <h3 className="font-medium mb-2">{t("Instruções")}</h3>
                          <ol className="list-decimal list-inside space-y-2 text-sm">
                            <li>{t("Copie o código acima.")}</li>
                            <li>{t("Cole-o no HTML do seu site, antes do fechamento da tag body.")}</li>
                            <li>{t("O widget de chat aparecerá automaticamente em seu site.")}</li>
                          </ol>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
                
                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsEditDialogOpen(false)}
                  >
                    {t("Cancelar")}
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updateWidgetMutation.isPending}
                  >
                    {updateWidgetMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {t("Salvar Alterações")}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}