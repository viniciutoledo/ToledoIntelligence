// Função para gerar o código de embed completo (com opções de iframe)
const getFullEmbedCode = (widget: ChatWidget): EmbedCodeResult => {
  // Usamos TypeScript assertion para garantir que o tipo retornado é EmbedCodeResult
  return generateEmbedCode({
    apiKey: widget.api_key,
    position: "bottom-right",
    initialOpen: false,
    width: 350,
    height: 600,
    returnFullObject: true
  }) as EmbedCodeResult;
}

// Função para gerar o link direto para incorporação (estilo GPT Maker)
const getDirectEmbedLink = (widget: ChatWidget): string => {
  const embedUrl = `${window.location.origin}/embed/widget?key=${widget.api_key}`;
  const encodedUrl = encodeURIComponent(embedUrl);
  return `${window.location.origin}/embed?url=${encodedUrl}`;
}