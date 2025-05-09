import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

// Schema para validação do formulário
const imageAnalysisSchema = z.object({
  image: z.instanceof(FileList).refine(files => files.length > 0, {
    message: "Uma imagem é obrigatória.",
  }),
  description: z.string().optional(),
});

// Tipo inferido do schema
type ImageAnalysisFormValues = z.infer<typeof imageAnalysisSchema>;

// Componente de teste de análise de imagem
export function ImageAnalysisTest() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Configuração do formulário com React Hook Form
  const form = useForm<ImageAnalysisFormValues>({
    resolver: zodResolver(imageAnalysisSchema),
    defaultValues: {
      description: "",
    },
  });
  
  // Função para lidar com o envio do formulário
  const onSubmit = async (data: ImageAnalysisFormValues) => {
    try {
      setIsLoading(true);
      setAnalysisResult(null);
      
      const formData = new FormData();
      formData.append("image", data.image[0]);
      
      if (data.description) {
        formData.append("description", data.description);
      }
      
      // Chamada à API
      const response = await apiRequest("POST", "/api/admin/test/image-analysis", formData);
      const result = await response.json();
      
      if (result.success) {
        setAnalysisResult(result.analysis);
        toast({
          title: "Análise concluída",
          description: "A imagem foi analisada com sucesso.",
        });
      } else {
        toast({
          title: "Erro na análise",
          description: result.message || "Ocorreu um erro ao analisar a imagem.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Erro ao analisar imagem:", error);
      toast({
        title: "Erro",
        description: "Não foi possível analisar a imagem. Verifique o console para mais detalhes.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handler para prévia da imagem
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Teste de Análise de Imagem com Descrição</CardTitle>
        <CardDescription>
          Faça upload de uma imagem de placa de circuito e opcionalmente forneça uma descrição para
          ver como a descrição contextual melhora a análise dos modelos de IA.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="image"
              render={({ field: { onChange, value, ...field } }) => (
                <FormItem>
                  <FormLabel>Imagem da Placa de Circuito</FormLabel>
                  <FormControl>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        onChange(e.target.files);
                        handleImageChange(e);
                      }}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Selecione uma imagem de placa de circuito para análise (JPG, PNG, GIF, WebP).
                  </FormDescription>
                  <FormMessage />
                  
                  {imagePreview && (
                    <div className="mt-2">
                      <p className="text-sm text-muted-foreground mb-1">Prévia da imagem:</p>
                      <img 
                        src={imagePreview} 
                        alt="Prévia da imagem" 
                        className="max-w-md max-h-48 object-contain border rounded-md" 
                      />
                    </div>
                  )}
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva o que você vê na imagem ou o problema específico que está buscando analisar..."
                      className="min-h-24"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Uma descrição contextual pode ajudar os modelos de IA a focar em aspectos específicos da imagem.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analisando...
                </>
              ) : (
                "Analisar Imagem"
              )}
            </Button>
          </form>
        </Form>
        
        {/* Exibição do resultado da análise */}
        {analysisResult && (
          <div className="mt-6">
            <h3 className="text-lg font-medium mb-2">Resultado da Análise:</h3>
            <div className="bg-secondary p-4 rounded-md text-sm whitespace-pre-wrap">
              {analysisResult}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}