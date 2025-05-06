import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle,
  ChevronDown,
  Clock,
  Database,
  Filter,
  RefreshCcw,
  Search,
  Server,
  User,
  Webhook,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface LlmUsageLog {
  id: number;
  model_name: string;
  provider: string;
  operation_type: "text" | "image" | "audio" | "file" | "test";
  success: boolean;
  token_count: number | null;
  user_id: number | null;
  created_at: string;
  widget_id: string | null; // Alterado para string (UUID)
  error_message: string | null;
}

type FilterOptions = {
  provider?: string;
  startDate?: string;
  endDate?: string;
  userId?: string;
  widgetId?: string;
  success?: string;
};

export default function LlmUsageLogs() {
  const { toast } = useToast();
  const { language, t } = useLanguage();
  const locale = language === "pt" ? ptBR : enUS;

  const [filters, setFilters] = useState<FilterOptions>({
    provider: "all",
    success: "all",
  });

  // Construct query string based on filters
  const getQueryString = () => {
    const queryParams = new URLSearchParams();

    if (filters.provider && filters.provider !== "all") {
      queryParams.append("provider", filters.provider);
    }

    if (filters.startDate) {
      queryParams.append("startDate", filters.startDate);
    }

    if (filters.endDate) {
      queryParams.append("endDate", filters.endDate);
    }

    if (filters.userId) {
      queryParams.append("userId", filters.userId);
    }

    if (filters.widgetId) {
      queryParams.append("widgetId", filters.widgetId);
    }

    if (filters.success && filters.success !== "all") {
      queryParams.append("success", filters.success === "success" ? "true" : "false");
    }

    return queryParams.toString();
  };

  const {
    data: logs,
    isLoading,
    isError,
    refetch,
  } = useQuery<LlmUsageLog[]>({
    queryKey: ["/api/admin/llm/usage-logs", filters],
    queryFn: async () => {
      const queryString = getQueryString();
      const response = await fetch(`/api/admin/llm/usage-logs${queryString ? `?${queryString}` : ""}`);
      
      if (!response.ok) {
        throw new Error(`Error fetching logs: ${response.statusText}`);
      }
      
      return response.json();
    },
  });

  // Handle filter changes
  const handleFilterChange = (key: keyof FilterOptions, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  // Reset all filters
  const resetFilters = () => {
    setFilters({
      provider: "all",
      success: "all",
      startDate: undefined,
      endDate: undefined,
      userId: undefined,
      widgetId: undefined,
    });
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "PPp", { locale });
    } catch (error) {
      return dateString;
    }
  };

  // Get operation type icon
  const getOperationIcon = (type: string) => {
    switch (type) {
      case "text":
        return <Database className="h-4 w-4 mr-1" />;
      case "image":
        return <Server className="h-4 w-4 mr-1" />;
      case "audio":
        return <Webhook className="h-4 w-4 mr-1" />;
      case "file":
        return <Database className="h-4 w-4 mr-1" />;
      case "test":
        return <RefreshCcw className="h-4 w-4 mr-1" />;
      default:
        return <AlertCircle className="h-4 w-4 mr-1" />;
    }
  };

  // Get provider display name
  const getProviderName = (provider: string) => {
    switch (provider.toLowerCase()) {
      case "openai":
        return "OpenAI";
      case "anthropic":
        return "Anthropic/Claude";
      case "deepseek":
        return "Deepseek";
      case "maritaca":
        return "Maritaca";
      case "meta":
        return "Meta";
      case "alibaba":
        return "Alibaba";
      default:
        return provider;
    }
  };

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-5">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">
            Registros de Uso dos Modelos LLM
          </h2>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 bg-secondary/10 p-4 rounded-md">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium flex items-center gap-1">
              <Filter className="h-4 w-4" /> Provedor
            </label>
            <Select
              value={filters.provider || "all"}
              onValueChange={(value) => handleFilterChange("provider", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos os Provedores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Provedores</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic/Claude</SelectItem>
                <SelectItem value="deepseek">Deepseek</SelectItem>
                <SelectItem value="maritaca">Maritaca</SelectItem>
                <SelectItem value="meta">Meta</SelectItem>
                <SelectItem value="alibaba">Alibaba</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium flex items-center gap-1">
              <Calendar className="h-4 w-4" /> Data Inicial
            </label>
            <Input
              type="date"
              value={filters.startDate || ""}
              onChange={(e) => handleFilterChange("startDate", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium flex items-center gap-1">
              <Calendar className="h-4 w-4" /> Data Final
            </label>
            <Input
              type="date"
              value={filters.endDate || ""}
              onChange={(e) => handleFilterChange("endDate", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium flex items-center gap-1">
              <User className="h-4 w-4" /> ID do Usuário
            </label>
            <Input
              type="number"
              placeholder="Digite o ID do usuário"
              value={filters.userId || ""}
              onChange={(e) => handleFilterChange("userId", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium flex items-center gap-1">
              <Webhook className="h-4 w-4" /> ID do Widget
            </label>
            <Input
              type="text"
              placeholder="Digite o ID do widget"
              value={filters.widgetId || ""}
              onChange={(e) => handleFilterChange("widgetId", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium flex items-center gap-1">
              <CheckCircle className="h-4 w-4" /> Status
            </label>
            <Select
              value={filters.success || "all"}
              onValueChange={(value) => handleFilterChange("success", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos os Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="success">Sucesso</SelectItem>
                <SelectItem value="failed">Falha</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-1 md:col-span-3 lg:col-span-6 flex justify-end">
            <Button variant="outline" onClick={resetFilters}>
              Limpar Filtros
            </Button>
          </div>
        </div>

        {/* Logs Table */}
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : isError ? (
          <div className="bg-destructive/10 text-destructive p-4 rounded-md flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            Erro ao carregar os registros. Por favor, tente novamente.
          </div>
        ) : logs?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Database className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>Nenhum registro encontrado com os filtros aplicados.</p>
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">ID</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Provedor</TableHead>
                  <TableHead>Operação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tokens</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Widget</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs">{log.id}</TableCell>
                    <TableCell className="font-mono text-xs">{log.model_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-normal">
                        {getProviderName(log.provider)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        {getOperationIcon(log.operation_type)}
                        {log.operation_type}
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.success ? (
                        <Badge className="gap-1 bg-green-100 text-green-800 hover:bg-green-200">
                          <CheckCircle className="h-3 w-3" />
                          Sucesso
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Falha
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {log.token_count !== null ? log.token_count : "-"}
                    </TableCell>
                    <TableCell>
                      {log.user_id !== null ? (
                        <Badge variant="outline">{log.user_id}</Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {log.widget_id !== null ? (
                        <Badge variant="outline">{log.widget_id}</Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-xs">
                        <Clock className="h-3 w-3" />
                        {formatDate(log.created_at)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[200px] truncate text-xs text-destructive">
                        {log.error_message || "-"}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </Card>
  );
}
