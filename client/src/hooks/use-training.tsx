import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";

// Types
export type Document = {
  id: number;
  name: string;
  description: string | null;
  document_type: "text" | "file" | "website" | "video";
  content: string | null;
  file_path: string | null;
  file_url: string | null;
  website_url: string | null;
  image_url: string | null;
  file_metadata: Record<string, any> | null;
  status: "pending" | "processing" | "completed" | "error" | "indexed";
  error_message: string | null;
  progress: number | null;
  created_at: string;
  updated_at: string;
  created_by: number;
  is_active: boolean;
};

export type Category = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  created_by: number;
};

// Form data types
export type DocumentFormData = {
  name: string;
  description: string | null;
  document_type: "text" | "file" | "website" | "video" | "image";
  content?: string;
  website_url?: string;
  categories?: number[];
  file?: File;
  image?: File;
};

export type CategoryFormData = {
  name: string;
  description: string | null;
};

// Training hook
export function useTraining() {
  const { toast } = useToast();
  const { t } = useTranslation();

  // Documents
  const { 
    data: documents,
    isLoading: documentsLoading,
    isError: documentsError,
    refetch: refetchDocuments
  } = useQuery({
    queryKey: ["/api/training/documents"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/training/documents");
      const data = await res.json();
      return data as Document[];
    }
  });

  // Mutation genérica para documentos
  const createDocumentMutation = useMutation({
    mutationFn: async (document: DocumentFormData) => {
      const formData = new FormData();
      formData.append('name', document.name);
      
      if (document.description !== undefined) {
        formData.append('description', document.description !== null ? document.description : '');
      }
      
      formData.append('document_type', document.document_type);
      
      if (document.document_type === 'text' && document.content) {
        formData.append('content', document.content);
      }
      
      if (document.document_type === 'file' && document.file) {
        formData.append('file', document.file);
      }
      
      if (document.document_type === 'video' && document.file) {
        formData.append('file', document.file);
      }
      
      if (document.document_type === 'image' && document.image) {
        formData.append('file', document.image);
      }
      
      if (document.document_type === 'website' && document.website_url) {
        formData.append('website_url', document.website_url);
      }
      
      if (document.categories && document.categories.length > 0) {
        document.categories.forEach(categoryId => {
          formData.append('categories[]', categoryId.toString());
        });
      }
      
      // Usar fetch diretamente para upload de arquivos com FormData
      const res = await fetch("/api/training/documents", {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to create document");
      }
      
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Documento criado com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/training/documents"] });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutation específica para arquivos de documento
  const createDocumentFileMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/training/documents", {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to upload file");
      }
      
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: t("common.success"),
        description: t("admin.training.fileUploaded"),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/training/documents"] });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutation específica para textos
  const createTextDocumentMutation = useMutation({
    mutationFn: async (data: { name: string; content: string; description?: string | null }) => {
      const payload = {
        name: data.name,
        document_type: "text",
        content: data.content,
        description: data.description || null
      };
      
      const res = await apiRequest("POST", "/api/training/documents", payload);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Texto adicionado com sucesso para treinamento",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/training/documents"] });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutation específica para websites
  const createWebsiteDocumentMutation = useMutation({
    mutationFn: async (data: { name: string; website_url: string; description?: string | null }) => {
      const payload = {
        name: data.name,
        document_type: "website",
        website_url: data.website_url,
        description: data.description || null
      };
      
      const res = await apiRequest("POST", "/api/training/documents", payload);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Website adicionado com sucesso para treinamento",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/training/documents"] });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutation específica para vídeos
  const createVideoDocumentMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string | null; website_url?: string; file?: File }) => {
      // Se for um upload de arquivo
      if (data.file) {
        const formData = new FormData();
        formData.append('name', data.name);
        formData.append('document_type', 'video');
        formData.append('file', data.file);
        
        if (data.description) {
          formData.append('description', data.description);
        }
        
        const res = await fetch("/api/training/documents", {
          method: "POST",
          body: formData,
        });
        
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || "Failed to upload video");
        }
        
        return await res.json();
      } 
      // Se for um link de vídeo
      else if (data.website_url) {
        const payload = {
          name: data.name,
          document_type: "video",
          website_url: data.website_url,
          description: data.description || null
        };
        
        const res = await apiRequest("POST", "/api/training/documents", payload);
        return await res.json();
      }
      
      throw new Error("Either a file or website URL must be provided");
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Vídeo adicionado com sucesso para treinamento",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/training/documents"] });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Mutation específica para arquivos de documento (PDF, DOCX, etc)
  const createFileDocumentMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/training/documents", {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to upload document");
      }
      
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Arquivo adicionado com sucesso para treinamento",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/training/documents"] });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Mutation específica para imagens
  const createImageDocumentMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string | null; image?: File }) => {
      // Se for um upload de arquivo de imagem
      if (data.image) {
        const formData = new FormData();
        formData.append('name', data.name);
        formData.append('document_type', 'image');
        formData.append('file', data.image);
        
        if (data.description) {
          formData.append('description', data.description);
        }
        
        const res = await fetch("/api/training/documents", {
          method: "POST",
          body: formData,
          credentials: "include" // Importante para manter a sessão de autenticação
        });
        
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || "Falha ao enviar imagem");
        }
        
        return await res.json();
      }
      
      throw new Error("Uma imagem é obrigatória");
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Imagem adicionada com sucesso para treinamento",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/training/documents"] });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const updateDocumentMutation = useMutation({
    mutationFn: async (data: { id: number; document: Partial<DocumentFormData> & { image?: File } }) => {
      // Verificar se há uma imagem ou outros arquivos para upload
      if (data.document.image) {
        console.log("Preparando upload de imagem para documento:", data.id);
        
        // Usar FormData para enviar arquivos
        const formData = new FormData();
        
        // Adicionar todos os campos como string
        if (data.document.name) formData.append('name', data.document.name);
        if (data.document.description !== undefined) 
          formData.append('description', data.document.description !== null ? data.document.description : '');
        if (data.document.content) formData.append('content', data.document.content);
        if (data.document.website_url) formData.append('website_url', data.document.website_url);
        
        // Adicionar o arquivo de imagem
        formData.append('image', data.document.image);
        
        console.log("Enviando FormData com imagem");
        
        // Usar fetch diretamente para upload com FormData
        const res = await fetch(`/api/training/documents/${data.id}`, {
          method: "PATCH",
          body: formData,
          credentials: "include" // Importante para manter a sessão de autenticação
        });
        
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || "Falha ao atualizar documento com imagem");
        }
        
        return await res.json();
      } else {
        // Sem arquivos: usar API request normal
        console.log("Atualizando documento sem imagem:", data.id);
        const res = await apiRequest("PATCH", `/api/training/documents/${data.id}`, data.document);
        return await res.json();
      }
    },
    onSuccess: (data) => {
      console.log("Documento atualizado com sucesso:", data);
      toast({
        title: "Sucesso",
        description: "Documento atualizado com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/training/documents"] });
    },
    onError: (error: Error) => {
      console.error("Erro ao atualizar documento:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar documento",
        variant: "destructive",
      });
    }
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/training/documents/${id}`);
      // Resposta 204 não tem corpo, então não tentamos analisar como JSON
      if (res.status === 204) {
        return {};
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Documento excluído com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/training/documents"] });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Categories
  const {
    data: categories,
    isLoading: categoriesLoading,
    isError: categoriesError,
    refetch: refetchCategories
  } = useQuery({
    queryKey: ["/api/training/categories"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/training/categories");
      const data = await res.json();
      return data as Category[];
    }
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (category: CategoryFormData) => {
      const payload = {
        name: category.name,
        description: category.description !== undefined ? category.description : null
      };
      
      const res = await apiRequest("POST", "/api/training/categories", payload);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Categoria criada com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/training/categories"] });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async (data: { id: number; category: Partial<CategoryFormData> }) => {
      const res = await apiRequest("PATCH", `/api/training/categories/${data.id}`, data.category);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Categoria atualizada com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/training/categories"] });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/training/categories/${id}`);
      // Resposta 204 não tem corpo, então não tentamos analisar como JSON
      if (res.status === 204) {
        return {};
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Categoria excluída com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/training/categories"] });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Document Categories
  const getDocumentCategories = async (documentId: number) => {
    const res = await apiRequest("GET", `/api/training/documents/${documentId}/categories`);
    return await res.json() as Category[];
  };

  const addDocumentToCategory = async (documentId: number, categoryId: number) => {
    const res = await apiRequest("POST", `/api/training/documents/${documentId}/categories/${categoryId}`);
    queryClient.invalidateQueries({ queryKey: ["/api/training/documents"] });
    queryClient.invalidateQueries({ queryKey: ["/api/training/categories"] });
    return await res.json();
  };

  const removeDocumentFromCategory = async (documentId: number, categoryId: number) => {
    const res = await apiRequest("DELETE", `/api/training/documents/${documentId}/categories/${categoryId}`);
    queryClient.invalidateQueries({ queryKey: ["/api/training/documents"] });
    queryClient.invalidateQueries({ queryKey: ["/api/training/categories"] });
    
    // Resposta 204 não tem corpo, então não tentamos analisar como JSON
    if (res.status === 204) {
      return {};
    }
    return await res.json();
  };

  // Mutation para processamento de embeddings
  const processEmbeddingsMutation = useMutation({
    mutationFn: async (documentId?: number) => {
      const payload = documentId ? { documentId } : {};
      const res = await apiRequest("POST", "/api/training/process-embeddings", payload);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Sucesso",
        description: data.message || "Embeddings processados com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/training/documents"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao processar embeddings",
        variant: "destructive",
      });
    }
  });
  
  // Mutation para resetar o status de documentos com erro
  const resetDocumentStatusMutation = useMutation({
    mutationFn: async (documentId: number) => {
      const res = await apiRequest("POST", "/api/training/reset-document-status", { documentId });
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Sucesso",
        description: data.message || "Status do documento resetado com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/training/documents"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao resetar status do documento",
        variant: "destructive",
      });
    }
  });

  return {
    // Documents
    documents,
    documentsLoading,
    documentsError,
    refetchDocuments,
    createDocumentMutation,
    createDocumentFileMutation,
    createTextDocumentMutation,
    createWebsiteDocumentMutation,
    createVideoDocumentMutation,
    createFileDocumentMutation,
    createImageDocumentMutation,
    updateDocumentMutation,
    deleteDocumentMutation,
    
    // Categories
    categories,
    categoriesLoading,
    categoriesError,
    refetchCategories,
    createCategoryMutation,
    updateCategoryMutation,
    deleteCategoryMutation,
    
    // Document Categories
    getDocumentCategories,
    addDocumentToCategory,
    removeDocumentFromCategory,
    
    // Embeddings
    processEmbeddingsMutation,
    resetDocumentStatusMutation
  };
}