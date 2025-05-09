import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Info, Search, Save, Star, CircuitBoard, FileText, Download, Cpu } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type CircuitRecommendation = {
  id: string;
  name: string;
  imageUrl: string;
  similarity: number;
  description: string;
  tags: string[];
  createdAt: string;
  analysis: string;
  userId: number;
  userName: string;
  modelUsed: string;
};

export function SimilarCircuitsRecommendation() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<CircuitRecommendation[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCircuit, setSelectedCircuit] = useState<CircuitRecommendation | null>(null);
  const [activeTab, setActiveTab] = useState("recommendations");

  // Dados simulados para demonstração
  const dummyRecommendations: CircuitRecommendation[] = [
    {
      id: "rec-001",
      name: "PCB Principal Controlador Motor A237",
      imageUrl: "https://example.com/circuit1.jpg",
      similarity: 92.4,
      description: "Placa de controle do motor principal com problema de sobreaquecimento nos capacitores C12 e C14.",
      tags: ["motor", "sobreaquecimento", "capacitor"],
      createdAt: "2025-04-22T14:30:22Z",
      analysis: "A placa apresenta sinais visíveis de sobreaquecimento nos capacitores C12 e C14. A análise térmica indica temperatura acima do normal (85°C) nestes componentes. Recomenda-se a substituição dos capacitores e verificação da tensão de entrada que pode estar acima do especificado.",
      userId: 5,
      userName: "Carlos Silva",
      modelUsed: "GPT-4o"
    },
    {
      id: "rec-002",
      name: "Placa de Alimentação Inversor TX-590",
      imageUrl: "https://example.com/circuit2.jpg",
      similarity: 87.6,
      description: "Circuito de alimentação com trilhas oxidadas e resistores queimados na seção de regulação.",
      tags: ["alimentação", "oxidação", "resistor", "queimado"],
      createdAt: "2025-04-15T09:12:45Z",
      analysis: "O circuito apresenta oxidação severa nas trilhas de cobre ao redor da área de regulação de tensão. Os resistores R22, R23 e R24 apresentam sinais claros de superaquecimento e queima. A causa provável é umidade excessiva combinada com ventilação inadequada.",
      userId: 7,
      userName: "Amanda Rodrigues",
      modelUsed: "Claude 3"
    },
    {
      id: "rec-003",
      name: "PCB Comunicação Serial RS485",
      imageUrl: "https://example.com/circuit3.jpg",
      similarity: 84.9,
      description: "Módulo de comunicação com falha nos transistores de saída e proteção ESD danificada.",
      tags: ["comunicação", "rs485", "transistor", "esd"],
      createdAt: "2025-04-10T16:47:33Z",
      analysis: "O módulo de comunicação RS485 apresenta falhas nos transistores de saída Q3 e Q4, provavelmente devido a uma descarga eletrostática. O circuito de proteção ESD está visivelmente danificado, com o diodo D7 em curto. Recomenda-se a substituição dos componentes e revisão do aterramento do sistema.",
      userId: 4,
      userName: "Roberto Almeida",
      modelUsed: "GPT-4o"
    },
    {
      id: "rec-004",
      name: "Placa Aquisição Sensores Industriais",
      imageUrl: "https://example.com/circuit4.jpg",
      similarity: 76.2,
      description: "Circuito de condicionamento de sinais com amplificadores operacionais defeituosos.",
      tags: ["aquisição", "sensores", "amplificadores", "industrial"],
      createdAt: "2025-03-27T11:22:15Z",
      analysis: "A placa de aquisição de sensores apresenta problemas nos amplificadores operacionais U3 e U5 (TL074). O teste de resposta em frequência mostra comportamento irregular e o offset DC está fora das especificações. Os componentes passivos ao redor (R12, R15, C8) parecem intactos, sugerindo falha direta nos chips.",
      userId: 6,
      userName: "Juliana Costa",
      modelUsed: "Claude 3"
    },
    {
      id: "rec-005",
      name: "PCB Controle CNC Mini-Fresadora",
      imageUrl: "https://example.com/circuit5.jpg",
      similarity: 71.8,
      description: "Placa controladora de motor de passo com driver L297/L298 apresentando falhas intermitentes.",
      tags: ["cnc", "motor de passo", "driver", "l298"],
      createdAt: "2025-03-18T08:30:45Z",
      analysis: "A placa controladora CNC apresenta sinais de falha intermitente no circuito de driver L297/L298. Inspeção visual mostra soldas frias nos pinos 4, 5 e 12 do L298. O capacitor de filtro C22 apresenta abaulamento indicando fim de vida útil. Recomenda-se resoldar os componentes identificados e substituir o capacitor.",
      userId: 3,
      userName: "Paulo Mendes",
      modelUsed: "LLaMA-3"
    }
  ];

  const fetchRecommendations = async () => {
    setIsLoading(true);
    try {
      // Em produção, buscar dados reais da API
      // const response = await apiRequest("GET", "/api/admin/circuits/recommendations");
      // const data = await response.json();
      // setRecommendations(data);
      
      // Usando dados simulados para demonstração
      setRecommendations(dummyRecommendations);
    } catch (error) {
      console.error("Erro ao buscar recomendações:", error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível obter as recomendações de circuitos similares.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSaveToFavorites = (circuit: CircuitRecommendation) => {
    toast({
      title: "Adicionado aos favoritos",
      description: `O circuito "${circuit.name}" foi adicionado aos seus favoritos.`,
    });
  };

  const handleExportAnalysis = (circuit: CircuitRecommendation) => {
    toast({
      title: "Exportação iniciada",
      description: "O relatório da análise está sendo gerado e será baixado em instantes.",
    });
    // Em uma implementação real, isso chamaria um endpoint que geraria o PDF
  };

  const filteredRecommendations = recommendations.filter(
    (circuit) =>
      circuit.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      circuit.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      circuit.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle className="text-2xl flex items-center gap-2">
              <CircuitBoard className="h-6 w-6 text-primary" />
              Sistema de Recomendação de Circuitos
            </CardTitle>
            <CardDescription className="mt-2">
              Localize placas de circuito similares com base em análises anteriores e diagnósticos.
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-500" />
              <Input
                type="search"
                placeholder="Buscar circuitos..."
                className="pl-9"
                value={searchQuery}
                onChange={handleSearch}
              />
            </div>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchRecommendations}
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
            <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="mb-6">
                <TabsTrigger value="recommendations">Recomendações</TabsTrigger>
                <TabsTrigger value="saved">Circuitos Salvos</TabsTrigger>
                <TabsTrigger value="similar">Buscar Similares</TabsTrigger>
              </TabsList>
              
              <TabsContent value="recommendations" className="mt-4">
                <div className="space-y-6">
                  {filteredRecommendations.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-neutral-500">
                        Nenhum circuito encontrado para a busca atual.
                      </p>
                    </div>
                  ) : (
                    filteredRecommendations.map((circuit) => (
                      <div
                        key={circuit.id}
                        className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex flex-col md:flex-row gap-4">
                          <div className="w-full md:w-32 h-32 bg-neutral-100 rounded-md flex items-center justify-center border">
                            {/* Em uma implementação real, usaria a imagem do circuito */}
                            <Cpu className="h-12 w-12 text-neutral-300" />
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <h3 className="text-lg font-semibold text-neutral-800">
                                  {circuit.name}
                                </h3>
                                <div className="flex items-center gap-2 mt-1 text-sm text-neutral-500">
                                  <Avatar className="h-5 w-5">
                                    <AvatarFallback className="text-xs">
                                      {circuit.userName.charAt(0)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span>{circuit.userName}</span>
                                  <span>•</span>
                                  <span>
                                    {new Date(circuit.createdAt).toLocaleDateString('pt-BR')}
                                  </span>
                                </div>
                              </div>
                              
                              <Badge 
                                className={cn(
                                  "bg-emerald-100 text-emerald-700 border-emerald-200",
                                  circuit.similarity < 80 && "bg-amber-100 text-amber-700 border-amber-200",
                                  circuit.similarity < 75 && "bg-blue-100 text-blue-700 border-blue-200"
                                )}
                              >
                                {circuit.similarity}% similar
                              </Badge>
                            </div>
                            
                            <p className="mt-2 text-neutral-600 text-sm">
                              {circuit.description}
                            </p>
                            
                            <div className="mt-3 flex flex-wrap gap-2">
                              {circuit.tags.map((tag) => (
                                <Badge 
                                  key={tag} 
                                  variant="outline" 
                                  className="bg-neutral-50"
                                >
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                            
                            <div className="mt-4 flex flex-wrap gap-2">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => setSelectedCircuit(circuit)}
                                  >
                                    <FileText className="h-4 w-4 mr-2" />
                                    Ver Análise
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-3xl">
                                  <DialogHeader>
                                    <DialogTitle>Análise Detalhada</DialogTitle>
                                    <DialogDescription>
                                      Resultado da análise realizada com {selectedCircuit?.modelUsed}
                                    </DialogDescription>
                                  </DialogHeader>
                                  
                                  <div className="mt-4">
                                    <h3 className="text-lg font-semibold">
                                      {selectedCircuit?.name}
                                    </h3>
                                    
                                    <div className="mt-4">
                                      <h4 className="font-medium text-sm text-neutral-500 mb-2">
                                        DESCRIÇÃO
                                      </h4>
                                      <p className="text-neutral-800">
                                        {selectedCircuit?.description}
                                      </p>
                                    </div>
                                    
                                    <Separator className="my-4" />
                                    
                                    <div>
                                      <h4 className="font-medium text-sm text-neutral-500 mb-2">
                                        ANÁLISE TÉCNICA
                                      </h4>
                                      <div className="bg-neutral-50 p-4 rounded-md border text-neutral-800 whitespace-pre-wrap">
                                        {selectedCircuit?.analysis}
                                      </div>
                                    </div>
                                    
                                    <div className="mt-4 flex justify-between items-center">
                                      <div className="text-sm text-neutral-500">
                                        Analisado por {selectedCircuit?.userName} em{" "}
                                        {new Date(selectedCircuit?.createdAt || "").toLocaleDateString('pt-BR')}
                                      </div>
                                      
                                      <div className="flex gap-2">
                                        <Button 
                                          size="sm" 
                                          variant="outline"
                                          onClick={() => handleSaveToFavorites(selectedCircuit!)}
                                        >
                                          <Star className="h-4 w-4 mr-2" />
                                          Favoritar
                                        </Button>
                                        <Button
                                          size="sm"
                                          onClick={() => handleExportAnalysis(selectedCircuit!)}
                                        >
                                          <Download className="h-4 w-4 mr-2" />
                                          Exportar PDF
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                              
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleSaveToFavorites(circuit)}
                              >
                                <Star className="h-4 w-4 mr-2" />
                                Favoritar
                              </Button>
                              
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleExportAnalysis(circuit)}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Exportar
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="saved" className="mt-4">
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Star className="h-12 w-12 text-neutral-300 mb-4" />
                  <h3 className="text-lg font-medium text-neutral-700">
                    Nenhum circuito salvo
                  </h3>
                  <p className="text-neutral-500 mt-2 max-w-md">
                    Você ainda não salvou nenhum circuito. Encontre circuitos similares e adicione-os aos favoritos para fácil acesso.
                  </p>
                </div>
              </TabsContent>
              
              <TabsContent value="similar" className="mt-4">
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <CircuitBoard className="h-12 w-12 text-neutral-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-neutral-700">
                    Buscar Circuitos Similares
                  </h3>
                  <p className="text-neutral-500 mt-2 max-w-md mx-auto">
                    Faça upload de uma imagem de circuito para encontrar placas similares em nossa base de conhecimento.
                  </p>
                  <div className="mt-6">
                    <Input
                      type="file"
                      accept="image/*"
                      className="max-w-md mx-auto"
                    />
                  </div>
                  <Button className="mt-4">
                    Buscar Similares
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </CardContent>
      
      <CardFooter className="border-t bg-neutral-50 text-sm text-neutral-500 flex items-center">
        <Info className="h-4 w-4 mr-2 text-neutral-400" />
        <p>
          A similaridade é calculada com base em vetores de características extraídos das imagens e descrições das placas.
        </p>
      </CardFooter>
    </Card>
  );
}