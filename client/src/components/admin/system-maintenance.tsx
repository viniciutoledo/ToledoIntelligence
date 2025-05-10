import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Database, HardDrive, Wrench, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

export const SystemMaintenance = () => {
  const [isLoading, setIsLoading] = useState<{[key: string]: boolean}>({
    verifyIntegrity: false,
    optimizeIndices: false,
    clearCache: false,
    rebuildIndices: false
  });
  const { toast } = useToast();

  const showMessage = (message: string, type: 'default' | 'success' | 'error' = 'default') => {
    toast({
      title: type === 'error' ? 'Erro' : type === 'success' ? 'Sucesso' : 'Informação',
      description: message,
      variant: type === 'error' ? 'destructive' : type === 'success' ? 'default' : 'secondary',
    });
  };

  const verifyDatabaseIntegrity = async () => {
    try {
      setIsLoading(prev => ({ ...prev, verifyIntegrity: true }));
      showMessage("Verificação de integridade iniciada...");
      
      const response = await apiRequest("POST", "/api/admin/system/verify-db");
      const data = await response.json();
      
      if (data.success) {
        showMessage(data.message, "success");
      } else {
        showMessage(data.message, "error");
      }
    } catch (error) {
      console.error("Erro ao verificar integridade do banco de dados:", error);
      showMessage("Erro ao verificar integridade do banco de dados", "error");
    } finally {
      setIsLoading(prev => ({ ...prev, verifyIntegrity: false }));
    }
  };

  const optimizeIndexes = async () => {
    try {
      setIsLoading(prev => ({ ...prev, optimizeIndices: true }));
      showMessage("Otimização de índices iniciada...");
      
      const response = await apiRequest("POST", "/api/admin/system/optimize-indexes");
      const data = await response.json();
      
      if (data.success) {
        showMessage(data.message, "success");
      } else {
        showMessage(data.message, "error");
      }
    } catch (error) {
      console.error("Erro ao otimizar índices:", error);
      showMessage("Erro ao otimizar índices", "error");
    } finally {
      setIsLoading(prev => ({ ...prev, optimizeIndices: false }));
    }
  };

  const clearCache = async () => {
    try {
      setIsLoading(prev => ({ ...prev, clearCache: true }));
      showMessage("Limpeza de cache iniciada...");
      
      const response = await apiRequest("POST", "/api/admin/system/clear-cache");
      const data = await response.json();
      
      if (data.success) {
        showMessage(data.message, "success");
      } else {
        showMessage(data.message, "error");
      }
    } catch (error) {
      console.error("Erro ao limpar cache:", error);
      showMessage("Erro ao limpar cache", "error");
    } finally {
      setIsLoading(prev => ({ ...prev, clearCache: false }));
    }
  };

  const rebuildIndexes = async () => {
    try {
      setIsLoading(prev => ({ ...prev, rebuildIndices: true }));
      showMessage("Reconstrução de índices iniciada...");
      
      const response = await apiRequest("POST", "/api/admin/system/rebuild-indexes");
      const data = await response.json();
      
      if (data.success) {
        showMessage(data.message, "success");
      } else {
        showMessage(data.message, "error");
      }
    } catch (error) {
      console.error("Erro ao reconstruir índices:", error);
      showMessage("Erro ao reconstruir índices", "error");
    } finally {
      setIsLoading(prev => ({ ...prev, rebuildIndices: false }));
    }
  };

  return (
    <Card className="shadow-md">
      <CardHeader className="bg-gradient-to-r from-primary-50 to-accent-50 border-b">
        <CardTitle className="flex items-center text-xl">
          <Wrench className="h-5 w-5 mr-2 text-primary" />
          <span className="text-primary">Manutenção do Sistema</span>
        </CardTitle>
        <CardDescription>
          Ferramentas de manutenção e otimização da plataforma
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-8">
          {/* Seção de informação */}
          <div className="p-4 bg-blue-50 border border-blue-100 rounded-md">
            <h3 className="text-blue-800 font-medium mb-2 flex items-center">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Informação
            </h3>
            <p className="text-sm text-blue-700">
              Estas ferramentas realizam operações de baixo nível no banco de dados. 
              É recomendado utilizá-las durante períodos de baixo tráfego na plataforma.
            </p>
          </div>

          {/* Verificação de Integridade */}
          <div>
            <h3 className="text-lg font-medium mb-3 flex items-center">
              <Database className="h-5 w-5 mr-2 text-primary" />
              Verificar Integridade
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Verifica a integridade do banco de dados PostgreSQL, garantindo que todas as tabelas e índices estejam consistentes.
            </p>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={verifyDatabaseIntegrity}
              disabled={isLoading.verifyIntegrity}
            >
              {isLoading.verifyIntegrity ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>Verificar Integridade</>
              )}
            </Button>
          </div>

          {/* Otimização de Índices */}
          <div>
            <h3 className="text-lg font-medium mb-3 flex items-center">
              <HardDrive className="h-5 w-5 mr-2 text-primary" />
              Otimizar Índices
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Otimiza os índices do banco de dados para melhorar o desempenho das consultas.
            </p>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={optimizeIndexes}
              disabled={isLoading.optimizeIndices}
            >
              {isLoading.optimizeIndices ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Otimizando...
                </>
              ) : (
                <>Otimizar Índices</>
              )}
            </Button>
          </div>

          {/* Limpeza de Cache */}
          <div>
            <h3 className="text-lg font-medium mb-3 flex items-center">
              <RefreshCw className="h-5 w-5 mr-2 text-primary" />
              Limpar Cache
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Limpa o cache do sistema, incluindo cache de consultas SQL e estatísticas.
            </p>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={clearCache}
              disabled={isLoading.clearCache}
            >
              {isLoading.clearCache ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Limpando...
                </>
              ) : (
                <>Limpar Cache</>
              )}
            </Button>
          </div>

          {/* Reconstrução de Índices */}
          <div>
            <h3 className="text-lg font-medium mb-3 flex items-center">
              <Database className="h-5 w-5 mr-2 text-primary" />
              Reconstruir Índices
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Reconstrói os índices de busca vetorial e os índices de pesquisa semântica.
            </p>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={rebuildIndexes}
              disabled={isLoading.rebuildIndices}
            >
              {isLoading.rebuildIndices ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reconstruindo...
                </>
              ) : (
                <>Reconstruir Índices</>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SystemMaintenance;