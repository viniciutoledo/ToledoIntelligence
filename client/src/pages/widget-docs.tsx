import { useEffect } from 'react';
import { useLocation } from 'wouter';

// Esta página simplesmente redireciona para o exemplo de incorporação do widget
export default function WidgetDocsPage() {
  const [, navigate] = useLocation();

  useEffect(() => {
    // Redirecionar para a página de exemplo de incorporação do widget
    window.location.href = '/widget-embed-example.html';
  }, [navigate]);

  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <p className="text-center text-lg text-muted-foreground">
        Redirecionando para a documentação do widget...
      </p>
    </div>
  );
}