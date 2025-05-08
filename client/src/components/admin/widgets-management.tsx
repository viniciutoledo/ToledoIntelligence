import React, { useState, useRef } from "react";
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
import { WidgetDocsLink } from "./widget-docs-link";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MoreHorizontal, Plus, Edit, Trash2, Copy, Globe, Upload, Link } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ChatWidget } from "@shared/schema";
import { generateEmbedCode, type EmbedCodeResult } from "@/components/widget/generate-embed-code";

// Importar estilos específicos para o diálogo de widgets
import "./widgets-dialog.css";

// Schema para validação do formulário
const widgetFormSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres").max(100, "Nome não pode ter mais de 100 caracteres"),
  greeting: z.string().min(1, "Mensagem de boas-vindas é obrigatória"),
  avatar_url: z.string()
    .refine(
      (value) => {
        // Validar se é vazio (caso a imagem seja carregada por arquivo)
        if (!value) return true;
        
        // Validar se é uma URL relativa ao servidor (começa com '/')
        if (value.startsWith('/')) return true;
        
        // Validar se é uma URL completa
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      },
      { message: "URL de avatar inválida" }
    )
    .optional()
    .default("https://ui-avatars.com/api/?name=T&background=6366F1&color=fff"),
  avatar_image: z.any().optional(),
  theme_color: z.string().regex(/^#[0-9A-F]{6}$/i, "Cor deve estar no formato hexadecimal (ex: #6366F1)").default("#6366F1"),
  background_color: z.string().regex(/^#[0-9A-F]{6}$/i, "Cor deve estar no formato hexadecimal (ex: #FFFFFF)").default("#FFFFFF"),
  font_size: z.string().default("16px"), // Atualizado para 16px por padrão
  font_color: z.string().regex(/^#[0-9A-F]{6}$/i, "Cor deve estar no formato hexadecimal (ex: #000000)").default("#000000"),
  bot_message_bg_color: z.string().regex(/^#[0-9A-F]{6}$/i, "Cor deve estar no formato hexadecimal (ex: #F3F4F6)").default("#F3F4F6"),
  user_message_bg_color: z.string().regex(/^#[0-9A-F]{6}$/i, "Cor deve estar no formato hexadecimal (ex: #6366F1)").default("#6366F1"),
  allowed_domains: z.array(z.string()).optional(),
  
  // Campos adicionais para configurações avançadas
  hide_minimize_button: z.boolean().optional().default(false),
  hide_close_button: z.boolean().optional().default(false),
  default_height: z.string().optional().default("600"),
  default_width: z.string().optional().default("350"),
  custom_css: z.string().optional().default(""),
  
  // Novas opções de controle da conversa
  allow_human_help: z.boolean().optional().default(true),
  use_emojis: z.boolean().optional().default(true),
  restrict_topics: z.boolean().optional().default(false),
  split_responses: z.boolean().optional().default(true),
  allow_reminders: z.boolean().optional().default(false),
  
  // Novas opções operacionais
  response_time: z.string().optional().default("immediate"),
  agent_timezone: z.string().optional().default("America/Sao_Paulo"),
  max_interactions: z.number().min(1).optional().default(20),
  interaction_limit_action: z.string().optional().default("block_5m")
});

type WidgetFormValues = z.infer<typeof widgetFormSchema>;

// Componente principal
export function WidgetsManagement() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState<string | null>(null);
  const [domainInput, setDomainInput] = useState("");
  const [allowedDomains, setAllowedDomains] = useState<string[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [editPreviewImage, setEditPreviewImage] = useState<string | null>(null);
  const createFileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

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
      // Garantir que todos os campos necessários estejam presentes
      const widgetData = {
        name: data.name || "Meu Widget",
        greeting: data.greeting || "Olá! Como posso ajudar?",
        avatar_url: data.avatar_url || "https://ui-avatars.com/api/?name=T&background=6366F1&color=fff",
        theme_color: data.theme_color || "#6366F1",
        background_color: data.background_color || "#FFFFFF",
        font_size: data.font_size || "14px",
        font_color: data.font_color || "#000000",
        bot_message_bg_color: data.bot_message_bg_color || "#F3F4F6",
        user_message_bg_color: data.user_message_bg_color || "#6366F1",
        allowed_domains: allowedDomains
      };
      
      console.log("Enviando dados para criar widget:", widgetData);
      const response = await apiRequest("POST", "/api/widgets", widgetData);
      const responseData = await response.json();
      console.log("Resposta da criação de widget:", responseData);
      return responseData;
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
      console.error("Erro ao criar widget:", error);
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
      name: "Meu Widget",
      greeting: "Olá! Como posso ajudar?",
      avatar_url: "https://ui-avatars.com/api/?name=T&background=6366F1&color=fff",
      theme_color: "#6366F1",
      background_color: "#FFFFFF",
      font_size: "16px",
      font_color: "#000000",
      bot_message_bg_color: "#F3F4F6",
      user_message_bg_color: "#6366F1",
      allowed_domains: [],
      // Configurações avançadas
      hide_minimize_button: false,
      hide_close_button: false,
      default_height: "600",
      default_width: "350",
      custom_css: "",
      
      // Novas opções de controle da conversa
      allow_human_help: true,
      use_emojis: true,
      restrict_topics: false,
      split_responses: true,
      allow_reminders: false,
      
      // Novas opções operacionais
      response_time: "immediate",
      agent_timezone: "America/Sao_Paulo",
      max_interactions: 20,
      interaction_limit_action: "block_5m"
    }
  });

  // Formulário para editar widget
  const editForm = useForm<WidgetFormValues>({
    resolver: zodResolver(widgetFormSchema),
    defaultValues: {
      name: "",
      greeting: "",
      avatar_url: "",
      theme_color: "#6366F1",
      background_color: "#FFFFFF",
      font_size: "16px",
      font_color: "#000000",
      bot_message_bg_color: "#F3F4F6",
      user_message_bg_color: "#6366F1",
      allowed_domains: [],
      
      // Configurações avançadas
      hide_minimize_button: false,
      hide_close_button: false,
      default_height: "600",
      default_width: "350",
      custom_css: "",
      
      // Novas opções de controle da conversa
      allow_human_help: true,
      use_emojis: true,
      restrict_topics: false,
      split_responses: true,
      allow_reminders: false,
      
      // Novas opções operacionais
      response_time: "immediate",
      agent_timezone: "America/Sao_Paulo",
      max_interactions: 20,
      interaction_limit_action: "block_5m"
    }
  });

  // Configurar o formulário de edição quando o widget selecionado mudar
  React.useEffect(() => {
    if (selectedWidget) {
      editForm.reset({
        name: selectedWidget.name,
        greeting: selectedWidget.greeting,
        avatar_url: selectedWidget.avatar_url,
        theme_color: selectedWidget.theme_color || "#6366F1",
        background_color: selectedWidget.background_color || "#FFFFFF",
        font_size: selectedWidget.font_size || "16px",
        font_color: selectedWidget.font_color || "#000000",
        bot_message_bg_color: selectedWidget.bot_message_bg_color || "#F3F4F6",
        user_message_bg_color: selectedWidget.user_message_bg_color || "#6366F1",
        
        // Configurações avançadas
        hide_minimize_button: selectedWidget.hide_minimize_button || false,
        hide_close_button: selectedWidget.hide_close_button || false,
        default_height: selectedWidget.default_height || "600",
        default_width: selectedWidget.default_width || "350",
        custom_css: selectedWidget.custom_css || "",
        
        // Novas opções de controle da conversa
        allow_human_help: selectedWidget.allow_human_help ?? true,
        use_emojis: selectedWidget.use_emojis ?? true,
        restrict_topics: selectedWidget.restrict_topics ?? false,
        split_responses: selectedWidget.split_responses ?? true,
        allow_reminders: selectedWidget.allow_reminders ?? false,
        
        // Novas opções operacionais
        response_time: selectedWidget.response_time || "immediate",
        agent_timezone: selectedWidget.agent_timezone || "America/Sao_Paulo",
        max_interactions: selectedWidget.max_interactions || 20,
        interaction_limit_action: selectedWidget.interaction_limit_action || "block_5m"
      });
      
      setAllowedDomains(selectedWidget.allowed_domains || []);
    }
  }, [selectedWidget, editForm]);

  // Manipuladores de eventos
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validar tamanho do arquivo (5MB máximo)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: t("Erro"),
        description: t("A imagem deve ter no máximo 5MB"),
        variant: "destructive",
      });
      return;
    }
    
    // Validar tipo de arquivo
    if (!["image/jpeg", "image/png", "image/jpg"].includes(file.type)) {
      toast({
        title: t("Erro"),
        description: t("Apenas imagens JPG e PNG são permitidas"),
        variant: "destructive",
      });
      return;
    }
    
    // Criar prévia
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target && typeof event.target.result === 'string') {
        if (isEdit) {
          setEditPreviewImage(event.target.result);
        } else {
          setPreviewImage(event.target.result);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateSubmit = async (data: WidgetFormValues) => {
    console.log("Início da função handleCreateSubmit com dados:", data);
    
    // Sempre usar FormData, independente de ter arquivo ou não
    const formData = new FormData();
    
    // Garantir que o nome esteja presente
    if (!data.name) {
      data.name = "Meu Widget"; // Valor padrão caso esteja vazio
    }
    
    // Adicionar campos obrigatórios
    formData.append("name", data.name);
    formData.append("greeting", data.greeting || "Olá! Como posso ajudar?");
    formData.append("theme_color", data.theme_color || "#6366F1");
    
    // Adicionar domínios permitidos
    if (allowedDomains.length > 0) {
      formData.append("allowed_domains", JSON.stringify(allowedDomains));
    }
    
    // Adicionar configurações avançadas
    formData.append("hide_minimize_button", String(data.hide_minimize_button || false));
    formData.append("hide_close_button", String(data.hide_close_button || false));
    formData.append("default_height", data.default_height || "600");
    formData.append("default_width", data.default_width || "350");
    formData.append("background_color", data.background_color || "#FFFFFF");
    formData.append("font_size", data.font_size || "16px");
    formData.append("font_color", data.font_color || "#000000");
    formData.append("bot_message_bg_color", data.bot_message_bg_color || "#F3F4F6");
    formData.append("user_message_bg_color", data.user_message_bg_color || "#6366F1");
    formData.append("custom_css", data.custom_css || "");
    
    // Adicionar opções de controle da conversa
    formData.append("allow_human_help", String(data.allow_human_help !== undefined ? data.allow_human_help : true));
    formData.append("use_emojis", String(data.use_emojis !== undefined ? data.use_emojis : true));
    formData.append("restrict_topics", String(data.restrict_topics !== undefined ? data.restrict_topics : false));
    formData.append("split_responses", String(data.split_responses !== undefined ? data.split_responses : true));
    formData.append("allow_reminders", String(data.allow_reminders !== undefined ? data.allow_reminders : false));
    
    // Adicionar opções operacionais
    formData.append("response_time", data.response_time || "immediate");
    formData.append("agent_timezone", data.agent_timezone || "America/Sao_Paulo");
    formData.append("max_interactions", String(data.max_interactions || 20));
    formData.append("interaction_limit_action", data.interaction_limit_action || "block_5m");
    
    // Verificar se há um arquivo de avatar
    const fileInput = createFileInputRef.current;
    const file = fileInput?.files?.[0];
    if (file) {
      formData.append("avatar_image", file);
    } else if (data.avatar_url) {
      formData.append("avatar_url", data.avatar_url);
    }
    
    // Verificar o conteúdo do FormData (para depuração)
    console.log("FormData criado com campos:");
    for (const pair of (formData as any).entries()) {
      console.log(pair[0] + ': ' + pair[1]);
    }
    
    try {
      console.log("Enviando requisição...");
      const response = await fetch("/api/widgets", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Erro na resposta:", errorText);
        throw new Error(errorText);
      }
      
      const responseData = await response.json();
      console.log("Resposta de sucesso:", responseData);
      
      // Atualizar os dados da UI
      queryClient.invalidateQueries({ queryKey: ["/api/widgets"] });
      setIsCreateDialogOpen(false);
      setAllowedDomains([]);
      setPreviewImage(null);
      
      if (fileInput) {
        fileInput.value = "";
      }
      
      toast({
        title: t("Widget criado com sucesso"),
        description: t("O novo widget está pronto para ser usado"),
        variant: "default",
      });
    } catch (error: any) {
      console.error("Erro ao criar widget:", error);
      toast({
        title: t("Erro ao criar widget"),
        description: error.message || t("Ocorreu um erro ao criar o widget"),
        variant: "destructive",
      });
    }
  };

  const handleEditSubmit = async (data: WidgetFormValues) => {
    console.log("Início da função handleEditSubmit com dados:", data);
    if (!selectedWidgetId) return;
    
    // Sempre usar FormData, independente de ter arquivo ou não
    const formData = new FormData();
    
    // Garantir que o nome esteja presente
    if (!data.name) {
      data.name = "Meu Widget"; // Valor padrão caso esteja vazio
    }
    
    // Adicionar campos obrigatórios
    formData.append("name", data.name);
    formData.append("greeting", data.greeting || "Olá! Como posso ajudar?");
    formData.append("theme_color", data.theme_color || "#6366F1");
    
    // Adicionar domínios permitidos
    if (allowedDomains.length > 0) {
      formData.append("allowed_domains", JSON.stringify(allowedDomains));
    }
    
    // Adicionar configurações avançadas
    formData.append("hide_minimize_button", String(data.hide_minimize_button || false));
    formData.append("hide_close_button", String(data.hide_close_button || false));
    formData.append("default_height", data.default_height || "600");
    formData.append("default_width", data.default_width || "350");
    formData.append("background_color", data.background_color || "#FFFFFF");
    formData.append("font_size", data.font_size || "16px");
    formData.append("font_color", data.font_color || "#000000");
    formData.append("bot_message_bg_color", data.bot_message_bg_color || "#F3F4F6");
    formData.append("user_message_bg_color", data.user_message_bg_color || "#6366F1");
    formData.append("custom_css", data.custom_css || "");
    
    // Adicionar opções de controle da conversa
    formData.append("allow_human_help", String(data.allow_human_help !== undefined ? data.allow_human_help : true));
    formData.append("use_emojis", String(data.use_emojis !== undefined ? data.use_emojis : true));
    formData.append("restrict_topics", String(data.restrict_topics !== undefined ? data.restrict_topics : false));
    formData.append("split_responses", String(data.split_responses !== undefined ? data.split_responses : true));
    formData.append("allow_reminders", String(data.allow_reminders !== undefined ? data.allow_reminders : false));
    
    // Adicionar opções operacionais
    formData.append("response_time", data.response_time || "immediate");
    formData.append("agent_timezone", data.agent_timezone || "America/Sao_Paulo");
    formData.append("max_interactions", String(data.max_interactions || 20));
    formData.append("interaction_limit_action", data.interaction_limit_action || "block_5m");
    
    // Verificar se há um arquivo de avatar
    const fileInput = editFileInputRef.current;
    const file = fileInput?.files?.[0];
    if (file) {
      formData.append("avatar_image", file);
    } else if (data.avatar_url) {
      formData.append("avatar_url", data.avatar_url);
    }
    
    // Verificar o conteúdo do FormData (para depuração)
    console.log("FormData criado com campos:");
    for (const pair of (formData as any).entries()) {
      console.log(pair[0] + ': ' + pair[1]);
    }
    
    try {
      console.log("Enviando requisição...");
      const response = await fetch(`/api/widgets/${selectedWidgetId}`, {
        method: "PUT",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Erro na resposta:", errorText);
        throw new Error(errorText);
      }
      
      const responseData = await response.json();
      console.log("Resposta de sucesso:", responseData);
      
      // Atualizar os dados da UI
      queryClient.invalidateQueries({ queryKey: ["/api/widgets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/widgets", selectedWidgetId] });
      setIsEditDialogOpen(false);
      setEditPreviewImage(null);
      
      if (fileInput) {
        fileInput.value = "";
      }
      
      toast({
        title: t("Widget atualizado com sucesso"),
        description: t("As alterações foram salvas"),
        variant: "default",
      });
    } catch (error: any) {
      console.error("Erro ao atualizar widget:", error);
      toast({
        title: t("Erro ao atualizar widget"),
        description: error.message || t("Ocorreu um erro ao atualizar o widget"),
        variant: "destructive",
      });
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

  // Gerar código de incorporação para o widget
  const getEmbedCode = (widget: ChatWidget): string => {
    const result = generateEmbedCode({
      apiKey: widget.api_key,
      position: "bottom-right", // Posição padrão
      initialOpen: false,
      width: parseInt(widget.default_width || "350"),
      height: parseInt(widget.default_height || "600")
    });
    
    // Forçar o tipo de retorno para string
    return typeof result === "string" ? result : result.scriptCode;
  };
  
  // Gerar o objeto completo com todos os formatos de incorporação
  const getFullEmbedCode = (widget: ChatWidget): EmbedCodeResult => {
    return generateEmbedCode({
      apiKey: widget.api_key,
      position: "bottom-right",
      initialOpen: false,
      width: parseInt(widget.default_width || "350"),
      height: parseInt(widget.default_height || "600"),
      returnFullObject: true
    }) as EmbedCodeResult;
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
      
      {/* Link para documentação de integração */}
      <WidgetDocsLink />

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
                        onClick={() => copyToClipboard(getFullEmbedCode(widget).scriptCode, t("Código de incorporação copiado"))}
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
        <DialogContent className="widgets-dialog">
          <DialogHeader>
            <DialogTitle>{t("Criar novo Widget de Chat")}</DialogTitle>
            <DialogDescription>
              {t("Configure as informações do seu widget de chat para incorporá-lo em seu site.")}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-6">
              <Tabs defaultValue="general">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="general">{t("Geral")}</TabsTrigger>
                  <TabsTrigger value="security">{t("Segurança")}</TabsTrigger>
                  <TabsTrigger value="conversation">{t("Conversa")}</TabsTrigger>
                  <TabsTrigger value="operational">{t("Operacional")}</TabsTrigger>
                  <TabsTrigger value="advanced">{t("Avançado")}</TabsTrigger>
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
                    name="avatar_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("Avatar do Chat")}</FormLabel>
                        
                        <div className="flex flex-col md:flex-row gap-8 mb-4">
                          <div className="md:w-1/3">
                            <div className="bg-white border border-dashed border-neutral-300 rounded-lg p-4 text-center shadow-sm">
                              <div className="mb-3">
                                {previewImage ? (
                                  <img
                                    src={previewImage}
                                    alt="Avatar Preview"
                                    className="w-24 h-24 rounded-full mx-auto object-cover border-4 border-primary-100 shadow-md"
                                  />
                                ) : (
                                  <div className="w-24 h-24 rounded-full bg-gradient-to-r from-primary-100 to-accent-100 mx-auto flex items-center justify-center text-primary-600 shadow-md">
                                    <span className="text-2xl font-bold">T</span>
                                  </div>
                                )}
                              </div>
                              
                              <input
                                type="file"
                                ref={createFileInputRef}
                                onChange={(e) => handleImageChange(e, false)}
                                accept=".jpg,.jpeg,.png"
                                className="hidden"
                                aria-label="Upload avatar image"
                              />
                              
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => createFileInputRef.current?.click()}
                                className="px-3 py-1 text-sm bg-primary-100 text-primary-700 rounded-md hover:bg-primary-200 transition-colors duration-200 inline-block"
                              >
                                <Upload className="h-3.5 w-3.5 mr-1" />
                                {t("Carregar Imagem")}
                              </Button>
                              
                              <p className="mt-2 text-xs text-neutral-500">
                                {t("A imagem deve ter no máximo 5MB e estar nos formatos JPG ou PNG")}
                              </p>
                            </div>
                          </div>
                          
                          <div className="md:w-2/3">
                            <FormControl>
                              <Input 
                                placeholder="https://ui-avatars.com/api/?name=T&background=6366F1&color=fff" 
                                {...field} 
                              />
                            </FormControl>
                            <FormDescription className="mt-2">
                              {t("URL da imagem que será exibida como avatar do chat. Caso prefira, carregue uma imagem usando o botão ao lado.")}
                            </FormDescription>
                            <FormMessage />
                            
                            <div className="mt-4 bg-gradient-to-r from-neutral-50 to-white p-4 border rounded-md">
                              <div className="flex items-start">
                                <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 mr-3 shadow-sm">
                                  {previewImage ? (
                                    <img
                                      src={previewImage}
                                      alt="Avatar Preview"
                                      className="h-10 w-10 rounded-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-sm font-bold">T</span>
                                  )}
                                </div>
                                <div className="relative bg-white rounded-lg rounded-tl-none py-2 px-3 max-w-[80%] shadow-sm border border-neutral-200">
                                  <div className="text-xs font-semibold mb-1 text-neutral-700">
                                    {createForm.watch('name') || "Widget de Chat"}
                                  </div>
                                  <p className="text-neutral-800 text-xs">
                                    {createForm.watch('greeting') || "Olá! Como posso ajudar?"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={createForm.control}
                    name="greeting"
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
                
                <TabsContent value="conversation" className="space-y-4 pt-4">
                  <div className="space-y-4">
                    <h3 className="font-medium mb-2">{t("Controle de Conversa")}</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {t("Configure como o assistente se comporta durante a conversa com o usuário.")}
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={createForm.control}
                        name="allow_human_help"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>
                                {t("Permitir ajuda humana")}
                              </FormLabel>
                              <FormDescription>
                                {t("Permite que o usuário solicite falar com um atendente humano.")}
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={createForm.control}
                        name="use_emojis"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>
                                {t("Usar emojis")}
                              </FormLabel>
                              <FormDescription>
                                {t("Permite que o assistente use emojis nas respostas.")}
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={createForm.control}
                        name="restrict_topics"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>
                                {t("Restringir tópicos")}
                              </FormLabel>
                              <FormDescription>
                                {t("Limita as conversas apenas a tópicos relacionados ao seu negócio.")}
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={createForm.control}
                        name="split_responses"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>
                                {t("Dividir respostas longas")}
                              </FormLabel>
                              <FormDescription>
                                {t("Divide respostas longas em partes menores para melhor legibilidade.")}
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={createForm.control}
                        name="allow_reminders"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>
                                {t("Permitir lembretes")}
                              </FormLabel>
                              <FormDescription>
                                {t("Permite que o assistente crie lembretes para os usuários.")}
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="operational" className="space-y-4 pt-4">
                  <div className="space-y-4">
                    <h3 className="font-medium mb-2">{t("Configurações Operacionais")}</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {t("Configure como o widget opera em termos de tempo de resposta, fusos horários e limites de interação.")}
                    </p>
                    
                    <FormField
                      control={createForm.control}
                      name="response_time"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("Tempo de resposta")}</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t("Selecione um tempo de resposta")} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="immediate">{t("Imediato")}</SelectItem>
                              <SelectItem value="slow">{t("Lento (simula digitação)")}</SelectItem>
                              <SelectItem value="variable">{t("Variável (baseado no tamanho da resposta)")}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            {t("Define como as respostas são mostradas em termos de tempo.")}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={createForm.control}
                      name="agent_timezone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("Fuso horário")}</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t("Selecione um fuso horário")} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="America/Sao_Paulo">{t("Brasília (GMT-3)")}</SelectItem>
                              <SelectItem value="America/Manaus">{t("Manaus (GMT-4)")}</SelectItem>
                              <SelectItem value="America/New_York">{t("Nova York (GMT-5/GMT-4)")}</SelectItem>
                              <SelectItem value="Europe/Lisbon">{t("Lisboa (GMT+0/GMT+1)")}</SelectItem>
                              <SelectItem value="Europe/London">{t("Londres (GMT+0/GMT+1)")}</SelectItem>
                              <SelectItem value="UTC">{t("UTC (GMT+0)")}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            {t("Define o fuso horário usado pelo agente ao mencionar horários.")}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={createForm.control}
                      name="max_interactions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("Limite de interações por chat")}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            {t("Número máximo de trocas de mensagens em uma única sessão.")}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={createForm.control}
                      name="interaction_limit_action"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("Ação quando limite atingido")}</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t("Selecione uma ação")} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="block_5m">{t("Bloquear por 5 minutos")}</SelectItem>
                              <SelectItem value="block_1h">{t("Bloquear por 1 hora")}</SelectItem>
                              <SelectItem value="block_24h">{t("Bloquear por 24 horas")}</SelectItem>
                              <SelectItem value="ask_email">{t("Solicitar email")}</SelectItem>
                              <SelectItem value="restart">{t("Reiniciar conversa")}</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            {t("O que acontece quando o usuário atinge o limite de interações.")}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="advanced" className="space-y-4 pt-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={createForm.control}
                        name="hide_minimize_button"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>
                                {t("Ocultar botão de minimizar")}
                              </FormLabel>
                              <FormDescription>
                                {t("Oculta o botão de minimizar no widget de chat.")}
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={createForm.control}
                        name="hide_close_button"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>
                                {t("Ocultar botão de fechar")}
                              </FormLabel>
                              <FormDescription>
                                {t("Oculta o botão de fechar no widget de chat.")}
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="space-y-4 mt-6">
                      <h3 className="font-medium">{t("Estilo do Widget")}</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={createForm.control}
                          name="background_color"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("Cor de fundo")}</FormLabel>
                              <div className="flex items-center space-x-2">
                                <div 
                                  className="w-10 h-10 border rounded color-preview"
                                  style={{ backgroundColor: field.value || "#FFFFFF" }}
                                  onClick={() => {
                                    const colorInput = document.getElementById('create-background-color-input');
                                    if (colorInput) {
                                      (colorInput as HTMLInputElement).click();
                                    }
                                  }}
                                />
                                <FormControl>
                                  <div className="color-input-container">
                                    <input 
                                      id="create-background-color-input"
                                      type="color" 
                                      value={field.value || "#FFFFFF"}
                                      onChange={(e) => field.onChange(e.target.value)} 
                                      className="hidden"
                                    />
                                    <Input {...field} className="flex-1" />
                                  </div>
                                </FormControl>
                              </div>
                              <FormDescription>
                                {t("Cor de fundo da janela do chat")}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={createForm.control}
                          name="font_size"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("Tamanho da fonte")}</FormLabel>
                              <FormControl>
                                <select
                                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                  value={field.value}
                                  onChange={(e) => field.onChange(e.target.value)}
                                >
                                  <option value="12px">12px - {t("Pequeno")}</option>
                                  <option value="14px">14px - {t("Médio")}</option>
                                  <option value="16px">16px - {t("Grande")}</option>
                                  <option value="18px">18px - {t("Muito grande")}</option>
                                </select>
                              </FormControl>
                              <FormDescription>
                                {t("Tamanho da fonte dos textos no chat")}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={createForm.control}
                          name="font_color"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("Cor da fonte")}</FormLabel>
                              <div className="flex items-center space-x-2">
                                <div 
                                  className="w-10 h-10 border rounded color-preview"
                                  style={{ backgroundColor: field.value || "#000000" }}
                                  onClick={() => {
                                    const colorInput = document.getElementById('create-font-color-input');
                                    if (colorInput) {
                                      (colorInput as HTMLInputElement).click();
                                    }
                                  }}
                                />
                                <FormControl>
                                  <div className="color-input-container">
                                    <input 
                                      id="create-font-color-input"
                                      type="color" 
                                      value={field.value || "#000000"}
                                      onChange={(e) => field.onChange(e.target.value)} 
                                      className="hidden"
                                    />
                                    <Input {...field} className="flex-1" />
                                  </div>
                                </FormControl>
                              </div>
                              <FormDescription>
                                {t("Cor da fonte dos textos no chat")}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={createForm.control}
                          name="bot_message_bg_color"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("Cor de fundo das mensagens do bot")}</FormLabel>
                              <div className="flex items-center space-x-2">
                                <div 
                                  className="w-10 h-10 border rounded color-preview"
                                  style={{ backgroundColor: field.value || "#F3F4F6" }}
                                  onClick={() => {
                                    const colorInput = document.getElementById('create-bot-bg-color-input');
                                    if (colorInput) {
                                      (colorInput as HTMLInputElement).click();
                                    }
                                  }}
                                />
                                <FormControl>
                                  <div className="color-input-container">
                                    <input 
                                      id="create-bot-bg-color-input"
                                      type="color" 
                                      value={field.value || "#F3F4F6"}
                                      onChange={(e) => field.onChange(e.target.value)} 
                                      className="hidden"
                                    />
                                    <Input {...field} className="flex-1" />
                                  </div>
                                </FormControl>
                              </div>
                              <FormDescription>
                                {t("Cor de fundo das bolhas de mensagens enviadas pelo bot")}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={createForm.control}
                          name="user_message_bg_color"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("Cor de fundo das mensagens do usuário")}</FormLabel>
                              <div className="flex items-center space-x-2">
                                <div 
                                  className="w-10 h-10 border rounded color-preview"
                                  style={{ backgroundColor: field.value || "#6366F1" }}
                                  onClick={() => {
                                    const colorInput = document.getElementById('create-user-bg-color-input');
                                    if (colorInput) {
                                      (colorInput as HTMLInputElement).click();
                                    }
                                  }}
                                />
                                <FormControl>
                                  <div className="color-input-container">
                                    <input 
                                      id="create-user-bg-color-input"
                                      type="color" 
                                      value={field.value || "#6366F1"}
                                      onChange={(e) => field.onChange(e.target.value)} 
                                      className="hidden"
                                    />
                                    <Input {...field} className="flex-1" />
                                  </div>
                                </FormControl>
                              </div>
                              <FormDescription>
                                {t("Cor de fundo das bolhas de mensagens enviadas pelo usuário")}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={createForm.control}
                        name="default_height"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("Altura padrão (px)")}</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="500"
                                {...field}
                                onChange={(e) => field.onChange(e.target.value === "" ? undefined : e.target.value)}
                              />
                            </FormControl>
                            <FormDescription>
                              {t("Altura padrão do widget em pixels. Padrão: 500px.")}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={createForm.control}
                        name="default_width"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("Largura padrão (px)")}</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="350"
                                {...field}
                                onChange={(e) => field.onChange(e.target.value === "" ? undefined : e.target.value)}
                              />
                            </FormControl>
                            <FormDescription>
                              {t("Largura padrão do widget em pixels. Padrão: 350px.")}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={createForm.control}
                      name="custom_css"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("CSS personalizado")}</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder={`.embedded-chat-container { box-shadow: 0 4px 20px rgba(0,0,0,0.1); }`}
                              className="font-mono text-sm h-32"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            {t("CSS personalizado para estilizar o widget. Use com cuidado.")}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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
        <DialogContent className="widgets-dialog">
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
                  <TabsList className="grid w-full grid-cols-6">
                    <TabsTrigger value="general">{t("Geral")}</TabsTrigger>
                    <TabsTrigger value="security">{t("Segurança")}</TabsTrigger>
                    <TabsTrigger value="conversation">{t("Conversa")}</TabsTrigger>
                    <TabsTrigger value="operational">{t("Operacional")}</TabsTrigger>
                    <TabsTrigger value="embed">{t("Integração")}</TabsTrigger>
                    <TabsTrigger value="advanced">{t("Avançado")}</TabsTrigger>
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
                      name="avatar_url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("Avatar do Chat")}</FormLabel>
                          
                          <div className="flex flex-col md:flex-row gap-8 mb-4">
                            <div className="md:w-1/3">
                              <div className="bg-white border border-dashed border-neutral-300 rounded-lg p-4 text-center shadow-sm">
                                <div className="mb-3">
                                  {editPreviewImage ? (
                                    <img
                                      src={editPreviewImage}
                                      alt="Avatar Preview"
                                      className="w-24 h-24 rounded-full mx-auto object-cover border-4 border-primary-100 shadow-md"
                                    />
                                  ) : selectedWidget?.avatar_url ? (
                                    <img
                                      src={selectedWidget.avatar_url}
                                      alt="Avatar Preview"
                                      className="w-24 h-24 rounded-full mx-auto object-cover border-4 border-primary-100 shadow-md"
                                    />
                                  ) : (
                                    <div className="w-24 h-24 rounded-full bg-gradient-to-r from-primary-100 to-accent-100 mx-auto flex items-center justify-center text-primary-600 shadow-md">
                                      <span className="text-2xl font-bold">T</span>
                                    </div>
                                  )}
                                </div>
                                
                                <input
                                  type="file"
                                  ref={editFileInputRef}
                                  onChange={(e) => handleImageChange(e, true)}
                                  accept=".jpg,.jpeg,.png"
                                  className="hidden"
                                  aria-label="Upload avatar image"
                                />
                                
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => editFileInputRef.current?.click()}
                                  className="px-3 py-1 text-sm bg-primary-100 text-primary-700 rounded-md hover:bg-primary-200 transition-colors duration-200 inline-block"
                                >
                                  <Upload className="h-3.5 w-3.5 mr-1" />
                                  {t("Carregar Imagem")}
                                </Button>
                                
                                <p className="mt-2 text-xs text-neutral-500">
                                  {t("A imagem deve ter no máximo 5MB e estar nos formatos JPG ou PNG")}
                                </p>
                              </div>
                            </div>
                            
                            <div className="md:w-2/3">
                              <FormControl>
                                <Input 
                                  placeholder="https://ui-avatars.com/api/?name=T&background=6366F1&color=fff" 
                                  {...field} 
                                  value={field.value || ""}
                                />
                              </FormControl>
                              <FormDescription className="mt-2">
                                {t("URL da imagem que será exibida como avatar do chat. Caso prefira, carregue uma imagem usando o botão ao lado.")}
                              </FormDescription>
                              <FormMessage />
                              
                              <div className="mt-4 bg-gradient-to-r from-neutral-50 to-white p-4 border rounded-md">
                                <div className="flex items-start">
                                  <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 mr-3 shadow-sm">
                                    {editPreviewImage ? (
                                      <img
                                        src={editPreviewImage}
                                        alt="Avatar Preview"
                                        className="h-10 w-10 rounded-full object-cover"
                                      />
                                    ) : selectedWidget?.avatar_url ? (
                                      <img
                                        src={selectedWidget.avatar_url}
                                        alt="Avatar Preview"
                                        className="h-10 w-10 rounded-full object-cover"
                                      />
                                    ) : (
                                      <span className="text-sm font-bold">T</span>
                                    )}
                                  </div>
                                  <div className="relative bg-white rounded-lg rounded-tl-none py-2 px-3 max-w-[80%] shadow-sm border border-neutral-200">
                                    <div className="text-xs font-semibold mb-1 text-neutral-700">
                                      {editForm.watch('name') || selectedWidget?.name || "Widget de Chat"}
                                    </div>
                                    <p className="text-neutral-800 text-xs">
                                      {editForm.watch('greeting') || selectedWidget?.greeting || "Olá! Como posso ajudar?"}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={editForm.control}
                      name="greeting"
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
                  
                  <TabsContent value="conversation" className="space-y-4 pt-4">
                    <div className="space-y-4">
                      <h3 className="font-medium mb-2">{t("Controle de Conversa")}</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {t("Configure como o assistente se comporta durante a conversa com o usuário.")}
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={editForm.control}
                          name="allow_human_help"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>
                                  {t("Permitir ajuda humana")}
                                </FormLabel>
                                <FormDescription>
                                  {t("Permite que o usuário solicite falar com um atendente humano.")}
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={editForm.control}
                          name="use_emojis"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>
                                  {t("Usar emojis")}
                                </FormLabel>
                                <FormDescription>
                                  {t("Permite que o assistente use emojis nas respostas.")}
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={editForm.control}
                          name="restrict_topics"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>
                                  {t("Restringir tópicos")}
                                </FormLabel>
                                <FormDescription>
                                  {t("Limita as conversas apenas a tópicos relacionados ao seu negócio.")}
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={editForm.control}
                          name="split_responses"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>
                                  {t("Dividir respostas longas")}
                                </FormLabel>
                                <FormDescription>
                                  {t("Divide respostas longas em partes menores para melhor legibilidade.")}
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={editForm.control}
                          name="allow_reminders"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>
                                  {t("Permitir lembretes")}
                                </FormLabel>
                                <FormDescription>
                                  {t("Permite que o assistente crie lembretes para os usuários.")}
                                </FormDescription>
                              </div>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="operational" className="space-y-4 pt-4">
                    <div className="space-y-4">
                      <h3 className="font-medium mb-2">{t("Configurações Operacionais")}</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {t("Configure como o widget opera em termos de tempo de resposta, fusos horários e limites de interação.")}
                      </p>
                      
                      <FormField
                        control={editForm.control}
                        name="response_time"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("Tempo de resposta")}</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder={t("Selecione um tempo de resposta")} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="immediate">{t("Imediato")}</SelectItem>
                                <SelectItem value="slow">{t("Lento (simula digitação)")}</SelectItem>
                                <SelectItem value="variable">{t("Variável (baseado no tamanho da resposta)")}</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              {t("Define como as respostas são mostradas em termos de tempo.")}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={editForm.control}
                        name="agent_timezone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("Fuso horário")}</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder={t("Selecione um fuso horário")} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="America/Sao_Paulo">{t("Brasília (GMT-3)")}</SelectItem>
                                <SelectItem value="America/Manaus">{t("Manaus (GMT-4)")}</SelectItem>
                                <SelectItem value="America/New_York">{t("Nova York (GMT-5/GMT-4)")}</SelectItem>
                                <SelectItem value="Europe/Lisbon">{t("Lisboa (GMT+0/GMT+1)")}</SelectItem>
                                <SelectItem value="Europe/London">{t("Londres (GMT+0/GMT+1)")}</SelectItem>
                                <SelectItem value="UTC">{t("UTC (GMT+0)")}</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              {t("Define o fuso horário usado pelo agente ao mencionar horários.")}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={editForm.control}
                        name="max_interactions"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("Limite de interações por chat")}</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                {...field}
                                onChange={(e) => field.onChange(Number(e.target.value))}
                              />
                            </FormControl>
                            <FormDescription>
                              {t("Número máximo de trocas de mensagens em uma única sessão.")}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={editForm.control}
                        name="interaction_limit_action"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("Ação quando limite atingido")}</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder={t("Selecione uma ação")} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="block_5m">{t("Bloquear por 5 minutos")}</SelectItem>
                                <SelectItem value="block_1h">{t("Bloquear por 1 hora")}</SelectItem>
                                <SelectItem value="block_24h">{t("Bloquear por 24 horas")}</SelectItem>
                                <SelectItem value="ask_email">{t("Solicitar email")}</SelectItem>
                                <SelectItem value="restart">{t("Reiniciar conversa")}</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              {t("O que acontece quando o usuário atinge o limite de interações.")}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="embed" className="space-y-4 pt-4">
                    {selectedWidget && (
                      <div className="space-y-6">
                      
                        <div>
                          <h3 className="font-medium mb-2">{t("Código de incorporação")}</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            {t("Adicione este código ao seu site para incorporar o widget de chat.")}
                          </p>
                          
                          <div className="relative">
                            <Textarea 
                              value={getFullEmbedCode(selectedWidget).scriptCode}
                              readOnly
                              rows={4}
                              className="font-mono text-sm"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="absolute top-2 right-2"
                              onClick={() => copyToClipboard(
                                getFullEmbedCode(selectedWidget).scriptCode, 
                                t("Código de incorporação copiado")
                              )}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="border-t pt-6">
                          <h3 className="font-medium mb-2">{t("Link direto para incorporação")}</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            {t("Use este link para incorporar o widget via iframe em plataformas de terceiros.")}
                          </p>
                          
                          <div className="flex items-center gap-2">
                            <Input
                              value={`${window.location.origin}/embed?url=${encodeURIComponent(`${window.location.origin}/embed/widget?key=${selectedWidget.api_key}`)}`}
                              readOnly
                              className="font-mono text-sm flex-1"
                            />
                            <Button
                              size="sm"
                              onClick={() => copyToClipboard(
                                `${window.location.origin}/embed?url=${encodeURIComponent(`${window.location.origin}/embed/widget?key=${selectedWidget.api_key}`)}`,
                                t("Link de incorporação copiado")
                              )}
                            >
                              <Link className="h-4 w-4 mr-1" />
                              {t("Copiar Link")}
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            {t("Este link permite fácil incorporação em qualquer plataforma que suporte iframe via URL.")}
                          </p>
                        </div>
                        
                        <div className="border-t pt-6">
                          <h3 className="font-medium mb-2">{t("Iframe HTML")}</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            {t("Código HTML para incorporar o widget diretamente como iframe.")}
                          </p>
                          
                          <div className="relative">
                            <Textarea 
                              value={`<iframe 
  src="${window.location.origin}/embed/widget?key=${selectedWidget.api_key}" 
  width="${selectedWidget.default_width || '350'}" 
  height="${selectedWidget.default_height || '600'}" 
  frameborder="0" 
  allow="microphone"
  style="border: none; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);"
></iframe>`}
                              readOnly
                              rows={6}
                              className="font-mono text-sm"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="absolute top-2 right-2"
                              onClick={() => copyToClipboard(
                                `<iframe 
  src="${window.location.origin}/embed/widget?key=${selectedWidget.api_key}" 
  width="${selectedWidget.default_width || '350'}" 
  height="${selectedWidget.default_height || '600'}" 
  frameborder="0" 
  allow="microphone"
  style="border: none; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);"
></iframe>`, 
                                t("Código HTML copiado")
                              )}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="border-t pt-6">
                          <h3 className="font-medium mb-2">{t("Instruções")}</h3>
                          <ol className="list-decimal list-inside space-y-2 text-sm">
                            <li>{t("Escolha um dos métodos de incorporação acima.")}</li>
                            <li>{t("Para usar o código JavaScript, cole-o no HTML do seu site, antes do fechamento da tag body.")}</li>
                            <li>{t("Para usar o iframe, cole o código HTML em qualquer lugar da sua página.")}</li>
                            <li>{t("Para usar o link direto, use-o em um campo que aceite incorporação de URLs em plataformas de terceiros.")}</li>
                          </ol>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="advanced" className="space-y-4 pt-4">
                    {selectedWidget && (
                      <div className="space-y-6">
                        <div>
                          <h3 className="font-medium mb-2">{t("Controle de botões")}</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            {t("Personalize a visibilidade dos botões de controle do widget.")}
                          </p>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <FormField
                              control={editForm.control}
                              name="hide_minimize_button"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel>
                                      {t("Ocultar botão de minimizar")}
                                    </FormLabel>
                                    <FormDescription>
                                      {t("Oculta o botão de minimizar no widget de chat.")}
                                    </FormDescription>
                                  </div>
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={editForm.control}
                              name="hide_close_button"
                              render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={field.onChange}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel>
                                      {t("Ocultar botão de fechar")}
                                    </FormLabel>
                                    <FormDescription>
                                      {t("Oculta o botão de fechar no widget de chat.")}
                                    </FormDescription>
                                  </div>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                        
                        <div className="border-t pt-4">
                          <h3 className="font-medium mb-2">{t("Dimensões do widget")}</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            {t("Defina o tamanho padrão do widget quando incorporado.")}
                          </p>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={editForm.control}
                              name="default_width"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t("Largura padrão (px)")}</FormLabel>
                                  <FormControl>
                                    <Input {...field} type="number" min="200" />
                                  </FormControl>
                                  <FormDescription>
                                    {t("Largura em pixels do widget quando incorporado.")}
                                  </FormDescription>
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={editForm.control}
                              name="default_height"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t("Altura padrão (px)")}</FormLabel>
                                  <FormControl>
                                    <Input {...field} type="number" min="300" />
                                  </FormControl>
                                  <FormDescription>
                                    {t("Altura em pixels do widget quando incorporado.")}
                                  </FormDescription>
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                        
                        <div className="border-t pt-4 form-section">
                          <h3 className="font-medium mb-2">{t("Estilo do widget")}</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            {t("Personalize a aparência visual do widget.")}
                          </p>
                          
                          <div className="style-grid">
                            <FormField
                              control={editForm.control}
                              name="background_color"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t("Cor de fundo")}</FormLabel>
                                  <div className="flex items-center space-x-2">
                                    <div 
                                      className="w-10 h-10 border rounded color-preview"
                                      style={{ backgroundColor: field.value || "#FFFFFF" }}
                                      onClick={() => {
                                        const colorInput = document.getElementById('edit-background-color-input');
                                        if (colorInput) {
                                          (colorInput as HTMLInputElement).click();
                                        }
                                      }}
                                    />
                                    <FormControl>
                                      <div className="color-input-container">
                                        <input 
                                          id="edit-background-color-input"
                                          type="color" 
                                          value={field.value || "#FFFFFF"}
                                          onChange={(e) => field.onChange(e.target.value)} 
                                          className="hidden"
                                        />
                                        <Input {...field} className="flex-1" />
                                      </div>
                                    </FormControl>
                                  </div>
                                  <FormDescription>
                                    {t("Cor de fundo da janela do chat")}
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={editForm.control}
                              name="font_size"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t("Tamanho da fonte")}</FormLabel>
                                  <FormControl>
                                    <select
                                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                      value={field.value}
                                      onChange={(e) => field.onChange(e.target.value)}
                                    >
                                      <option value="12px">12px - {t("Pequeno")}</option>
                                      <option value="14px">14px - {t("Médio")}</option>
                                      <option value="16px">16px - {t("Grande")}</option>
                                      <option value="18px">18px - {t("Muito grande")}</option>
                                    </select>
                                  </FormControl>
                                  <FormDescription>
                                    {t("Tamanho da fonte dos textos no chat")}
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={editForm.control}
                              name="font_color"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t("Cor da fonte")}</FormLabel>
                                  <div className="flex items-center space-x-2">
                                    <div 
                                      className="w-10 h-10 border rounded color-preview"
                                      style={{ backgroundColor: field.value || "#000000" }}
                                      onClick={() => {
                                        const colorInput = document.getElementById('edit-font-color-input');
                                        if (colorInput) {
                                          (colorInput as HTMLInputElement).click();
                                        }
                                      }}
                                    />
                                    <FormControl>
                                      <div className="color-input-container">
                                        <input 
                                          id="edit-font-color-input"
                                          type="color" 
                                          value={field.value || "#000000"}
                                          onChange={(e) => field.onChange(e.target.value)} 
                                          className="hidden"
                                        />
                                        <Input {...field} className="flex-1" />
                                      </div>
                                    </FormControl>
                                  </div>
                                  <FormDescription>
                                    {t("Cor da fonte dos textos no chat")}
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={editForm.control}
                              name="bot_message_bg_color"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t("Cor de fundo das mensagens do bot")}</FormLabel>
                                  <div className="flex items-center space-x-2">
                                    <div 
                                      className="w-10 h-10 border rounded color-preview"
                                      style={{ backgroundColor: field.value || "#F3F4F6" }}
                                      onClick={() => {
                                        const colorInput = document.getElementById('edit-bot-bg-color-input');
                                        if (colorInput) {
                                          (colorInput as HTMLInputElement).click();
                                        }
                                      }}
                                    />
                                    <FormControl>
                                      <div className="color-input-container">
                                        <input 
                                          id="edit-bot-bg-color-input"
                                          type="color" 
                                          value={field.value || "#F3F4F6"}
                                          onChange={(e) => field.onChange(e.target.value)} 
                                          className="hidden"
                                        />
                                        <Input {...field} className="flex-1" />
                                      </div>
                                    </FormControl>
                                  </div>
                                  <FormDescription>
                                    {t("Cor de fundo das bolhas de mensagens enviadas pelo bot")}
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={editForm.control}
                              name="user_message_bg_color"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t("Cor de fundo das mensagens do usuário")}</FormLabel>
                                  <div className="flex items-center space-x-2">
                                    <div 
                                      className="w-10 h-10 border rounded color-preview"
                                      style={{ backgroundColor: field.value || "#6366F1" }}
                                      onClick={() => {
                                        const colorInput = document.getElementById('edit-user-bg-color-input');
                                        if (colorInput) {
                                          (colorInput as HTMLInputElement).click();
                                        }
                                      }}
                                    />
                                    <FormControl>
                                      <div className="color-input-container">
                                        <input 
                                          id="edit-user-bg-color-input"
                                          type="color" 
                                          value={field.value || "#6366F1"}
                                          onChange={(e) => field.onChange(e.target.value)} 
                                          className="hidden"
                                        />
                                        <Input {...field} className="flex-1" />
                                      </div>
                                    </FormControl>
                                  </div>
                                  <FormDescription>
                                    {t("Cor de fundo das bolhas de mensagens enviadas pelo usuário")}
                                  </FormDescription>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>
                        
                        <div className="border-t pt-4 form-section">
                          <h3 className="font-medium mb-2">{t("CSS personalizado")}</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            {t("Adicione estilos CSS personalizados para modificar a aparência do widget.")}
                          </p>
                          
                          <FormField
                            control={editForm.control}
                            name="custom_css"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Textarea 
                                    {...field} 
                                    className="font-mono text-sm h-[150px]" 
                                    placeholder={`.embedded-chat-container {
  /* Seus estilos personalizados aqui */
  border-radius: 12px;
}`}
                                  />
                                </FormControl>
                                <FormDescription>
                                  {t("Use CSS válido. As alterações serão aplicadas diretamente ao widget.")}
                                </FormDescription>
                              </FormItem>
                            )}
                          />
                        </div>
                          
                        <div className="border-t pt-4 form-section">
                          <h3 className="font-medium mb-2">{t("Configurações de iframe")}</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            {t("Personalize como o widget é exibido quando incorporado via iframe.")}                            
                          </p>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div className="border p-4 rounded-md">
                              <div className="flex items-center justify-between mb-4">
                                <div>
                                  <h4 className="font-medium">{t("Ocultar botão de minimizar")}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    {t("Útil para iframes que devem exibir o chat em tela cheia")}
                                  </p>
                                </div>
                                <Switch
                                  checked={editForm.watch("hide_minimize_button") || false}
                                  onCheckedChange={(checked) => {
                                    // Atualizar o valor no formulário diretamente
                                    editForm.setValue("hide_minimize_button", checked);
                                    // Não é necessário atualizar o selectedWidget manualmente
                                    // pois o React Query recarregará os dados quando necessário
                                  }}
                                />
                              </div>
                            </div>

                            <div className="border p-4 rounded-md">
                              <div className="flex items-center justify-between mb-4">
                                <div>
                                  <h4 className="font-medium">{t("Ocultar botão de fechar")}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    {t("Útil para iframes que não devem permitir que o usuário feche o chat")}
                                  </p>
                                </div>
                                <Switch
                                  checked={editForm.watch("hide_close_button") || false}
                                  onCheckedChange={(checked) => {
                                    // Atualizar o valor no formulário diretamente
                                    editForm.setValue("hide_close_button", checked);
                                    // Não é necessário atualizar o selectedWidget manualmente
                                    // pois o React Query recarregará os dados quando necessário
                                  }}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div>
                              <h4 className="font-medium mb-2">{t("Altura padrão")}</h4>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  placeholder="600"
                                  value={editForm.watch("default_height") || "600"}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    // Atualizar o valor no formulário
                                    editForm.setValue("default_height", value);
                                  }}
                                  className="max-w-[150px]"
                                />
                                <span className="text-sm text-muted-foreground">px</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {t("Altura do iframe em pixels")}
                              </p>
                            </div>

                            <div>
                              <h4 className="font-medium mb-2">{t("Largura padrão")}</h4>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  placeholder="350"
                                  value={editForm.watch("default_width") || "350"}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    // Atualizar o valor no formulário
                                    editForm.setValue("default_width", value);
                                  }}
                                  className="max-w-[150px]"
                                />
                                <span className="text-sm text-muted-foreground">px</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {t("Largura do iframe em pixels")}
                              </p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div>
                              <h4 className="font-medium mb-2">{t("Cor de fundo")}</h4>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="color"
                                  value={editForm.watch("background_color") || "#FFFFFF"}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    editForm.setValue("background_color", value);
                                  }}
                                  className="w-10 h-10 p-1 cursor-pointer"
                                />
                                <Input
                                  type="text"
                                  placeholder="#FFFFFF"
                                  value={editForm.watch("background_color") || "#FFFFFF"}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    editForm.setValue("background_color", value);
                                  }}
                                  className="max-w-[150px]"
                                />
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {t("Cor de fundo do widget")}
                              </p>
                            </div>

                            <div>
                              <h4 className="font-medium mb-2">{t("Tamanho da fonte")}</h4>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  placeholder="14"
                                  value={
                                    editForm.watch("font_size")
                                      ? parseInt(editForm.watch("font_size").replace("px", ""))
                                      : "14"
                                  }
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    editForm.setValue("font_size", `${value}px`);
                                  }}
                                  className="max-w-[150px]"
                                />
                                <span className="text-sm text-muted-foreground">px</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {t("Tamanho da fonte em pixels")}
                              </p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div>
                              <h4 className="font-medium mb-2">{t("Cor da fonte")}</h4>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="color"
                                  value={editForm.watch("font_color") || "#000000"}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    editForm.setValue("font_color", value);
                                  }}
                                  className="w-10 h-10 p-1 cursor-pointer"
                                />
                                <Input
                                  type="text"
                                  placeholder="#000000"
                                  value={editForm.watch("font_color") || "#000000"}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    editForm.setValue("font_color", value);
                                  }}
                                  className="max-w-[150px]"
                                />
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {t("Cor da fonte dos textos no chat")}
                              </p>
                            </div>
                          </div>

                          <div className="mb-4">
                            <h4 className="font-medium mb-2">{t("CSS personalizado")}</h4>
                            <Textarea
                              placeholder=".widget-header { background-color: #f8f8f8; }"
                              value={editForm.watch("custom_css") || ""}
                              onChange={(e) => {
                                const value = e.target.value;
                                // Atualizar o valor no formulário
                                editForm.setValue("custom_css", value);
                              }}
                              rows={4}
                              className="font-mono text-sm"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              {t("CSS adicional para personalizar a aparência do widget quando incorporado")}
                            </p>
                          </div>
                        </div>

                        <div className="border-t pt-6 form-section">
                          <h3 className="font-medium mb-2">{t("Preview do iframe")}</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            {t("Visualize como o widget será exibido quando incorporado como iframe.")}
                          </p>
                          
                          <div className="relative border border-dashed rounded-lg p-4 flex justify-center bg-muted/20">
                            <div 
                              className="overflow-hidden bg-white rounded-lg shadow-md" 
                              style={{
                                width: `${editForm.watch("default_width") || 350}px`,
                                height: `${editForm.watch("default_height") || 600}px`,
                              }}
                            >
                              <div className="bg-primary/10 text-primary p-4 text-center border-b">
                                <p>{t("Preview do widget")} - {editForm.watch("name") || selectedWidget.name}</p>
                              </div>
                              <div className="flex items-center justify-center h-full">
                                <p className="text-muted-foreground text-sm text-center p-4">
                                  {t("Aqui será exibido seu widget de chat quando incorporado")}
                                </p>
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-center text-muted-foreground mt-2">
                            {t("Esta visualização é apenas para fins ilustrativos. O widget real pode variar dependendo do conteúdo e outros fatores.")}
                          </p>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
                
                <DialogFooter className="dialog-footer">
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

