import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, Search, Calendar, CircuitBoard, FileText, 
  Download, Star, Filter, ChevronDown, ChevronUp, RefreshCw,
  Cpu, LayoutGrid, List, Tag
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select, 
  SelectContent, 
  SelectGroup,
  SelectItem, 
  SelectLabel,
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, isAfter, isBefore, subDays, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

interface AnalysisHistoryItem {
  id: string;
  circuitName: string;
  description: string;
  imageUrl?: string;
  analysis: string;
  modelUsed: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  userId: number;
  userName: string;
  accuracy?: number;
  isFavorite: boolean;
}

type ViewType = "grid" | "list";
type SortField = "date" | "name" | "model" | "accuracy";
type SortOrder = "asc" | "desc";
type TimeFilter = "all" | "today" | "week" | "month" | "custom";

interface AdvancedFilters {
  models: string[];
  users: string[];
  tags: string[];
  dateRange: {
    from: Date | undefined;
    to: Date | undefined;
  };
  minAccuracy: number;
  onlyFavorites: boolean;
}

export function AnalysisHistoryBrowser() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewType, setViewType] = useState<ViewType>("grid");
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisHistoryItem | null>(null);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [availableUsers, setAvailableUsers] = useState<{id: number, name: string}[]>([]);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({
    models: [],
    users: [],
    tags: [],
    dateRange: { from: undefined, to: undefined },
    minAccuracy: 0,
    onlyFavorites: false,
  });

  // Dados simulados para demonstração
  const dummyHistory: AnalysisHistoryItem[] = [
    {
      id: "ana-001",
      circuitName: "PCB Motor Controlador A237",
      description: "Placa de controle com sobreaquecimento nos capacitores C12 e C14",
      analysis: "A placa apresenta sinais visíveis de sobreaquecimento nos capacitores C12 e C14. A análise térmica indica temperatura acima do normal (85°C) nestes componentes. Recomenda-se a substituição dos capacitores e verificação da tensão de entrada que pode estar acima do especificado.",
      modelUsed: "GPT-4o",
      createdAt: "2025-04-22T14:30:22Z",
      updatedAt: "2025-04-22T14:35:10Z",
      tags: ["motor", "sobreaquecimento", "capacitor"],
      userId: 5,
      userName: "Carlos Silva",
      accuracy: 92,
      isFavorite: true
    },
    {
      id: "ana-002",
      circuitName: "Placa de Alimentação Inversor TX-590",
      description: "Circuito de alimentação com trilhas oxidadas e resistores queimados",
      analysis: "O circuito apresenta oxidação severa nas trilhas de cobre ao redor da área de regulação de tensão. Os resistores R22, R23 e R24 apresentam sinais claros de superaquecimento. A causa provável é umidade excessiva combinada com ventilação inadequada.",
      modelUsed: "Claude 3",
      createdAt: "2025-04-15T09:12:45Z",
      updatedAt: "2025-04-15T09:12:45Z",
      tags: ["alimentação", "oxidação", "resistor", "queimado"],
      userId: 7,
      userName: "Amanda Rodrigues",
      accuracy: 89,
      isFavorite: true
    },
    {
      id: "ana-003",
      circuitName: "PCB Comunicação Serial RS485",
      description: "Módulo de comunicação com falha nos transistores de saída",
      analysis: "O módulo de comunicação RS485 apresenta falhas nos transistores de saída Q3 e Q4, provavelmente devido a uma descarga eletrostática. O circuito de proteção ESD está visivelmente danificado, com o diodo D7 em curto.",
      modelUsed: "GPT-4o",
      createdAt: "2025-04-10T16:47:33Z",
      updatedAt: "2025-04-10T16:50:18Z",
      tags: ["comunicação", "rs485", "transistor", "esd"],
      userId: 4,
      userName: "Roberto Almeida",
      accuracy: 95,
      isFavorite: false
    },
    {
      id: "ana-004",
      circuitName: "Placa Aquisição Sensores Industriais",
      description: "Circuito de condicionamento de sinais com amplificadores defeituosos",
      analysis: "A placa de aquisição de sensores apresenta problemas nos amplificadores operacionais U3 e U5 (TL074). O teste de resposta em frequência mostra comportamento irregular e o offset DC está fora das especificações.",
      modelUsed: "Claude 3",
      createdAt: "2025-03-27T11:22:15Z",
      updatedAt: "2025-03-27T11:30:22Z",
      tags: ["aquisição", "sensores", "amplificadores", "industrial"],
      userId: 6,
      userName: "Juliana Costa",
      accuracy: 87,
      isFavorite: false
    },
    {
      id: "ana-005",
      circuitName: "PCB Controle CNC Mini-Fresadora",
      description: "Placa controladora de motor de passo com driver L297/L298 apresentando falhas",
      analysis: "A placa controladora CNC apresenta sinais de falha intermitente no circuito de driver L297/L298. Inspeção visual mostra soldas frias nos pinos 4, 5 e 12 do L298. O capacitor de filtro C22 apresenta abaulamento indicando fim de vida útil.",
      modelUsed: "LLaMA-3",
      createdAt: "2025-03-18T08:30:45Z",
      updatedAt: "2025-03-18T08:45:30Z",
      tags: ["cnc", "motor de passo", "driver", "l298"],
      userId: 3,
      userName: "Paulo Mendes",
      accuracy: 84,
      isFavorite: false
    },
    {
      id: "ana-006",
      circuitName: "PCB Fonte ATX Modificada",
      description: "Fonte ATX adaptada para bancada com problemas na proteção OVP",
      analysis: "A fonte ATX modificada para uso em bancada apresenta falha no circuito de proteção contra sobretensão (OVP). O CI supervisor TL431 está operando fora da faixa devido ao divisor resistivo incorreto. Os capacitores de saída mostram sinais de estresse com ESR elevado.",
      modelUsed: "GPT-4o",
      createdAt: "2025-03-10T13:25:18Z",
      updatedAt: "2025-03-10T13:40:05Z",
      tags: ["fonte", "atx", "proteção", "ovp", "capacitor"],
      userId: 5,
      userName: "Carlos Silva",
      accuracy: 91,
      isFavorite: false
    },
    {
      id: "ana-007",
      circuitName: "Placa de Controle Ar Condicionado Split",
      description: "Controlador de A/C com falha no sensor de temperatura e relés travados",
      analysis: "O circuito de controle apresenta falha no condicionamento do sinal do termistor NTC. O amplificador operacional U2A está saturado devido a um resistor aberto (R15) no divisor de tensão. Adicionalmente, os relés K1 e K3 mostram sinais de contatos soldados devido a sobrecarga.",
      modelUsed: "LLaMA-3",
      createdAt: "2025-02-28T09:10:35Z",
      updatedAt: "2025-02-28T09:10:35Z",
      tags: ["ar condicionado", "sensor", "temperatura", "relé"],
      userId: 4,
      userName: "Roberto Almeida",
      accuracy: 88,
      isFavorite: false
    },
    {
      id: "ana-008",
      circuitName: "Módulo Arduino Shield Ethernet",
      description: "Shield de Ethernet com problemas de conectividade intermitente",
      analysis: "O shield Ethernet baseado no chip W5100 apresenta falhas intermitentes de conexão. A análise mostra oscilação na tensão de alimentação do W5100 causada por solda fria no regulador de tensão. O cristal de 25MHz apresenta leituras inconsistentes sugerindo possível dano ou dessoldagem parcial.",
      modelUsed: "Claude 3",
      createdAt: "2025-02-15T16:20:45Z",
      updatedAt: "2025-02-15T16:22:18Z",
      tags: ["arduino", "ethernet", "w5100", "conectividade"],
      userId: 7,
      userName: "Amanda Rodrigues",
      accuracy: 93,
      isFavorite: true
    }
  ];

  const fetchHistoryData = async () => {
    setIsLoading(true);
    try {
      // Em produção, buscar dados reais da API
      // const response = await apiRequest("GET", "/api/analysis/history");
      // const data = await response.json();
      // setHistory(data.history);
      
      // Usando dados simulados para demonstração
      setHistory(dummyHistory);
      
      // Extrair tags, modelos e usuários únicos
      const uniqueTags = [...new Set(dummyHistory.flatMap(item => item.tags))];
      const uniqueModels = [...new Set(dummyHistory.map(item => item.modelUsed))];
      const uniqueUsers = [...new Set(dummyHistory.map(item => ({ id: item.userId, name: item.userName })))];
      
      setAvailableTags(uniqueTags);
      setAvailableModels(uniqueModels);
      setAvailableUsers(uniqueUsers.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i));
      
    } catch (error) {
      console.error("Erro ao buscar histórico:", error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível obter o histórico de análises.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistoryData();
  }, []);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleViewTypeChange = (type: ViewType) => {
    setViewType(type);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const handleTimeFilterChange = (value: TimeFilter) => {
    setTimeFilter(value);
    
    // Reset custom date range when selecting a predefined filter
    if (value !== "custom") {
      const now = new Date();
      let fromDate: Date | undefined = undefined;
      
      switch (value) {
        case "today":
          fromDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case "week":
          fromDate = subDays(now, 7);
          break;
        case "month":
          fromDate = subMonths(now, 1);
          break;
        default:
          fromDate = undefined;
      }
      
      setAdvancedFilters({
        ...advancedFilters,
        dateRange: {
          from: fromDate,
          to: undefined
        }
      });
    }
  };

  const handleToggleFavorite = (id: string) => {
    // Em produção, atualizar na API
    // await apiRequest("POST", `/api/favorites/toggle/${id}`);
    
    // Atualiza localmente para demonstração
    setHistory(history.map(item => 
      item.id === id 
        ? { ...item, isFavorite: !item.isFavorite } 
        : item
    ));
    
    toast({
      title: "Favorito atualizado",
      description: "O status de favorito da análise foi atualizado.",
    });
  };

  const handleExportAnalysis = (analysis: AnalysisHistoryItem) => {
    toast({
      title: "Exportação iniciada",
      description: "O relatório da análise está sendo gerado e será baixado em instantes.",
    });
    // Em uma implementação real, isso chamaria um endpoint que geraria o PDF
  };

  const handleFilterChange = (filterType: keyof AdvancedFilters, value: any) => {
    setAdvancedFilters({
      ...advancedFilters,
      [filterType]: value
    });
  };

  const resetFilters = () => {
    setAdvancedFilters({
      models: [],
      users: [],
      tags: [],
      dateRange: { from: undefined, to: undefined },
      minAccuracy: 0,
      onlyFavorites: false,
    });
    setTimeFilter("all");
    setSearchQuery("");
  };

  // Aplicar todos os filtros e ordenação
  const filteredAndSortedHistory = [...history]
    // Filtro de texto de busca
    .filter(item => {
      const textMatches = 
        item.circuitName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      
      return textMatches;
    })
    // Filtros avançados
    .filter(item => {
      // Filtro de modelos
      const modelMatches = advancedFilters.models.length === 0 || 
        advancedFilters.models.includes(item.modelUsed);
      
      // Filtro de usuários
      const userMatches = advancedFilters.users.length === 0 || 
        advancedFilters.users.includes(item.userName);
      
      // Filtro de tags
      const tagMatches = advancedFilters.tags.length === 0 || 
        advancedFilters.tags.some(tag => item.tags.includes(tag));
      
      // Filtro de data
      let dateMatches = true;
      const itemDate = new Date(item.createdAt);
      
      if (advancedFilters.dateRange.from) {
        dateMatches = dateMatches && isAfter(itemDate, advancedFilters.dateRange.from);
      }
      
      if (advancedFilters.dateRange.to) {
        dateMatches = dateMatches && isBefore(itemDate, advancedFilters.dateRange.to);
      }
      
      // Filtro de precisão
      const accuracyMatches = (item.accuracy || 0) >= advancedFilters.minAccuracy;
      
      // Filtro de favoritos
      const favoriteMatches = !advancedFilters.onlyFavorites || item.isFavorite;
      
      return modelMatches && userMatches && tagMatches && dateMatches && accuracyMatches && favoriteMatches;
    })
    // Ordenação
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case "date":
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "name":
          comparison = a.circuitName.localeCompare(b.circuitName);
          break;
        case "model":
          comparison = a.modelUsed.localeCompare(b.modelUsed);
          break;
        case "accuracy":
          comparison = (a.accuracy || 0) - (b.accuracy || 0);
          break;
      }
      
      return sortOrder === "asc" ? comparison : -comparison;
    });

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd 'de' MMMM 'de' yyyy", {
      locale: ptBR,
    });
  };

  // Componente de item de análise para visualização em grid
  const GridItem = ({ item }: { item: AnalysisHistoryItem }) => (
    <Card className="overflow-hidden h-full flex flex-col">
      <div className="p-4 border-b bg-neutral-50 flex justify-between items-start">
        <div>
          <h3 className="font-semibold text-neutral-800 line-clamp-1">
            {item.circuitName}
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            {format(new Date(item.createdAt), "dd/MM/yyyy")}
          </p>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={(e) => {
            e.stopPropagation();
            handleToggleFavorite(item.id);
          }}
          className={cn(
            "h-7 w-7",
            item.isFavorite && "text-amber-500"
          )}
        >
          <Star className="h-4 w-4" fill={item.isFavorite ? "currentColor" : "none"} />
        </Button>
      </div>
      
      <CardContent className="p-4 flex-grow">
        <div className="h-full flex flex-col justify-between">
          <div>
            <p className="text-sm text-neutral-600 line-clamp-2 mb-3">
              {item.description}
            </p>
            
            <div className="flex items-center text-xs text-neutral-500 mb-3">
              <Cpu className="h-3 w-3 mr-1" />
              <span>{item.modelUsed}</span>
              {item.accuracy && (
                <Badge 
                  className="ml-2 text-[10px] h-4 bg-green-100 text-green-800 hover:bg-green-100"
                >
                  {item.accuracy}% precisão
                </Badge>
              )}
            </div>
          </div>
          
          <div>
            <div className="flex flex-wrap gap-1 mb-3">
              {item.tags.slice(0, 3).map(tag => (
                <Badge 
                  key={tag} 
                  variant="outline" 
                  className="text-[10px] h-4 px-1.5 bg-neutral-50"
                >
                  {tag}
                </Badge>
              ))}
              {item.tags.length > 3 && (
                <span className="text-[10px] text-neutral-500">
                  +{item.tags.length - 3}
                </span>
              )}
            </div>
            
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[10px]">
                    {item.userName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-neutral-500 ml-1">
                  {item.userName}
                </span>
              </div>
              
              <Dialog>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => setSelectedAnalysis(item)}
                  >
                    Detalhes
                  </Button>
                </DialogTrigger>
              </Dialog>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Componente de item de análise para visualização em lista
  const ListItem = ({ item }: { item: AnalysisHistoryItem }) => (
    <div className="border rounded-md p-3 hover:bg-neutral-50 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex-grow">
          <div className="flex items-start justify-between">
            <h3 className="font-medium text-neutral-800">
              {item.circuitName}
            </h3>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={(e) => {
                e.stopPropagation();
                handleToggleFavorite(item.id);
              }}
              className={cn(
                "h-7 w-7 hidden sm:flex",
                item.isFavorite && "text-amber-500"
              )}
            >
              <Star className="h-4 w-4" fill={item.isFavorite ? "currentColor" : "none"} />
            </Button>
          </div>
          
          <p className="text-sm text-neutral-600 line-clamp-1 mt-1">
            {item.description}
          </p>
          
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <span className="text-xs text-neutral-500 flex items-center">
              <Calendar className="h-3 w-3 mr-1" />
              {format(new Date(item.createdAt), "dd/MM/yyyy")}
            </span>
            
            <span className="text-xs text-neutral-500 flex items-center">
              <Cpu className="h-3 w-3 mr-1" />
              {item.modelUsed}
            </span>
            
            {item.accuracy && (
              <Badge className="text-xs h-5 bg-green-100 text-green-800 hover:bg-green-100">
                {item.accuracy}% precisão
              </Badge>
            )}
            
            <div className="flex items-center">
              <Avatar className="h-4 w-4">
                <AvatarFallback className="text-[10px]">
                  {item.userName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-neutral-500 ml-1">
                {item.userName}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 ml-auto">
          <div className="flex flex-wrap gap-1 mr-2">
            {item.tags.slice(0, 2).map(tag => (
              <Badge 
                key={tag} 
                variant="outline" 
                className="text-[10px] h-5 px-1.5 bg-neutral-50"
              >
                {tag}
              </Badge>
            ))}
            {item.tags.length > 2 && (
              <span className="text-[10px] text-neutral-500">
                +{item.tags.length - 2}
              </span>
            )}
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 mr-1"
            onClick={() => handleExportAnalysis(item)}
          >
            <Download className="h-4 w-4" />
          </Button>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className="h-7"
                onClick={() => setSelectedAnalysis(item)}
              >
                Detalhes
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Card className="w-full">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <FileText className="h-6 w-6 text-primary" />
                Histórico de Análises
              </CardTitle>
              <CardDescription className="mt-2">
                Pesquise e filtre o histórico completo de análises de circuitos
              </CardDescription>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-500" />
                <Input
                  type="search"
                  placeholder="Buscar análises..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={handleSearch}
                />
              </div>
              
              <Select value={timeFilter} onValueChange={handleTimeFilterChange}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os períodos</SelectItem>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="week">Última semana</SelectItem>
                  <SelectItem value="month">Último mês</SelectItem>
                  <SelectItem value="custom">Período personalizado</SelectItem>
                </SelectContent>
              </Select>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Filtros
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuLabel>Filtros Avançados</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      onClick={() => setShowFilters(!showFilters)}
                    >
                      <Filter className="h-4 w-4 mr-2" />
                      {showFilters ? "Ocultar filtros" : "Mostrar todos os filtros"}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuGroup>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Cpu className="h-4 w-4 mr-2" />
                        Modelos
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          {availableModels.map(model => (
                            <DropdownMenuItem
                              key={model}
                              onClick={(e) => {
                                e.stopPropagation();
                                const isSelected = advancedFilters.models.includes(model);
                                const newModels = isSelected
                                  ? advancedFilters.models.filter(m => m !== model)
                                  : [...advancedFilters.models, model];
                                
                                handleFilterChange('models', newModels);
                              }}
                            >
                              <div className="flex items-center">
                                <div className="w-4 h-4 mr-2 flex items-center justify-center">
                                  {advancedFilters.models.includes(model) && (
                                    <div className="w-2 h-2 rounded-full bg-primary" />
                                  )}
                                </div>
                                {model}
                              </div>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                    
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Tag className="h-4 w-4 mr-2" />
                        Tags
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent className="max-h-80 overflow-y-auto">
                          {availableTags.map(tag => (
                            <DropdownMenuItem
                              key={tag}
                              onClick={(e) => {
                                e.stopPropagation();
                                const isSelected = advancedFilters.tags.includes(tag);
                                const newTags = isSelected
                                  ? advancedFilters.tags.filter(t => t !== tag)
                                  : [...advancedFilters.tags, tag];
                                
                                handleFilterChange('tags', newTags);
                              }}
                            >
                              <div className="flex items-center">
                                <div className="w-4 h-4 mr-2 flex items-center justify-center">
                                  {advancedFilters.tags.includes(tag) && (
                                    <div className="w-2 h-2 rounded-full bg-primary" />
                                  )}
                                </div>
                                {tag}
                              </div>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                  </DropdownMenuGroup>
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem
                    onClick={() => handleFilterChange('onlyFavorites', !advancedFilters.onlyFavorites)}
                  >
                    <div className="flex items-center w-full">
                      <Checkbox 
                        id="favorites" 
                        checked={advancedFilters.onlyFavorites}
                        onCheckedChange={(checked) => 
                          handleFilterChange('onlyFavorites', checked)
                        }
                        className="mr-2"
                      />
                      <label htmlFor="favorites" className="flex-grow cursor-pointer">
                        Apenas favoritos
                      </label>
                    </div>
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem 
                    onClick={resetFilters}
                    className="text-red-500 focus:text-red-500"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Limpar filtros
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <div className="flex border rounded-md">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-9 w-9 rounded-none border-r",
                    viewType === "grid" && "bg-neutral-100"
                  )}
                  onClick={() => handleViewTypeChange("grid")}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-9 w-9 rounded-none",
                    viewType === "list" && "bg-neutral-100"
                  )}
                  onClick={() => handleViewTypeChange("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        
        {showFilters && (
          <div className="px-6 pb-4">
            <div className="bg-neutral-50 rounded-md p-4 border">
              <div className="flex flex-wrap justify-between items-center mb-4">
                <h3 className="text-sm font-medium">Filtros Avançados</h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={resetFilters}
                  className="text-xs h-7"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Limpar
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <h4 className="text-xs font-medium mb-2">Modelos</h4>
                  <ScrollArea className="h-24 rounded border p-2 bg-white">
                    {availableModels.map(model => (
                      <div key={model} className="flex items-center mb-1">
                        <Checkbox 
                          id={`model-${model}`}
                          checked={advancedFilters.models.includes(model)}
                          onCheckedChange={(checked) => {
                            const newModels = checked
                              ? [...advancedFilters.models, model]
                              : advancedFilters.models.filter(m => m !== model);
                            handleFilterChange('models', newModels);
                          }}
                          className="mr-2"
                        />
                        <label 
                          htmlFor={`model-${model}`} 
                          className="text-sm cursor-pointer"
                        >
                          {model}
                        </label>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
                
                <div>
                  <h4 className="text-xs font-medium mb-2">Técnicos</h4>
                  <ScrollArea className="h-24 rounded border p-2 bg-white">
                    {availableUsers.map(user => (
                      <div key={user.id} className="flex items-center mb-1">
                        <Checkbox 
                          id={`user-${user.id}`}
                          checked={advancedFilters.users.includes(user.name)}
                          onCheckedChange={(checked) => {
                            const newUsers = checked
                              ? [...advancedFilters.users, user.name]
                              : advancedFilters.users.filter(u => u !== user.name);
                            handleFilterChange('users', newUsers);
                          }}
                          className="mr-2"
                        />
                        <label 
                          htmlFor={`user-${user.id}`} 
                          className="text-sm cursor-pointer"
                        >
                          {user.name}
                        </label>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
                
                <div>
                  <h4 className="text-xs font-medium mb-2">Período</h4>
                  <div className="rounded border p-2 bg-white h-24">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal text-sm h-8"
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {advancedFilters.dateRange.from ? (
                            advancedFilters.dateRange.to ? (
                              <>
                                {format(advancedFilters.dateRange.from, "dd/MM/yyyy")} - {format(advancedFilters.dateRange.to, "dd/MM/yyyy")}
                              </>
                            ) : (
                              format(advancedFilters.dateRange.from, "dd/MM/yyyy")
                            )
                          ) : (
                            "Selecionar período"
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="range"
                          selected={{
                            from: advancedFilters.dateRange.from,
                            to: advancedFilters.dateRange.to
                          }}
                          onSelect={(range) => {
                            handleFilterChange('dateRange', {
                              from: range?.from,
                              to: range?.to
                            });
                            if (range?.from) {
                              setTimeFilter("custom");
                            }
                          }}
                          numberOfMonths={2}
                        />
                      </PopoverContent>
                    </Popover>
                    
                    <div className="mt-3">
                      <h4 className="text-xs font-medium mb-2">Precisão (min: {advancedFilters.minAccuracy}%)</h4>
                      <Slider
                        defaultValue={[0]}
                        max={100}
                        step={5}
                        value={[advancedFilters.minAccuracy]}
                        onValueChange={(value) => handleFilterChange('minAccuracy', value[0])}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center mt-3">
                <Checkbox 
                  id="only-favorites" 
                  checked={advancedFilters.onlyFavorites}
                  onCheckedChange={(checked) => 
                    handleFilterChange('onlyFavorites', checked)
                  }
                  className="mr-2"
                />
                <label htmlFor="only-favorites" className="text-sm cursor-pointer">
                  Mostrar apenas análises favoritadas
                </label>
              </div>
            </div>
          </div>
        )}
        
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredAndSortedHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-neutral-300 mb-4" />
              <h3 className="text-lg font-medium text-neutral-700">
                Nenhuma análise encontrada
              </h3>
              <p className="text-neutral-500 mt-2 max-w-md">
                {(searchQuery || timeFilter !== 'all' || Object.values(advancedFilters).some(v => 
                  Array.isArray(v) ? v.length > 0 : v !== 0 && v !== false && v !== undefined
                )) 
                  ? "Não encontramos análises que correspondam aos seus filtros." 
                  : "Ainda não há análises registradas no sistema."}
              </p>
              {(searchQuery || timeFilter !== 'all' || Object.values(advancedFilters).some(v => 
                Array.isArray(v) ? v.length > 0 : v !== 0 && v !== false && v !== undefined
              )) && (
                <Button onClick={resetFilters} className="mt-4">
                  Limpar Filtros
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-neutral-500">
                  {filteredAndSortedHistory.length} resultado{filteredAndSortedHistory.length !== 1 ? 's' : ''}
                </p>
                
                <div className="flex items-center">
                  <span className="text-sm text-neutral-500 mr-2">Ordenar por:</span>
                  <div className="flex border rounded-md">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-8 rounded-l-md rounded-r-none border-r",
                        sortField === "date" && "bg-neutral-100"
                      )}
                      onClick={() => handleSort("date")}
                    >
                      Data
                      {sortField === "date" && (
                        sortOrder === "asc" ? (
                          <ChevronUp className="ml-1 h-3 w-3" />
                        ) : (
                          <ChevronDown className="ml-1 h-3 w-3" />
                        )
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-8 rounded-none border-r",
                        sortField === "name" && "bg-neutral-100"
                      )}
                      onClick={() => handleSort("name")}
                    >
                      Nome
                      {sortField === "name" && (
                        sortOrder === "asc" ? (
                          <ChevronUp className="ml-1 h-3 w-3" />
                        ) : (
                          <ChevronDown className="ml-1 h-3 w-3" />
                        )
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-8 rounded-none border-r",
                        sortField === "model" && "bg-neutral-100"
                      )}
                      onClick={() => handleSort("model")}
                    >
                      Modelo
                      {sortField === "model" && (
                        sortOrder === "asc" ? (
                          <ChevronUp className="ml-1 h-3 w-3" />
                        ) : (
                          <ChevronDown className="ml-1 h-3 w-3" />
                        )
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-8 rounded-r-md rounded-l-none",
                        sortField === "accuracy" && "bg-neutral-100"
                      )}
                      onClick={() => handleSort("accuracy")}
                    >
                      Precisão
                      {sortField === "accuracy" && (
                        sortOrder === "asc" ? (
                          <ChevronUp className="ml-1 h-3 w-3" />
                        ) : (
                          <ChevronDown className="ml-1 h-3 w-3" />
                        )
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              
              {viewType === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredAndSortedHistory.map((item) => (
                    <GridItem key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredAndSortedHistory.map((item) => (
                    <ListItem key={item.id} item={item} />
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
        
        <CardFooter className="border-t px-6 py-4 flex justify-between">
          <p className="text-xs text-neutral-500">
            O histórico completo de análises permite facilmente encontrar e comparar diagnósticos anteriores.
          </p>
        </CardFooter>
      </Card>
      
      {/* Dialog para visualização detalhada da análise */}
      {selectedAnalysis && (
        <Dialog open={!!selectedAnalysis} onOpenChange={(open) => !open && setSelectedAnalysis(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Análise Detalhada</DialogTitle>
              <DialogDescription>
                Resultado da análise realizada com {selectedAnalysis.modelUsed}
              </DialogDescription>
            </DialogHeader>
            
            <div className="mt-4">
              <div className="flex justify-between items-start">
                <h3 className="text-xl font-semibold">
                  {selectedAnalysis.circuitName}
                </h3>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleToggleFavorite(selectedAnalysis.id)}
                    className={cn(
                      selectedAnalysis.isFavorite && "text-amber-500"
                    )}
                  >
                    <Star className="h-4 w-4 mr-2" fill={selectedAnalysis.isFavorite ? "currentColor" : "none"} />
                    {selectedAnalysis.isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="md:col-span-2">
                  <div className="mb-6">
                    <h4 className="font-medium text-sm text-neutral-500 mb-2">
                      DESCRIÇÃO
                    </h4>
                    <p className="text-neutral-800">
                      {selectedAnalysis.description}
                    </p>
                  </div>
                  
                  <div className="mb-6">
                    <h4 className="font-medium text-sm text-neutral-500 mb-2">
                      ANÁLISE TÉCNICA
                    </h4>
                    <div className="bg-neutral-50 p-4 rounded-md border text-neutral-800 whitespace-pre-wrap">
                      {selectedAnalysis.analysis}
                    </div>
                  </div>
                  
                  <div className="mb-6">
                    <h4 className="font-medium text-sm text-neutral-500 mb-2">
                      TAGS
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedAnalysis.tags.map(tag => (
                        <Badge key={tag} variant="outline" className="bg-neutral-50">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div>
                  <div className="bg-neutral-50 p-4 rounded-md border mb-4">
                    <h4 className="font-medium text-sm text-neutral-500 mb-2">
                      INFORMAÇÕES
                    </h4>
                    <dl className="space-y-2">
                      <div className="flex justify-between">
                        <dt className="text-sm text-neutral-600">Data da análise:</dt>
                        <dd className="text-sm font-medium">{formatDate(selectedAnalysis.createdAt)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-neutral-600">Modelo utilizado:</dt>
                        <dd className="text-sm font-medium">{selectedAnalysis.modelUsed}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-neutral-600">Técnico responsável:</dt>
                        <dd className="text-sm font-medium">{selectedAnalysis.userName}</dd>
                      </div>
                      {selectedAnalysis.accuracy && (
                        <div className="flex justify-between">
                          <dt className="text-sm text-neutral-600">Precisão da análise:</dt>
                          <dd className="text-sm font-medium">{selectedAnalysis.accuracy}%</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <Button onClick={() => handleExportAnalysis(selectedAnalysis)}>
                      <Download className="h-4 w-4 mr-2" />
                      Exportar como PDF
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}