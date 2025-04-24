// Função para gerar o código de embed para o widget
export function generateEmbedCode(apiKey: string, options?: {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left',
  initialOpen?: boolean
}): string {
  const defaultOptions = {
    position: 'bottom-right',
    initialOpen: false
  };
  
  const mergedOptions = { ...defaultOptions, ...options };
  
  // Código HTML para incluir o script do widget
  const scriptTag = `<script src="${window.location.origin}/widget.js"></script>`;
  
  // Código JS para inicializar o widget
  const initScript = `<script>
  document.addEventListener('DOMContentLoaded', function() {
    // Inicializar o widget ToledoIA
    window.ToledoIAWidget.init({
      apiKey: "${apiKey}",
      position: "${mergedOptions.position}",
      initialOpen: ${mergedOptions.initialOpen}
    });
  });
</script>`;

  // Retorna os dois scripts combinados
  return `${scriptTag}\n${initScript}`;
}