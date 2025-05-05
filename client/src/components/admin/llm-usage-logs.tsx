import { useState, useEffect } from "react";
import { useLanguage } from "@/hooks/use-language";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, useQuery } from "@/lib/queryClient";
import { formatDate } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { CalendarIcon, CheckCircle, LoaderCircle, XCircle, Filter, Download } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type LlmUsageLog = {
  id: number;
  created_at: string;
  model_name: string;
  provider: string;
  operation_type: string;
  user_id: number | null;
  widget_id: number | null;
  token_count: number | null;
  success: boolean;
  error_message: string | null;
};

type ChartData = {
  name: string;
  count: number;
};

type UsageSummary = {
  totalRequests: number;
  successRate: number;
  totalTokens: number;
  providerCounts: Record<string, number>;
  operationTypeCounts: Record<string, number>;
  modelCounts: Record<string, number>;
};

export function LlmUsageLogs() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [selectedProvider, setSelectedProvider] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [limit, setLimit] = useState<number>(100);

  // Query logs with filters
  const { data: logs, isLoading, refetch } = useQuery<LlmUsageLog[]>({
    queryKey: ["/api/llm/usage-logs", selectedProvider, selectedStatus, startDate, endDate, limit],
    queryFn: async () => {
      let url = "/api/llm/usage-logs?";
      
      if (selectedProvider !== "all") {
        url += `provider=${selectedProvider}&`;
      }
      
      if (selectedStatus !== "all") {
        url += `success=${selectedStatus === "success"}&`;
      }
      
      if (startDate) {
        url += `startDate=${startDate.toISOString()}&`;
      }
      
      if (endDate) {
        url += `endDate=${endDate.toISOString()}&`;
      }
      
      url += `limit=${limit}`;
      
      const res = await apiRequest("GET", url);
      return await res.json();
    },
  });

  // Calculate summary statistics
  const summary: UsageSummary = logs?.reduce((acc: UsageSummary, log) => {
    // Count requests
    acc.totalRequests++;
    
    // Success rate
    if (log.success) acc.successRate++;
    
    // Count tokens
    if (log.token_count) acc.totalTokens += log.token_count;
    
    // Count by provider
    if (!acc.providerCounts[log.provider]) acc.providerCounts[log.provider] = 0;
    acc.providerCounts[log.provider]++;
    
    // Count by operation type
    if (!acc.operationTypeCounts[log.operation_type]) acc.operationTypeCounts[log.operation_type] = 0;
    acc.operationTypeCounts[log.operation_type]++;
    
    // Count by model
    if (!acc.modelCounts[log.model_name]) acc.modelCounts[log.model_name] = 0;
    acc.modelCounts[log.model_name]++;
    
    return acc;
  }, { 
    totalRequests: 0, 
    successRate: 0, 
    totalTokens: 0, 
    providerCounts: {}, 
    operationTypeCounts: {},
    modelCounts: {}
  }) || {
    totalRequests: 0, 
    successRate: 0, 
    totalTokens: 0, 
    providerCounts: {}, 
    operationTypeCounts: {},
    modelCounts: {}
  };
  
  if (summary.totalRequests > 0) {
    summary.successRate = (summary.successRate / summary.totalRequests) * 100;
  }

  // Prepare chart data
  const providerChartData: ChartData[] = Object.entries(summary.providerCounts)
    .map(([name, count]) => ({ name, count }));

  const operationTypeChartData: ChartData[] = Object.entries(summary.operationTypeCounts)
    .map(([name, count]) => ({ name, count }));

  const modelChartData: ChartData[] = Object.entries(summary.modelCounts)
    .map(([name, count]) => ({ name, count }));

  // Export logs as CSV
  const exportCsv = () => {
    if (!logs || logs.length === 0) {
      toast({
        title: "Nenhum dado para exportar",
        description: "Não há registros de uso para exportar.",
        variant: "destructive"
      });
      return;
    }

    // Convert logs to CSV format
    const headers = ["ID", "Data", "Modelo", "Provedor", "Tipo de Operação", "ID do Usuário", "ID do Widget", "Tokens", "Sucesso", "Mensagem de Erro"];
    const csvRows = [
      headers.join(","),
      ...logs.map(log => {
        const values = [
          log.id,
          new Date(log.created_at).toLocaleString(),
          `"${log.model_name}"`,
          log.provider,
          log.operation_type,
          log.user_id || "",
          log.widget_id || "",
          log.token_count || 0,
          log.success ? "Sim" : "Não",
          log.error_message ? `"${log.error_message.replace(/"/g, '""')}"` : ""
        ];
        return values.join(",");
      })
    ];

    // Create and download the CSV file
    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `llm-usage-logs-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Exportação concluída", 
      description: `${logs.length} registros exportados com sucesso.`
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.llmUsageLogs")}</CardTitle>
          <CardDescription>{t("admin.llmUsageLogsSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center py-10">
          <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registros de Uso de LLM</CardTitle>
        <CardDescription>Monitoramento e análise do uso de modelos de linguagem no sistema</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="summary">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="summary">Resumo</TabsTrigger>
            <TabsTrigger value="details">Detalhes</TabsTrigger>
          </TabsList>
          
          <TabsContent value="summary" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="py-4">
                  <CardTitle className="text-sm font-medium">Total de Requisições</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.totalRequests}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="py-4">
                  <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.successRate.toFixed(1)}%</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="py-4">
                  <CardTitle className="text-sm font-medium">Total de Tokens</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.totalTokens.toLocaleString()}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="py-4">
                  <CardTitle className="text-sm font-medium">Provedores</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{Object.keys(summary.providerCounts).length}</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-md">Uso por Provedor</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={providerChartData}>
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="#6366F1">
                          {providerChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index % 2 === 0 ? "#6366F1" : "#4338CA"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-md">Uso por Operação</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={operationTypeChartData}>
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="#10B981">
                          {operationTypeChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index % 2 === 0 ? "#10B981" : "#059669"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-md">Uso por Modelo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={modelChartData}>
                        <XAxis dataKey="name" tick={false} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="#EC4899">
                          {modelChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index % 2 === 0 ? "#EC4899" : "#DB2777"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="details">
            <div className="flex flex-col md:flex-row justify-between mb-4 gap-2">
              <div className="flex flex-col sm:flex-row gap-2 flex-1">
                <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Filtrar por Provedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Provedores</SelectItem>
                    {Object.keys(summary.providerCounts).map(provider => (
                      <SelectItem key={provider} value={provider}>{provider}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Filtrar por Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="success">Sucesso</SelectItem>
                    <SelectItem value="failure">Falha</SelectItem>
                  </SelectContent>
                </Select>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-[180px]">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? (
                        startDate.toLocaleDateString()
                      ) : (
                        "Data Inicial"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full sm:w-[180px]">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? (
                        endDate.toLocaleDateString()
                      ) : (
                        "Data Final"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => refetch()} className="w-full sm:w-auto">
                  <Filter className="mr-2 h-4 w-4" />
                  Filtrar
                </Button>
                
                <Button variant="outline" onClick={exportCsv} className="w-full sm:w-auto">
                  <Download className="mr-2 h-4 w-4" />
                  Exportar CSV
                </Button>
              </div>
            </div>
            
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Data/Hora</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead>Provedor</TableHead>
                    <TableHead>Operação</TableHead>
                    <TableHead>Tokens</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs && logs.length > 0 ? (
                    logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">
                          {formatDate(log.created_at)}
                        </TableCell>
                        <TableCell title={log.model_name}>
                          {log.model_name.length > 25 ? log.model_name.substring(0, 25) + "..." : log.model_name}
                        </TableCell>
                        <TableCell>{log.provider}</TableCell>
                        <TableCell>{log.operation_type}</TableCell>
                        <TableCell>{log.token_count || "N/A"}</TableCell>
                        <TableCell>
                          {log.success ? (
                            <span className="flex items-center text-green-600">
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Sucesso
                            </span>
                          ) : (
                            <span className="flex items-center text-red-600">
                              <XCircle className="h-4 w-4 mr-1" />
                              Falha
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.user_id && <span className="text-xs">User: {log.user_id}</span>}
                          {log.widget_id && <span className="text-xs">Widget: {log.widget_id}</span>}
                          {log.error_message && (
                            <span className="text-xs text-red-500" title={log.error_message}>
                              Erro: {log.error_message.substring(0, 30)}{log.error_message.length > 30 ? "..." : ""}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-4">
                        Nenhum registro de uso encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}