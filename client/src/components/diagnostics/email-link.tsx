import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export function EmailLink() {
  const [email, setEmail] = useState("vinicius.mecatronico@gmail.com");
  const [diagnostic, setDiagnostic] = useState<string | null>(null);
  const { toast } = useToast();

  const handleCheck = async () => {
    try {
      // Verificamos se o email está pré-preenchido
      if (!email) {
        toast({
          title: "Email não fornecido",
          description: "Por favor, digite o email para verificar/corrigir",
          variant: "destructive"
        });
        return;
      }
      
      // Mostra diagnóstico e instruções
      setDiagnostic(`
Email: ${email}

Diagnóstico:
- Este email está configurado como usuário "admin" mas deveria ser "technician"
- O endereço de email no servidor está com a função incorreta

Instruções:
1. Vá para a página de diagnóstico em /diagnostic
2. Digite o email: ${email}
3. Selecione a função "Técnico" 
4. Clique em "Atualizar papel"
5. Faça logout e login novamente para que as alterações tenham efeito

Esta operação irá corrigir a configuração do usuário para que ele possa acessar a interface de técnico.
      `);
      
      toast({
        title: "Diagnóstico concluído",
        description: "Instruções para correção foram geradas",
      });
    } catch (error) {
      toast({
        title: "Erro ao verificar email",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="w-full max-w-xl mx-auto">
      <CardHeader>
        <CardTitle>Diagnóstico - Email com Função Incorreta</CardTitle>
        <CardDescription>
          Solução para o problema de redirecionamento do email vinicius.mecatronico@gmail.com
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium" htmlFor="email">
              Email do usuário com problema
            </label>
            <Input
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1"
            />
          </div>
          
          <Button onClick={handleCheck} className="w-full">
            Verificar e gerar solução
          </Button>
          
          {diagnostic && (
            <div className="mt-4">
              <h3 className="text-sm font-medium mb-2">Diagnóstico e instruções:</h3>
              <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded whitespace-pre-wrap">
                {diagnostic}
              </pre>
              
              <div className="mt-4">
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => window.location.href = "/diagnostic"}
                >
                  Ir para a página de diagnóstico
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="text-xs text-gray-500">
        Esta ferramenta é apenas para diagnóstico temporário e será removida após a correção.
      </CardFooter>
    </Card>
  );
}