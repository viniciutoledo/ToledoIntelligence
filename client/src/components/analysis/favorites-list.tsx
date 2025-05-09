import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Star, StarOff, CircuitBoard, Trash2, Download, FileText } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface FavoriteAnalysis {
  id: string;
  analysisId: string;
  circuitName: string;
  description: string;
  imageUrl?: string;
  analysis: string;
  modelUsed: string;
  createdAt: string;
  tags?: string[];
  notes?: string;
  priority: "high" | "medium" | "low";
}

export function FavoritesList() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [favorites, setFavorites] = useState<FavoriteAnalysis[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedAnalysis, setSelectedAnalysis] = useState<FavoriteAnalysis | null>(null);

  // Dados simulados para demonstração
  const dummyFavorites: FavoriteAnalysis[] = [
    {
      id: "fav-001",
      analysisId: "ana-123",
      circuitName: "PCB Motor Controlador A237",
      description: "Placa de controle do motor principal com problema de sobreaquecimento nos capacitores.",
      analysis: "A placa apresenta sinais visíveis de sobreaquecimento nos capacitores C12 e C14. A análise térmica indica temperatura acima do normal (85°C) nestes componentes. Recomenda-se a substituição dos capacitores e verificação da tensão de entrada que pode estar acima do especificado.\n\nMedições realizadas mostraram que o regulador de tensão U3 também está operando acima da temperatura recomendada, potencialmente causando a sobrecarga nos capacitores. A sequência de testes revelou flutuações de tensão na entrada DC que podem estar relacionadas à fonte de alimentação externa.\n\nAções recomendadas:\n1. Substituir capacitores C12 e C14 por modelos de temperatura mais alta (105°C)\n2. Verificar a impedância do circuito de entrada\n3. Adicionar um dissipador de calor maior ao regulador U3\n4. Implementar um circuito de proteção contra sobretensão",
      modelUsed: "GPT-4o",
      createdAt: "2025-04-22T14:30:22Z",
      tags: ["motor", "sobreaquecimento", "capacitor", "regulador"],
      notes: "Caso recorrente no modelo A237. Manter registro para futuros problemas similares.",
      priority: "high"
    },
    {
      id: "fav-002",
      analysisId: "ana-456",
      circuitName: "Placa de Alimentação Inversor TX-590",
      description: "Circuito de alimentação com trilhas oxidadas na seção de regulação.",
      analysis: "O circuito apresenta oxidação severa nas trilhas de cobre ao redor da área de regulação de tensão. Os resistores R22, R23 e R24 apresentam sinais claros de superaquecimento. A causa provável é umidade excessiva combinada com ventilação inadequada.\n\nO padrão de oxidação sugere que houve condensação dentro do gabinete, possivelmente devido a variações rápidas de temperatura ou vedação inadequada. O dano às trilhas comprometeu a integridade das conexões, especialmente na área dos resistores de potência.\n\nRecomendações:\n- Limpar as trilhas oxidadas com solução apropriada\n- Reforçar as trilhas danificadas com fio de ligação ou pasta condutiva\n- Melhorar a ventilação do gabinete\n- Aplicar revestimento de proteção conformal",
      modelUsed: "Claude 3",
      createdAt: "2025-04-15T09:12:45Z",
      tags: ["alimentação", "oxidação", "resistor", "umidade"],
      notes: "Importante avaliar condições ambientais de instalação em futuros atendimentos para este cliente.",
      priority: "medium"
    },
    {
      id: "fav-003",
      analysisId: "ana-789",
      circuitName: "Controlador CNC Mini-Fresadora V2",
      description: "Falhas intermitentes em operações de alta precisão e perda de passos.",
      analysis: "A placa controladora da mini-fresadora apresenta problemas de estabilidade durante operações de precisão. A análise dos sinais de controle mostra flutuações na linha de clock quando há demanda de potência nos motores.\n\nO capacitor de filtragem principal C8 (2200μF) apresenta ESR (Resistência Série Equivalente) acima do especificado, resultando em ripple excessivo na alimentação. Os testes com osciloscópio confirmaram picos de tensão que coincidem com os momentos de falha.\n\nAdicionalmente, os optoacopladores U7 e U8 que isolam os sinais de controle apresentam degradação, com corrente de saída abaixo do mínimo necessário para uma operação confiável.",
      modelUsed: "LLaMA-3",
      createdAt: "2025-03-05T16:22:15Z",
      tags: ["cnc", "motor de passo", "capacitor", "optoacoplador"],
      priority: "low"
    }
  ];

  const fetchFavorites = async () => {
    setIsLoading(true);
    try {
      // Em produção, buscar dados reais da API
      // const response = await apiRequest("GET", "/api/favorites");
      // const data = await response.json();
      // setFavorites(data);
      
      // Usando dados simulados para demonstração
      setFavorites(dummyFavorites);
    } catch (error) {
      console.error("Erro ao buscar favoritos:", error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível obter os favoritos salvos.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFavorites();
  }, []);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handlePriorityFilter = (value: string) => {
    setPriorityFilter(value);
  };

  const handleRemoveFavorite = (id: string) => {
    // Em produção, remover da API
    // const response = await apiRequest("DELETE", `/api/favorites/${id}`);
    
    // Atualiza localmente para demonstração
    setFavorites(favorites.filter(fav => fav.id !== id));
    
    toast({
      title: "Favorito removido",
      description: "A análise foi removida dos seus favoritos.",
    });
  };

  const handleExportAnalysis = (favorite: FavoriteAnalysis) => {
    toast({
      title: "Exportação iniciada",
      description: "O relatório da análise está sendo gerado e será baixado em instantes.",
    });
    // Em uma implementação real, isso chamaria um endpoint que geraria o PDF
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd 'de' MMMM 'de' yyyy", {
      locale: ptBR,
    });
  };

  // Filtra favoritos com base na busca e filtro de prioridade
  const filteredFavorites = favorites.filter(favorite => {
    const matchesSearch = 
      favorite.circuitName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      favorite.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (favorite.tags && favorite.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())));
    
    const matchesPriority = priorityFilter === 'all' || favorite.priority === priorityFilter;
    
    return matchesSearch && matchesPriority;
  });

  // Ícones para níveis de prioridade
  const priorityIcon = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Alta</Badge>;
      case 'medium':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Média</Badge>;
      case 'low':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Baixa</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Star className="h-6 w-6 text-amber-500" />
              Análises Favoritas
            </CardTitle>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Input
                type="search"
                placeholder="Buscar favoritos..."
                value={searchQuery}
                onChange={handleSearch}
              />
            </div>
            
            <Select value={priorityFilter} onValueChange={handlePriorityFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="low">Baixa</SelectItem>
              </SelectContent>
            </Select>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchFavorites}
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
        ) : filteredFavorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <StarOff className="h-12 w-12 text-neutral-300 mb-4" />
            <h3 className="text-lg font-medium text-neutral-700">
              Nenhum favorito encontrado
            </h3>
            <p className="text-neutral-500 mt-2 max-w-md">
              {searchQuery || priorityFilter !== 'all' 
                ? "Não encontramos favoritos que correspondam aos seus filtros." 
                : "Você ainda não adicionou nenhuma análise aos favoritos."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredFavorites.map((favorite) => (
              <div
                key={favorite.id}
                className="border rounded-lg p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex flex-col">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold text-neutral-800 flex items-center gap-2">
                        {favorite.circuitName}
                        {priorityIcon(favorite.priority)}
                      </h3>
                      <p className="text-sm text-neutral-500 mt-1">
                        Salvo em {formatDate(favorite.createdAt)}
                      </p>
                    </div>
                    
                    <div className="flex gap-1">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setSelectedAnalysis(favorite)}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl">
                          <DialogHeader>
                            <DialogTitle>Análise Detalhada</DialogTitle>
                            <DialogDescription>
                              Resultado da análise realizada com {selectedAnalysis?.modelUsed}
                            </DialogDescription>
                          </DialogHeader>
                          
                          <div className="mt-4">
                            <div className="flex justify-between items-start">
                              <h3 className="text-lg font-semibold">
                                {selectedAnalysis?.circuitName}
                              </h3>
                              {selectedAnalysis && priorityIcon(selectedAnalysis.priority)}
                            </div>
                            
                            <div className="mt-4">
                              <h4 className="font-medium text-sm text-neutral-500 mb-2">
                                DESCRIÇÃO
                              </h4>
                              <p className="text-neutral-800">
                                {selectedAnalysis?.description}
                              </p>
                            </div>
                            
                            {selectedAnalysis?.notes && (
                              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                                <h4 className="font-medium text-sm text-amber-700 mb-1">
                                  ANOTAÇÕES
                                </h4>
                                <p className="text-neutral-800 text-sm">
                                  {selectedAnalysis.notes}
                                </p>
                              </div>
                            )}
                            
                            <div className="mt-4">
                              <h4 className="font-medium text-sm text-neutral-500 mb-2">
                                ANÁLISE TÉCNICA
                              </h4>
                              <div className="bg-neutral-50 p-4 rounded-md border text-neutral-800 whitespace-pre-wrap">
                                {selectedAnalysis?.analysis}
                              </div>
                            </div>
                            
                            {selectedAnalysis?.tags && selectedAnalysis.tags.length > 0 && (
                              <div className="mt-4">
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
                            )}
                            
                            <div className="mt-6 flex justify-end gap-2">
                              <Button
                                variant="outline"
                                onClick={() => selectedAnalysis && handleExportAnalysis(selectedAnalysis)}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Exportar PDF
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover dos favoritos?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. A análise continuará disponível no histórico geral, mas será removida dos seus favoritos.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleRemoveFavorite(favorite.id)}
                              className="bg-red-500 hover:bg-red-600"
                            >
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  
                  <p className="mt-2 text-neutral-600">
                    {favorite.description}
                  </p>
                  
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex flex-wrap gap-2">
                      {favorite.tags && favorite.tags.map((tag) => (
                        <Badge 
                          key={tag} 
                          variant="outline" 
                          className="bg-neutral-50"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    
                    <div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExportAnalysis(favorite)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Exportar
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}