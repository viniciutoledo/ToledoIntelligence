/**
 * Gera o código de script para embedar o widget de chat
 */
interface WidgetConfigOptions {
  apiKey: string;
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  initialOpen?: boolean;
  width?: number;
  height?: number;
}

export const generateEmbedCode = (options: WidgetConfigOptions): string => {
  const {
    apiKey,
    position = "bottom-right",
    initialOpen = false,
    width = 350,
    height = 600
  } = options;

  // Escapa as aspas simples para evitar problemas no HTML
  const escapedApiKey = apiKey.replace(/'/g, "\\'");

  return `<!-- ToledoIA Chat Widget -->
<div id="toledoia-chat-widget"></div>
<script>
  (function() {
    // Configurações do Widget
    var widgetConfig = {
      apiKey: '${escapedApiKey}',
      position: '${position}',
      initialOpen: ${initialOpen},
      width: ${width},
      height: ${height}
    };

    // Cria o elemento de script
    var script = document.createElement('script');
    script.src = '${window.location.origin}/widget.js';
    script.async = true;
    script.onload = function() {
      // Inicializa o widget quando o script for carregado
      if (window.ToledoIAWidget) {
        window.ToledoIAWidget.init(widgetConfig);
      }
    };

    // Adiciona o script à página
    document.head.appendChild(script);
  })();
</script>
<!-- Fim do ToledoIA Chat Widget -->`;
};

/**
 * Gera o código JavaScript para o arquivo widget.js que será servido estaticamente
 */
export const generateWidgetJsCode = (): string => {
  return `window.ToledoIAWidget = (function() {
  // Container principal do widget
  var widgetContainer = null;
  
  // Configurações padrão
  var defaultConfig = {
    apiKey: '',
    position: 'bottom-right',
    initialOpen: false,
    width: 350,
    height: 600
  };
  
  // Inicializa o widget
  function init(config) {
    // Mescla as configurações fornecidas com as padrão
    var widgetConfig = Object.assign({}, defaultConfig, config);
    
    if (!widgetConfig.apiKey) {
      console.error('ToledoIA Widget: API key não fornecida');
      return;
    }
    
    // Verifica se o widget já foi inicializado
    if (widgetContainer) {
      console.warn('ToledoIA Widget: Widget já inicializado');
      return;
    }
    
    // Cria o iframe para o widget
    createWidgetIframe(widgetConfig);
  }
  
  // Cria o iframe que conterá o widget
  function createWidgetIframe(config) {
    // Cria o container
    widgetContainer = document.createElement('div');
    widgetContainer.id = 'toledoia-chat-widget-container';
    widgetContainer.style.position = 'fixed';
    widgetContainer.style.zIndex = '9999';
    
    // Define a posição baseado na configuração
    switch (config.position) {
      case 'bottom-right':
        widgetContainer.style.bottom = '20px';
        widgetContainer.style.right = '20px';
        break;
      case 'bottom-left':
        widgetContainer.style.bottom = '20px';
        widgetContainer.style.left = '20px';
        break;
      case 'top-right':
        widgetContainer.style.top = '20px';
        widgetContainer.style.right = '20px';
        break;
      case 'top-left':
        widgetContainer.style.top = '20px';
        widgetContainer.style.left = '20px';
        break;
      default:
        widgetContainer.style.bottom = '20px';
        widgetContainer.style.right = '20px';
    }
    
    // Cria o botão flutuante
    var chatButton = document.createElement('div');
    chatButton.id = 'toledoia-chat-button';
    chatButton.style.width = '60px';
    chatButton.style.height = '60px';
    chatButton.style.borderRadius = '50%';
    chatButton.style.backgroundColor = '#6366F1';
    chatButton.style.color = 'white';
    chatButton.style.display = 'flex';
    chatButton.style.alignItems = 'center';
    chatButton.style.justifyContent = 'center';
    chatButton.style.cursor = 'pointer';
    chatButton.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
    chatButton.style.transition = 'all 0.3s ease';
    chatButton.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 11.5C21.0034 12.8199 20.6951 14.1219 20.1 15.3C19.3944 16.7118 18.3098 17.8992 16.9674 18.7293C15.6251 19.5594 14.0782 19.9994 12.5 20C11.1801 20.0035 9.87812 19.6951 8.7 19.1L3 21L4.9 15.3C4.30493 14.1219 3.99656 12.8199 4 11.5C4.00061 9.92179 4.44061 8.37488 5.27072 7.03258C6.10083 5.69028 7.28825 4.6056 8.7 3.90003C9.87812 3.30496 11.1801 2.99659 12.5 3.00003H13C15.0843 3.11502 17.053 3.99479 18.5291 5.47089C20.0052 6.94699 20.885 8.91568 21 11V11.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    
    // Cria o iframe
    var iframe = document.createElement('iframe');
    iframe.id = 'toledoia-chat-iframe';
    iframe.src = '${window.location.origin}/widget-embed?apiKey=' + encodeURIComponent(config.apiKey);
    iframe.style.width = config.width + 'px';
    iframe.style.height = config.height + 'px';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '10px';
    iframe.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)';
    iframe.style.display = 'none';
    
    // Adiciona os elementos ao container
    widgetContainer.appendChild(chatButton);
    widgetContainer.appendChild(iframe);
    
    // Adiciona o container à página
    document.body.appendChild(widgetContainer);
    
    // Abre o chat se initialOpen for true
    if (config.initialOpen) {
      iframe.style.display = 'block';
      chatButton.style.display = 'none';
    }
    
    // Adiciona evento de clique no botão
    chatButton.addEventListener('click', function() {
      iframe.style.display = 'block';
      chatButton.style.display = 'none';
    });
    
    // Configura comunicação entre iframe e a página pai
    window.addEventListener('message', function(event) {
      if (event.data === 'toledoia-widget-close') {
        iframe.style.display = 'none';
        chatButton.style.display = 'flex';
      }
    });
  }
  
  // Métodos públicos
  return {
    init: init
  };
})();`;
};