import { RoleFixTool } from "@/components/diagnostics/role-fix-tool";

export default function DiagnosticPage() {
  return (
    <div className="container py-10 space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Ferramentas de Diagnóstico</h1>
        <p className="text-muted-foreground mt-2">
          Estas ferramentas são apenas para fins de diagnóstico e devem ser removidas após a solução dos problemas.
        </p>
      </div>
      
      <div className="grid gap-8">
        <RoleFixTool />
      </div>
    </div>
  );
}