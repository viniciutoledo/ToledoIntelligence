import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export function RoleFixTool() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"technician" | "admin">("technician");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFix = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: "Email é obrigatório",
        description: "Por favor, insira o email do usuário a ser atualizado",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    setResult(null);
    
    try {
      const res = await apiRequest("POST", "/api/fix-user-role", { email, role });
      const data = await res.json();
      
      toast({
        title: "Função atualizada com sucesso",
        description: `Usuário ${email} agora tem função: ${role}`,
      });
      
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      toast({
        title: "Erro ao atualizar função",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-xl mx-auto">
      <CardHeader>
        <CardTitle>Ferramenta de Diagnóstico - Correção de Papel</CardTitle>
        <CardDescription>
          Use esta ferramenta para corrigir o papel (role) de um usuário específico.
          Esta é uma ferramenta temporária para fins de diagnóstico.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleFix} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email do usuário</Label>
            <Input
              id="email"
              placeholder="email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="role">Novo papel</Label>
            <Select value={role} onValueChange={(value: "technician" | "admin") => setRole(value)}>
              <SelectTrigger id="role">
                <SelectValue placeholder="Selecione o papel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="technician">Técnico</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? "Processando..." : "Atualizar papel"}
          </Button>
        </form>
        
        {result && (
          <div className="mt-4">
            <h3 className="text-sm font-medium mb-2">Resultado:</h3>
            <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-auto max-h-40">
              {result}
            </pre>
          </div>
        )}
      </CardContent>
      <CardFooter className="text-xs text-gray-500">
        Esta ferramenta deve ser usada apenas durante a fase de diagnóstico e solução de problemas.
      </CardFooter>
    </Card>
  );
}