// Interface para as opções do widget
export interface WidgetOptions {
  apiKey: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  initialOpen?: boolean;
  width?: number;
  height?: number;
  returnFullObject?: boolean; // Indica se deve retornar o objeto completo ou apenas o código de script
}

// Interface para o resultado de generateEmbedCode
export interface EmbedCodeResult {
  scriptCode: string;       // Código de script para incorporação via JavaScript
  iframeCode: string;       // Código HTML para incorporação via iframe
  directLink: string;       // Link direto para incorporação em um iframe
  embedUrl: string;         // URL de embed para uso em links
}

// Função para gerar o código de embed para o widget
export function generateEmbedCode(options: WidgetOptions): string | EmbedCodeResult {
  const defaultOptions = {
    position: 'bottom-right',
    initialOpen: false,
    width: 350,
    height: 600
  };
  
  const mergedOptions = { ...defaultOptions, ...options };
  
  // URL base da aplicação
  const baseUrl = window.location.origin;
  
  // Código HTML para incluir o script do widget
  const scriptTag = `<script src="${baseUrl}/widget.js"></script>`;
  
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

  // Código de script combinado 
  const scriptCode = `${scriptTag}\n${initScript}`;
  
  // URL para embedar o widget diretamente via iframe
  const embedUrl = `${baseUrl}/embed/widget?key=${mergedOptions.apiKey}`;
  
  // URL encodada para uso como parâmetro
  const encodedUrl = encodeURIComponent(embedUrl);
  
  // Link direto para incorporação semelhante ao GPT Maker
  const directLink = `${baseUrl}/embed?url=${encodedUrl}`;
  
  // Código HTML de iframe para incorporação direta
  const iframeCode = `<iframe 
  src="${embedUrl}" 
  width="${mergedOptions.width}" 
  height="${mergedOptions.height}" 
  frameborder="0" 
  allow="microphone"
  style="border: none; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);"
></iframe>`;

  // Se o chamador espera apenas a string, mantém a compatibilidade retornando o scriptCode
  if (typeof options === 'object' && 'returnFullObject' in options && options.returnFullObject) {
    return {
      scriptCode,
      iframeCode,
      directLink,
      embedUrl
    };
  }
  
  // Para manter compatibilidade com código existente
  return scriptCode;
}