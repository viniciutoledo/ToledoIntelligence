import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/hooks/use-language";
import { AuthProvider } from "@/hooks/use-auth";
import { WidgetChatProvider } from "@/hooks/use-widget-chat";
import { ThemeProvider } from "next-themes";
import { ProtectedRoute } from "@/lib/protected-route";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import ProfilePage from "@/pages/profile-page";
import TechnicianPage from "@/pages/technician-page";
import AdminPage from "@/pages/admin-page";
import SubscriptionPage from "@/pages/subscription-page";
import LandingPage from "@/pages/landing-page";
import CheckoutPage from "@/pages/checkout-page";
import CheckoutSuccessPage from "@/pages/checkout-success-page";
import CpanelLoginPage from "@/pages/cpanel-login-page";
import DiagnosticPage from "@/pages/diagnostic-page";
import WidgetEmbedPage from "@/pages/widget-embed";
import EmbedPage from "@/pages/embed";
import IframePage from "@/pages/iframe";
import WidgetDocsPage from "@/pages/widget-docs";
import ImageTestPage from "@/pages/image-test";
import TestsPage from "@/pages/tests-page";

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={LandingPage} />
      <Route path="/app" component={LandingPage} />
      <Route path="/home" component={LandingPage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/admin-login" component={CpanelLoginPage} />
      
      {/* Widget docs and embed routes */}
      <Route path="/widget-docs" component={WidgetDocsPage} />
      <Route path="/embed/widget" component={WidgetEmbedPage} />
      <Route path="/embed/iframe" component={IframePage} />
      <Route path="/embed/:apiKey" component={EmbedPage} />
      <Route path="/embed" component={EmbedPage} />
      
      {/* Checkout routes */}
      <ProtectedRoute path="/checkout" component={CheckoutPage} />
      <ProtectedRoute path="/checkout-success" component={CheckoutSuccessPage} />
      
      {/* Diagnostic tool - será removido após a correção */}
      <Route path="/diagnostic" component={DiagnosticPage} />
      
      {/* Image test page para diagnóstico de problemas com imagens */}
      <Route path="/image-test" component={ImageTestPage} />
      
      {/* Protected routes */}
      <ProtectedRoute path="/technician" component={TechnicianPage} roles={["technician", "admin"]} />
      <ProtectedRoute path="/admin" component={AdminPage} roles={["admin"]} />
      <ProtectedRoute path="/tests" component={TestsPage} roles={["admin"]} />
      <ProtectedRoute path="/subscription" component={SubscriptionPage} />
      <ProtectedRoute path="/dashboard" component={TechnicianPage} roles={["technician", "admin"]} />
      <ProtectedRoute path="/profile" component={ProfilePage} />
      
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
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <LanguageProvider>
          <AuthProvider>
            <WidgetChatProvider>
              <TooltipProvider>
                <Toaster />
                <Router />
              </TooltipProvider>
            </WidgetChatProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
