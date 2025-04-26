import { ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

/**
 * Componente que fornece um link para a documentação de integração de widgets
 * Usado no painel administrativo para facilitar o acesso à documentação
 */
export function WidgetDocsLink() {
  const { t } = useTranslation();
  
  return (
    <div className="bg-white rounded-lg shadow-sm border p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <FileText className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-medium">{t("widgets.documentation.title", "Documentação de Integração")}</h3>
        </div>
        
        <Button 
          variant="outline"
          size="sm"
          onClick={() => window.open('/widget-embedding-guide.html', '_blank')}
          className="flex items-center"
        >
          <span>{t("widgets.documentation.view", "Ver Documentação")}</span>
          <ExternalLink className="ml-1 h-4 w-4" />
        </Button>
      </div>
      
      <p className="mt-2 text-sm text-gray-600">
        {t(
          "widgets.documentation.description", 
          "Consulte nossa documentação completa para integrar o widget ToledoIA em outros sites, plataformas LMS como Curseduca, e mais."
        )}
      </p>
    </div>
  );
}