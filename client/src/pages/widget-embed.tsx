import { useEffect, useState } from "react";
import { EmbeddedChat } from "@/components/widget/embedded-chat";
import { useSearchParams } from "wouter/use-location";

export default function WidgetEmbedPage() {
  const params = useSearchParams();
  const apiKey = params.get("apiKey") || "";
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (apiKey) {
      setInitialized(true);
    }
  }, [apiKey]);

  if (!apiKey) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 bg-background text-foreground">
        <div className="text-center">
          <h3 className="font-bold text-lg mb-2">API Key não encontrada</h3>
          <p className="text-sm text-muted-foreground">
            É necessário fornecer uma API Key válida para inicializar o widget.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-background text-foreground">
      {initialized && <EmbeddedChat apiKey={apiKey} initialOpen={true} />}
    </div>
  );
}