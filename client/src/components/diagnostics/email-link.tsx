import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export function EmailLink() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  async function handleClearSessions() {
    try {
      setIsLoading(true);
      const response = await fetch('/api/fix-user-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, role: 'technician' }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Sucesso!",
          description: data.message,
        });
      } else {
        toast({
          title: "Erro",
          description: data.message || "Erro ao limpar sessões",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao limpar sessões. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Atualizar Papel e Limpar Sessões</CardTitle>
        <CardDescription>
          Esta ferramenta atualiza o papel do usuário para técnico e limpa 
          quaisquer sessões bloqueadas que possam estar impedindo o login.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-3">
              <Label htmlFor="email">Email do usuário</Label>
              <Input
                id="email"
                placeholder="usuario@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={handleClearSessions} 
                className="w-full" 
                disabled={!email || isLoading}
              >
                {isLoading ? "Atualizando..." : "Atualizar para Técnico"}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}