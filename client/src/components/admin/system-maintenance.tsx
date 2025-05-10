import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, AlertTriangle, Database, RefreshCw, Shield, FileArchive, Zap } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const SystemMaintenance = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({
    verifyIntegrity: false,
    optimizeIndexes: false,
    rebuildIndexes: false,
    clearCache: false,
    updateStatistics: false,
    vacuumDatabase: false,
    backupDatabase: false,
    restoreDatabase: false
  });

  const [results, setResults] = useState<Record<string, { success: boolean; message: string; data?: any }>>({});

  const handleOperation = async (operation: string) => {
    setIsLoading(prev => ({ ...prev, [operation]: true }));
    
    try {
      const response = await apiRequest("POST", `/api/admin/system-maintenance/${operation}`);
      const result = await response.json();
      
      setResults(prev => ({
        ...prev,
        [operation]: {
          success: result.success,
          message: result.message,
          data: result.data
        }
      }));
      
      toast({
        title: result.success ? "Operação concluída" : "Falha na operação",
        description: result.message,
        variant: result.success ? "default" : "destructive"
      });
    } catch (error) {
      console.error(`Erro na operação ${operation}:`, error);
      setResults(prev => ({
        ...prev,
        [operation]: {
          success: false,
          message: `Erro ao executar a operação: ${error instanceof Error ? error.message : String(error)}`
        }
      }));
      
      toast({
        title: "Erro na operação",
        description: `Não foi possível executar a operação ${operation}. Tente novamente mais tarde.`,
        variant: "destructive"
      });
    } finally {
      setIsLoading(prev => ({ ...prev, [operation]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <p className="text-neutral-600 text-lg">
          Esta seção fornece ferramentas para manutenção e otimização do banco de dados PostgreSQL. 
          Recomenda-se executar estas operações regularmente para garantir o desempenho ideal do sistema.
        </p>
      </div>

      <Tabs defaultValue="database" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="database">Banco de Dados</TabsTrigger>
          <TabsTrigger value="system">Sistema</TabsTrigger>
        </TabsList>

        <TabsContent value="database" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Database className="h-5 w-5 mr-2 text-primary-600" />
                  Verificar Integridade
                </CardTitle>
                <CardDescription>
                  Verifica a integridade do banco de dados PostgreSQL e identifica possíveis problemas.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-neutral-600 mb-4">
                  Esta operação verifica a consistência do banco de dados, identificando anomalias ou corrupções nos dados.
                </p>
              </CardContent>
              <CardFooter className="flex justify-between items-center">
                <Button
                  onClick={() => handleOperation("verifyIntegrity")}
                  disabled={isLoading.verifyIntegrity}
                >
                  {isLoading.verifyIntegrity ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    "Verificar Integridade"
                  )}
                </Button>
                {results.verifyIntegrity && (
                  <span className={`text-sm flex items-center ${results.verifyIntegrity.success ? "text-green-600" : "text-red-600"}`}>
                    {results.verifyIntegrity.success ? (
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 mr-1" />
                    )}
                    {results.verifyIntegrity.success ? "OK" : "Falha"}
                  </span>
                )}
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Zap className="h-5 w-5 mr-2 text-primary-600" />
                  Otimizar Índices
                </CardTitle>
                <CardDescription>
                  Otimiza os índices do banco de dados para melhorar o desempenho das consultas.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-neutral-600 mb-4">
                  Esta operação reorganiza os índices para melhorar o tempo de resposta das consultas ao banco de dados.
                </p>
              </CardContent>
              <CardFooter className="flex justify-between items-center">
                <Button
                  onClick={() => handleOperation("optimizeIndexes")}
                  disabled={isLoading.optimizeIndexes}
                >
                  {isLoading.optimizeIndexes ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Otimizando...
                    </>
                  ) : (
                    "Otimizar Índices"
                  )}
                </Button>
                {results.optimizeIndexes && (
                  <span className={`text-sm flex items-center ${results.optimizeIndexes.success ? "text-green-600" : "text-red-600"}`}>
                    {results.optimizeIndexes.success ? (
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 mr-1" />
                    )}
                    {results.optimizeIndexes.success ? "OK" : "Falha"}
                  </span>
                )}
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <RefreshCw className="h-5 w-5 mr-2 text-primary-600" />
                  Reconstruir Índices
                </CardTitle>
                <CardDescription>
                  Reconstrói os índices do banco de dados para resolver fragmentação e melhorar o desempenho.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-neutral-600 mb-4">
                  Esta operação reconstrói completamente os índices, eliminando fragmentação e otimizando o armazenamento.
                </p>
              </CardContent>
              <CardFooter className="flex justify-between items-center">
                <Button
                  onClick={() => handleOperation("rebuildIndexes")}
                  disabled={isLoading.rebuildIndexes}
                  variant="secondary"
                >
                  {isLoading.rebuildIndexes ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Reconstruindo...
                    </>
                  ) : (
                    "Reconstruir Índices"
                  )}
                </Button>
                {results.rebuildIndexes && (
                  <span className={`text-sm flex items-center ${results.rebuildIndexes.success ? "text-green-600" : "text-red-600"}`}>
                    {results.rebuildIndexes.success ? (
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 mr-1" />
                    )}
                    {results.rebuildIndexes.success ? "OK" : "Falha"}
                  </span>
                )}
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="h-5 w-5 mr-2 text-primary-600" />
                  Atualizar Estatísticas
                </CardTitle>
                <CardDescription>
                  Atualiza as estatísticas do banco de dados para melhorar as decisões do planejador de consultas.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-neutral-600 mb-4">
                  Esta operação atualiza as estatísticas utilizadas pelo planejador de consultas para escolher planos de execução eficientes.
                </p>
              </CardContent>
              <CardFooter className="flex justify-between items-center">
                <Button
                  onClick={() => handleOperation("updateStatistics")}
                  disabled={isLoading.updateStatistics}
                  variant="secondary"
                >
                  {isLoading.updateStatistics ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Atualizando...
                    </>
                  ) : (
                    "Atualizar Estatísticas"
                  )}
                </Button>
                {results.updateStatistics && (
                  <span className={`text-sm flex items-center ${results.updateStatistics.success ? "text-green-600" : "text-red-600"}`}>
                    {results.updateStatistics.success ? (
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 mr-1" />
                    )}
                    {results.updateStatistics.success ? "OK" : "Falha"}
                  </span>
                )}
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Database className="h-5 w-5 mr-2 text-primary-600" />
                  Vacuum Database
                </CardTitle>
                <CardDescription>
                  Recupera espaço em disco e otimiza o armazenamento do banco de dados.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-neutral-600 mb-4">
                  Esta operação recupera espaço em disco removendo tuplas obsoletas e reorganizando o armazenamento.
                </p>
              </CardContent>
              <CardFooter className="flex justify-between items-center">
                <Button
                  onClick={() => handleOperation("vacuumDatabase")}
                  disabled={isLoading.vacuumDatabase}
                >
                  {isLoading.vacuumDatabase ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Executando...
                    </>
                  ) : (
                    "Executar Vacuum"
                  )}
                </Button>
                {results.vacuumDatabase && (
                  <span className={`text-sm flex items-center ${results.vacuumDatabase.success ? "text-green-600" : "text-red-600"}`}>
                    {results.vacuumDatabase.success ? (
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 mr-1" />
                    )}
                    {results.vacuumDatabase.success ? "OK" : "Falha"}
                  </span>
                )}
              </CardFooter>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileArchive className="h-5 w-5 mr-2 text-primary-600" />
                  Backup do Banco de Dados
                </CardTitle>
                <CardDescription>
                  Cria um backup completo do banco de dados que pode ser usado para restauração.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-neutral-600 mb-4">
                  Esta operação cria um arquivo de backup completo do banco de dados que pode ser baixado.
                </p>
              </CardContent>
              <CardFooter className="flex justify-between items-center">
                <Button
                  onClick={() => handleOperation("backupDatabase")}
                  disabled={isLoading.backupDatabase}
                >
                  {isLoading.backupDatabase ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando backup...
                    </>
                  ) : (
                    "Fazer Backup"
                  )}
                </Button>
                {results.backupDatabase && (
                  <span className={`text-sm flex items-center ${results.backupDatabase.success ? "text-green-600" : "text-red-600"}`}>
                    {results.backupDatabase.success ? (
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 mr-1" />
                    )}
                    {results.backupDatabase.success ? "OK" : "Falha"}
                  </span>
                )}
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <RefreshCw className="h-5 w-5 mr-2 text-primary-600" />
                  Limpar Cache
                </CardTitle>
                <CardDescription>
                  Limpa o cache do sistema para liberar memória e recursos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-neutral-600 mb-4">
                  Esta operação limpa o cache de memória do aplicativo, útil para resolver problemas de desempenho.
                </p>
              </CardContent>
              <CardFooter className="flex justify-between items-center">
                <Button
                  onClick={() => handleOperation("clearCache")}
                  disabled={isLoading.clearCache}
                >
                  {isLoading.clearCache ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Limpando...
                    </>
                  ) : (
                    "Limpar Cache"
                  )}
                </Button>
                {results.clearCache && (
                  <span className={`text-sm flex items-center ${results.clearCache.success ? "text-green-600" : "text-red-600"}`}>
                    {results.clearCache.success ? (
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 mr-1" />
                    )}
                    {results.clearCache.success ? "OK" : "Falha"}
                  </span>
                )}
              </CardFooter>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center">
                  <Database className="h-5 w-5 mr-2 text-primary-600" />
                  Restaurar Banco de Dados
                </CardTitle>
                <CardDescription>
                  Restaura o banco de dados a partir de um arquivo de backup.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-neutral-600 mb-4">
                  Esta operação substitui o banco de dados atual pelo conteúdo de um arquivo de backup.
                </p>
                
                <Alert variant="destructive" className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Atenção</AlertTitle>
                  <AlertDescription>
                    Esta operação substituirá todos os dados atuais. Certifique-se de ter um backup recente antes de prosseguir.
                  </AlertDescription>
                </Alert>
              </CardContent>
              <CardFooter className="flex justify-between items-center">
                <Button
                  onClick={() => handleOperation("restoreDatabase")}
                  disabled={isLoading.restoreDatabase}
                  variant="destructive"
                >
                  {isLoading.restoreDatabase ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Restaurando...
                    </>
                  ) : (
                    "Restaurar Banco de Dados"
                  )}
                </Button>
                {results.restoreDatabase && (
                  <span className={`text-sm flex items-center ${results.restoreDatabase.success ? "text-green-600" : "text-red-600"}`}>
                    {results.restoreDatabase.success ? (
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 mr-1" />
                    )}
                    {results.restoreDatabase.success ? "OK" : "Falha"}
                  </span>
                )}
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SystemMaintenance;