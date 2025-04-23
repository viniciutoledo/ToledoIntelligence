import { RoleFixTool } from "@/components/diagnostics/role-fix-tool";
import { EmailLink } from "@/components/diagnostics/email-link";

export default function DiagnosticPage() {
  return (
    <div className="container py-10 space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Ferramentas de Diagnóstico</h1>
        <p className="text-muted-foreground mt-2">
          Estas ferramentas são apenas para fins de diagnóstico e devem ser removidas após a solução dos problemas.
        </p>
        <div className="mt-4 flex justify-center gap-4">
          <a 
            href="/auth" 
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
          >
            Ir para página de login
          </a>
          <button 
            onClick={async () => {
              try {
                await fetch('/api/logout', { method: 'POST' });
                window.location.href = '/auth';
              } catch (error) {
                console.error('Erro ao fazer logout:', error);
              }
            }}
            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-medium"
          >
            Fazer logout
          </button>
        </div>
      </div>
      
      <div className="grid gap-8">
        <EmailLink />
        <RoleFixTool />
        
        <div className="text-center p-4 border border-yellow-400 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800 rounded-lg">
          <p className="font-medium text-yellow-800 dark:text-yellow-200">Instruções para resolver o problema</p>
          <ol className="text-left mt-2 text-sm list-decimal pl-5 text-yellow-700 dark:text-yellow-300 space-y-1">
            <li>Primeiro, limpe as sessões ativas do usuário vinicius.mecatronico@gmail.com usando a ferramenta "Limpar Sessões Ativas" acima.</li>
            <li>Em seguida, use a ferramenta "Mudar Papel do Usuário" para configurar o papel como 'technician'.</li>
            <li>Faça logout (usando o botão acima) caso já esteja logado com esta conta.</li>
            <li>Faça login novamente na página de autenticação com as credenciais do usuário.</li>
            <li>Agora o usuário deverá ser redirecionado corretamente para a interface de técnico (chat).</li>
          </ol>
        </div>
      </div>
    </div>
  );
}