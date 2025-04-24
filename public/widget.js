/**
 * ToledoIA Widget Script
 * 
 * Este script permite incorporar o widget de chat do ToledoIA em qualquer site.
 * 
 * Para usar, inclua este script em seu site e inicialize o widget com sua chave API:
 * 
 * <script src="https://toledoia.replit.app/widget.js"></script>
 * <script>
 *   document.addEventListener('DOMContentLoaded', function() {
 *     ToledoIAWidget.init({ 
 *       apiKey: "sua-chave-api-aqui", 
 *       position: "bottom-right", 
 *       mode: "floating" // ou "inline" para incorporar diretamente em uma div
 *     });
 *   });
 * </script>
 * 
 * Para incorporar o widget diretamente em um elemento específico da página:
 * <div id="toledoia-container"></div>
 * <script>
 *   ToledoIAWidget.init({
 *     apiKey: "sua-chave-api-aqui",
 *     mode: "inline",
 *     targetElement: "#toledoia-container"
 *   });
 * </script>
 */

(function() {
  // Impedir múltiplas instâncias
  if (window.ToledoIAWidget) {
    console.warn('ToledoIA Widget já foi inicializado');
    return;
  }
  
  // Configurações padrão
  const defaultOptions = {
    apiKey: '',
    position: 'bottom-right',
    initialOpen: false,
    width: 350,
    height: 500,
    mode: 'floating', // 'floating' ou 'inline'
    targetElement: null
  };
  
  // Determinar o domínio base para o widget (em desenvolvimento ou produção)
  let BASE_URL = window.location.origin;
  
  // Verificar se estamos dentro de um iframe (como em um LMS)
  const isInIframe = window !== window.parent;
  if (isInIframe) {
    // Usar o location.ancestorOrigins se disponível
    if (window.location.ancestorOrigins && window.location.ancestorOrigins.length) {
      BASE_URL = window.location.ancestorOrigins[0];
    } else {
      // Fallback para casos onde ancestorOrigins não é suportado
      try {
        BASE_URL = window.parent.location.origin || window.location.origin;
      } catch (e) {
        // Se houver erro de segurança de cross-origin, usar o atual
        console.warn('ToledoIA Widget: Cross-origin issue, usando origem atual', e);
        BASE_URL = window.location.origin;
      }
    }
  }
  
  let widgetIframe = null;
  let widgetButton = null;
  let widgetIsOpen = false;
  let widgetOptions = { ...defaultOptions };
  
  // Criar o iframe para o widget
  function createWidgetIframe(options) {
    // Remover instâncias antigas se houver
    removeWidget();
    
    // Criar iframe
    widgetIframe = document.createElement('iframe');
    widgetIframe.style.border = 'none';
    widgetIframe.style.maxWidth = '100%';
    widgetIframe.style.maxHeight = '100%';
    widgetIframe.style.overflow = 'hidden';
    widgetIframe.setAttribute('allow', 'microphone');
    widgetIframe.setAttribute('allowtransparency', 'true');
    widgetIframe.setAttribute('title', 'ToledoIA Chat');
    
    // URL para a página de widget com a chave API
    widgetIframe.src = `${BASE_URL}/embed/widget?key=${options.apiKey}`;
    
    // Modo inline (incorporado diretamente em um elemento)
    if (options.mode === 'inline' && options.targetElement) {
      const targetEl = typeof options.targetElement === 'string' 
        ? document.querySelector(options.targetElement) 
        : options.targetElement;
        
      if (!targetEl) {
        console.error(`ToledoIA Widget: Elemento alvo '${options.targetElement}' não encontrado`);
        return;
      }
      
      // Configurar o iframe para preencher o elemento pai
      widgetIframe.style.width = '100%';
      widgetIframe.style.height = '100%';
      widgetIframe.style.position = 'relative';
      widgetIframe.style.borderRadius = '0';
      widgetIframe.style.boxShadow = 'none';
      
      // Adicionar ao elemento alvo
      targetEl.appendChild(widgetIframe);
      
      // No modo inline, o widget sempre está visível
      widgetIsOpen = true;
    } 
    // Modo flutuante (padrão)
    else {
      widgetIframe.style.position = 'fixed';
      widgetIframe.style.width = `${options.width}px`;
      widgetIframe.style.height = `${options.height}px`;
      widgetIframe.style.zIndex = '999999';
      widgetIframe.style.borderRadius = '8px';
      widgetIframe.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
      widgetIframe.style.transition = 'all 0.3s ease';
      
      // Posicionar o widget de acordo com a configuração
      if (options.position === 'bottom-right') {
        widgetIframe.style.right = '20px';
        widgetIframe.style.bottom = '20px';
      } else if (options.position === 'bottom-left') {
        widgetIframe.style.left = '20px';
        widgetIframe.style.bottom = '20px';
      } else if (options.position === 'top-right') {
        widgetIframe.style.right = '20px';
        widgetIframe.style.top = '20px';
      } else if (options.position === 'top-left') {
        widgetIframe.style.left = '20px';
        widgetIframe.style.top = '20px';
      }
      
      document.body.appendChild(widgetIframe);
      
      // Configurar visualização inicial
      if (options.initialOpen) {
        showWidget();
      } else {
        hideWidget();
      }
    }
    
    // Escutar mensagens do iframe
    window.addEventListener('message', handleIframeMessages);
  }
  
  // Lidar com mensagens do iframe
  function handleIframeMessages(event) {
    // Verificar origem para segurança
    if (event.origin !== BASE_URL) {
      return;
    }
    
    // Lidar com diferentes tipos de mensagens
    if (event.data === 'toledoia-widget-close' || event.data === 'toledoia-widget-minimize') {
      hideWidget();
    }
  }
  
  // Mostrar o widget
  function showWidget() {
    if (widgetIframe) {
      widgetIframe.style.display = 'block';
      widgetIsOpen = true;
      
      // Esconder o botão quando o widget estiver aberto
      if (widgetButton) {
        widgetButton.style.display = 'none';
      }
    }
  }
  
  // Esconder o widget
  function hideWidget() {
    if (widgetIframe) {
      widgetIframe.style.display = 'none';
      widgetIsOpen = false;
      
      // Mostrar o botão quando o widget estiver fechado
      createWidgetButton();
    }
  }
  
  // Criar o botão flutuante para abrir o widget
  function createWidgetButton() {
    // Se já existe um botão, apenas mostre-o
    if (widgetButton) {
      widgetButton.style.display = 'flex';
      return;
    }
    
    // Criar novo botão
    widgetButton = document.createElement('button');
    widgetButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
    widgetButton.style.position = 'fixed';
    widgetButton.style.width = '56px';
    widgetButton.style.height = '56px';
    widgetButton.style.borderRadius = '50%';
    widgetButton.style.backgroundColor = '#6366F1';
    widgetButton.style.color = 'white';
    widgetButton.style.border = 'none';
    widgetButton.style.cursor = 'pointer';
    widgetButton.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
    widgetButton.style.display = 'flex';
    widgetButton.style.alignItems = 'center';
    widgetButton.style.justifyContent = 'center';
    widgetButton.style.zIndex = '999998';
    widgetButton.style.transition = 'all 0.3s ease';
    
    // Posicionar o botão de acordo com a configuração
    if (widgetOptions.position === 'bottom-right') {
      widgetButton.style.right = '20px';
      widgetButton.style.bottom = '20px';
    } else if (widgetOptions.position === 'bottom-left') {
      widgetButton.style.left = '20px';
      widgetButton.style.bottom = '20px';
    } else if (widgetOptions.position === 'top-right') {
      widgetButton.style.right = '20px';
      widgetButton.style.top = '20px';
    } else if (widgetOptions.position === 'top-left') {
      widgetButton.style.left = '20px';
      widgetButton.style.top = '20px';
    }
    
    // Adicionar hover effect
    widgetButton.onmouseover = function() {
      this.style.transform = 'scale(1.1)';
    };
    widgetButton.onmouseout = function() {
      this.style.transform = 'scale(1)';
    };
    
    // Abrir o widget quando o botão for clicado
    widgetButton.onclick = function() {
      showWidget();
    };
    
    document.body.appendChild(widgetButton);
  }
  
  // Remover o widget e botão do DOM
  function removeWidget() {
    if (widgetIframe) {
      document.body.removeChild(widgetIframe);
      widgetIframe = null;
    }
    
    if (widgetButton) {
      document.body.removeChild(widgetButton);
      widgetButton = null;
    }
    
    // Remover o listener de mensagens
    window.removeEventListener('message', handleIframeMessages);
  }
  
  // Adaptar o widget às necessidades específicas de diferentes plataformas
  function detectHostingPlatform() {
    // Detectar se está em plataforma específica
    if (typeof window !== 'undefined') {
      const url = window.location.href.toLowerCase();
      
      // Verificando as URLs da plataforma mostrada nas imagens
      // (especialistatemplacas e outros sistemas)
      if (url.includes('especialistatemplacas') || 
          url.includes('lms.') || 
          url.includes('moodle') || 
          url.includes('course') || 
          url.includes('aula') || 
          url.includes('cursos')) {
        return 'lms';
      }
    }
    
    return 'generic';
  }
  
  // Ajustar configurações de acordo com a plataforma
  function adjustSettingsForPlatform(options) {
    const platform = detectHostingPlatform();
    let adjustedOptions = {...options};
    
    if (platform === 'lms') {
      // Em plataformas de ensino, usar modo inline por padrão
      if (!options.mode || options.mode === 'floating') {
        console.log('ToledoIA Widget: Detectada plataforma de ensino, usando modo inline');
        adjustedOptions.mode = 'inline';
        
        // Se não foi especificado um elemento alvo, tenta encontrar um apropriado
        if (!options.targetElement) {
          // Tenta encontrar um container onde o widget possa ser inserido
          const mainContent = document.querySelector('.main-content') || 
                             document.querySelector('.content') || 
                             document.querySelector('.course-content') ||
                             document.querySelector('main');
                             
          if (mainContent) {
            // Criar um container para o widget
            const widgetContainer = document.createElement('div');
            widgetContainer.id = 'toledoia-widget-container';
            widgetContainer.style.width = '100%';
            widgetContainer.style.height = '600px';
            widgetContainer.style.margin = '20px 0';
            widgetContainer.style.border = '1px solid #e1e1e1';
            widgetContainer.style.borderRadius = '8px';
            widgetContainer.style.overflow = 'hidden';
            
            // Inserir antes do fim do conteúdo principal
            mainContent.appendChild(widgetContainer);
            
            adjustedOptions.targetElement = '#toledoia-widget-container';
          }
        }
      }
    }
    
    return adjustedOptions;
  }
  
  // API pública
  window.ToledoIAWidget = {
    init: function(options) {
      if (!options || !options.apiKey) {
        console.error('ToledoIA Widget: API key é obrigatória');
        return;
      }
      
      // Mesclar opções fornecidas com as padrão
      widgetOptions = { ...defaultOptions, ...options };
      
      // Ajustar configurações para a plataforma atual
      widgetOptions = adjustSettingsForPlatform(widgetOptions);
      
      // Validar a posição para o modo flutuante
      if (widgetOptions.mode === 'floating' && 
          !['bottom-right', 'bottom-left', 'top-right', 'top-left'].includes(widgetOptions.position)) {
        console.warn('ToledoIA Widget: Posição inválida, usando bottom-right');
        widgetOptions.position = 'bottom-right';
      }
      
      // Configurar o modo inline
      if (widgetOptions.mode === 'inline') {
        // Se o targetElement for uma string sem # ou ., tentar encontrar por ID
        if (typeof widgetOptions.targetElement === 'string' && 
            !widgetOptions.targetElement.startsWith('#') && 
            !widgetOptions.targetElement.startsWith('.')) {
          widgetOptions.targetElement = '#' + widgetOptions.targetElement;
        }
      }
      
      // Criar o widget
      createWidgetIframe(widgetOptions);
    },
    
    open: function() {
      showWidget();
    },
    
    close: function() {
      hideWidget();
    },
    
    toggle: function() {
      if (widgetIsOpen) {
        hideWidget();
      } else {
        showWidget();
      }
    },
    
    remove: function() {
      removeWidget();
    }
  };
})();