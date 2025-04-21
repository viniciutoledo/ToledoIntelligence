import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/hooks/use-language";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import TechnicianPage from "@/pages/technician-page";
import AdminPage from "@/pages/admin-page";
import SubscriptionPage from "@/pages/subscription-page";

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/auth" component={AuthPage} />
      
      {/* Protected routes */}
      <ProtectedRoute path="/technician" component={TechnicianPage} roles={["technician"]} />
      <ProtectedRoute path="/admin" component={AdminPage} roles={["admin"]} />
      <ProtectedRoute path="/subscription" component={SubscriptionPage} />
      
      {/* Subscription success/cancel pages */}
      <ProtectedRoute 
        path="/subscription/success" 
        component={() => (
          <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <h1 className="text-3xl font-bold mb-4 text-green-600">Assinatura confirmada!</h1>
            <p className="text-lg mb-6 text-center">
              Sua assinatura foi ativada com sucesso. Você agora tem acesso a todos os recursos do plano.
            </p>
            <a 
              href="/technician"
              className="bg-primary text-white px-6 py-2 rounded-md hover:bg-primary/90 transition-colors"
            >
              Ir para a plataforma
            </a>
          </div>
        )} 
      />
      
      <ProtectedRoute 
        path="/subscription/cancel" 
        component={() => (
          <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <h1 className="text-3xl font-bold mb-4 text-amber-600">Assinatura não concluída</h1>
            <p className="text-lg mb-6 text-center">
              O processo de assinatura foi cancelado. Você pode tentar novamente quando estiver pronto.
            </p>
            <a 
              href="/subscription"
              className="bg-primary text-white px-6 py-2 rounded-md hover:bg-primary/90 transition-colors"
            >
              Voltar para planos
            </a>
          </div>
        )} 
      />
      
      {/* Root redirect */}
      <Route path="/">
        {() => {
          // This will redirect to the auth page by default
          window.location.href = "/auth";
          return null;
        }}
      </Route>
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
