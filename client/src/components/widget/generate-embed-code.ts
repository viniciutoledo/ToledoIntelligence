// Interface para as opções do widget
export interface WidgetOptions {
  apiKey: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  initialOpen?: boolean;
  width?: number;
  height?: number;
}

// Função para gerar o código de embed para o widget
export function generateEmbedCode(options: WidgetOptions): string {
  const defaultOptions = {
    position: 'bottom-right',
    initialOpen: false,
    width: 350,
    height: 500
  };
  
  const mergedOptions = { ...defaultOptions, ...options };
  
  // Código HTML para incluir o script do widget
  const scriptTag = `<script src="${window.location.origin}/widget.js"></script>`;
  
  // Código JS para inicializar o widget
  const initScript = `<script>
  document.addEventListener('DOMContentLoaded', function() {
    // Inicializar o widget ToledoIA
    window.ToledoIAWidget.init({
      apiKey: "${mergedOptions.apiKey}",
      position: "${mergedOptions.position}",
      initialOpen: ${mergedOptions.initialOpen},
      width: ${mergedOptions.width},
      height: ${mergedOptions.height}
    });
  });
</script>`;

  // Retorna os dois scripts combinados
  return `${scriptTag}\n${initScript}`;
}