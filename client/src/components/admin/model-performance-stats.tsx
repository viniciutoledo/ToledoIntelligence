import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Info, BarChart4, Clock, Zap, Brain } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type ModelPerformanceData = {
  model: string;
  averageResponseTime: number;
  totalRequests: number;
  successRate: number;
  tokenUsage: number;
  accuracyScore?: number;
  costPerRequest?: number;
};

type TimeframeOption = "day" | "week" | "month" | "year";

export function ModelPerformanceStats() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [performanceData, setPerformanceData] = useState<ModelPerformanceData[]>([]);
  const [timeframe, setTimeframe] = useState<TimeframeOption>("month");
  const [activeTab, setActiveTab] = useState("usage");

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  // Dados simulados para demonstração (serão substituídos pelos dados reais da API)
  const dummyData: ModelPerformanceData[] = [
    {
      model: "GPT-4o",
      averageResponseTime: 3.2,
      totalRequests: 1572,
      successRate: 98.4,
      tokenUsage: 9823450,
      accuracyScore: 92.3,
      costPerRequest: 0.082
    },
    {
      model: "Claude 3",
      averageResponseTime: 3.7,
      totalRequests: 1140,
      successRate: 97.8,
      tokenUsage: 8645320,
      accuracyScore: 90.1,
      costPerRequest: 0.075
    },
    {
      model: "LLaMA-3",
      averageResponseTime: 2.9,
      totalRequests: 756,
      successRate: 95.2,
      tokenUsage: 6540230,
      accuracyScore: 86.5,
      costPerRequest: 0.043
    },
    {
      model: "Qwen",
      averageResponseTime: 3.5,
      totalRequests: 523,
      successRate: 94.7,
      tokenUsage: 4320150,
      accuracyScore: 85.7,
      costPerRequest: 0.039
    },
    {
      model: "Deepseek",
      averageResponseTime: 3.8,
      totalRequests: 345,
      successRate: 93.2,
      tokenUsage: 2910540,
      accuracyScore: 84.3,
      costPerRequest: 0.041
    },
    {
      model: "Maritaca",
      averageResponseTime: 4.1,
      totalRequests: 289,
      successRate: 91.8,
      tokenUsage: 2150320,
      accuracyScore: 82.1,
      costPerRequest: 0.038
    }
  ];

  const fetchPerformanceData = async () => {
    setIsLoading(true);
    try {
      // Em produção, buscar dados reais da API
      // const response = await apiRequest("GET", `/api/admin/stats/model-performance?timeframe=${timeframe}`);
      // const data = await response.json();
      // setPerformanceData(data);
      
      // Usando dados simulados para demonstração
      setPerformanceData(dummyData);
    } catch (error) {
      console.error("Erro ao buscar estatísticas de performance:", error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível obter as estatísticas de performance dos modelos.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformanceData();
  }, [timeframe]);

  const handleRefresh = () => {
    fetchPerformanceData();
  };

  const handleTimeframeChange = (value: string) => {
    setTimeframe(value as TimeframeOption);
  };

  // Preparar dados para o gráfico de uso (requisições)
  const usageChartData = performanceData.map(item => ({
    name: item.model,
    Requisições: item.totalRequests,
  }));

  // Preparar dados para o gráfico de tempo de resposta
  const responseTimeChartData = performanceData.map(item => ({
    name: item.model,
    "Tempo Médio (s)": item.averageResponseTime,
  }));

  // Preparar dados para o gráfico de taxa de sucesso
  const successRateChartData = performanceData.map(item => ({
    name: item.model,
    "Taxa de Sucesso (%)": item.successRate,
  }));

  // Preparar dados para o gráfico de precisão
  const accuracyChartData = performanceData.map(item => ({
    name: item.model,
    "Precisão (%)": item.accuracyScore || 0,
  }));

  // Preparar dados para o gráfico de distribuição de uso
  const pieChartData = performanceData.map(item => ({
    name: item.model,
    value: item.totalRequests,
  }));

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="text-2xl flex items-center gap-2">
              <BarChart4 className="h-6 w-6 text-primary" />
              Desempenho dos Modelos LLM
            </CardTitle>
            <CardDescription className="mt-2">
              Comparativo de performance entre os diferentes modelos de LLM utilizados no sistema.
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={timeframe} onValueChange={handleTimeframeChange}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Último dia</SelectItem>
                <SelectItem value="week">Última semana</SelectItem>
                <SelectItem value="month">Último mês</SelectItem>
                <SelectItem value="year">Último ano</SelectItem>
              </SelectContent>
            </Select>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Atualizar"
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="mb-6">
              <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="mb-6">
                  <TabsTrigger value="usage">Uso</TabsTrigger>
                  <TabsTrigger value="responsetime">Tempo de Resposta</TabsTrigger>
                  <TabsTrigger value="accuracy">Precisão</TabsTrigger>
                  <TabsTrigger value="distribution">Distribuição</TabsTrigger>
                </TabsList>
                
                <TabsContent value="usage" className="mt-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-medium flex items-center gap-2">
                        <Zap className="h-5 w-5 text-amber-500" />
                        Uso Total por Modelo
                      </h3>
                      <Badge variant="outline" className="bg-primary/5">
                        {timeframe === "day" && "Últimas 24h"}
                        {timeframe === "week" && "Últimos 7 dias"}
                        {timeframe === "month" && "Últimos 30 dias"}
                        {timeframe === "year" && "Últimos 12 meses"}
                      </Badge>
                    </div>
                    
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart
                        data={usageChartData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="Requisições" fill="#6366f1" />
                      </BarChart>
                    </ResponsiveContainer>
                    
                    <div className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                      {performanceData.map((model, index) => (
                        <div key={model.model} className="border p-4 rounded-md shadow-sm">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-neutral-800">{model.model}</h4>
                            <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                              {model.totalRequests} requisições
                            </Badge>
                          </div>
                          <div className="mt-2 text-sm text-neutral-600">
                            <div className="flex justify-between mt-1">
                              <span>Taxa de Sucesso:</span>
                              <span className="font-medium">{model.successRate}%</span>
                            </div>
                            <div className="flex justify-between mt-1">
                              <span>Uso de Tokens:</span>
                              <span className="font-medium">
                                {(model.tokenUsage / 1000000).toFixed(2)}M
                              </span>
                            </div>
                            <div className="flex justify-between mt-1">
                              <span>Custo Médio:</span>
                              <span className="font-medium">
                                R$ {model.costPerRequest?.toFixed(4)} / req
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="responsetime" className="mt-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-medium flex items-center gap-2">
                        <Clock className="h-5 w-5 text-emerald-500" />
                        Tempo Médio de Resposta
                      </h3>
                      <Badge variant="outline" className="bg-primary/5">
                        Em segundos
                      </Badge>
                    </div>
                    
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart
                        data={responseTimeChartData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="Tempo Médio (s)" fill="#10b981" />
                      </BarChart>
                    </ResponsiveContainer>
                    
                    <div className="text-sm text-neutral-600 bg-neutral-50 p-4 rounded-md border flex items-start gap-2">
                      <Info className="h-4 w-4 text-neutral-500 mt-0.5 flex-shrink-0" />
                      <p>
                        O tempo de resposta é medido desde o envio da requisição até o recebimento
                        completo da resposta. Tempos menores indicam melhor performance. Fatores como
                        tamanho do prompt e complexidade da consulta podem afetar este tempo.
                      </p>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="accuracy" className="mt-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-medium flex items-center gap-2">
                        <Brain className="h-5 w-5 text-purple-500" />
                        Precisão e Taxa de Sucesso
                      </h3>
                      <Badge variant="outline" className="bg-primary/5">
                        Escala percentual
                      </Badge>
                    </div>
                    
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart
                        data={performanceData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="model" />
                        <YAxis domain={[80, 100]} />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="accuracyScore"
                          name="Precisão (%)"
                          stroke="#8884d8"
                          activeDot={{ r: 8 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="successRate"
                          name="Taxa de Sucesso (%)"
                          stroke="#82ca9d"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                    
                    <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="border p-4 rounded-md shadow-sm">
                        <h4 className="font-semibold text-neutral-800 mb-2">Precisão por Modelo</h4>
                        <p className="text-sm text-neutral-600 mb-4">
                          A precisão é avaliada por meio de benchmark interno com verificação humana
                          sobre amostragem de respostas.
                        </p>
                        <div className="space-y-2">
                          {performanceData
                            .sort((a, b) => (b.accuracyScore || 0) - (a.accuracyScore || 0))
                            .map((model, index) => (
                              <div key={model.model} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                  ></div>
                                  <span>{model.model}</span>
                                </div>
                                <span className="font-medium">{model.accuracyScore}%</span>
                              </div>
                            ))}
                        </div>
                      </div>
                      
                      <div className="border p-4 rounded-md shadow-sm">
                        <h4 className="font-semibold text-neutral-800 mb-2">Taxa de Sucesso</h4>
                        <p className="text-sm text-neutral-600 mb-4">
                          Mede a porcentagem de requisições completadas com sucesso, sem erros ou
                          timeouts durante o processamento.
                        </p>
                        <div className="space-y-2">
                          {performanceData
                            .sort((a, b) => b.successRate - a.successRate)
                            .map((model, index) => (
                              <div key={model.model} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                  ></div>
                                  <span>{model.model}</span>
                                </div>
                                <span className="font-medium">{model.successRate}%</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="distribution" className="mt-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-medium">
                        Distribuição de Uso
                      </h3>
                    </div>
                    
                    <div className="flex flex-col md:flex-row items-center gap-8">
                      <div className="w-full md:w-1/2">
                        <ResponsiveContainer width="100%" height={350}>
                          <PieChart>
                            <Pie
                              data={pieChartData}
                              cx="50%"
                              cy="50%"
                              labelLine={true}
                              label={({name, percent}) => `${name}: ${(percent * 100).toFixed(1)}%`}
                              outerRadius={130}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {pieChartData.map((entry, index) => (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={COLORS[index % COLORS.length]} 
                                />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      
                      <div className="w-full md:w-1/2 border p-4 rounded-md shadow-sm">
                        <h4 className="font-semibold text-neutral-800 mb-3">
                          Análise de Distribuição
                        </h4>
                        <p className="text-sm text-neutral-600 mb-4">
                          Este gráfico mostra a proporção de uso de cada modelo em relação ao total
                          de requisições no período selecionado.
                        </p>
                        
                        <div className="space-y-3">
                          {performanceData
                            .sort((a, b) => b.totalRequests - a.totalRequests)
                            .map((model, index) => (
                              <div key={model.model}>
                                <div className="flex justify-between items-center mb-1">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-3 h-3 rounded-full"
                                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                                    ></div>
                                    <span className="font-medium">{model.model}</span>
                                  </div>
                                  <span>
                                    {((model.totalRequests / performanceData.reduce((acc, curr) => acc + curr.totalRequests, 0)) * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className="h-2 rounded-full"
                                    style={{
                                      width: `${((model.totalRequests / performanceData.reduce((acc, curr) => acc + curr.totalRequests, 0)) * 100).toFixed(1)}%`,
                                      backgroundColor: COLORS[index % COLORS.length],
                                    }}
                                  ></div>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}