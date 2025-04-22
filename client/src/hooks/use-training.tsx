import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";

// Types
type Document = {
  id: number;
  name: string;
  description: string | null;
  document_type: "text" | "file" | "website";
  content: string | null;
  file_url: string | null;
  website_url: string | null;
  status: "pending" | "processing" | "completed" | "error";
  error_message: string | null;
  created_at: string;
  updated_at: string;
  created_by: number;
  is_active: boolean;
};

type Category = {
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
  document_type: "text" | "file" | "website";
  content?: string | null;
  file_url?: string | null;
  website_url?: string | null;
  categories?: number[];
  file?: File;
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

  const createDocumentMutation = useMutation({
    mutationFn: async (document: DocumentFormData) => {
      const formData = new FormData();
      formData.append('name', document.name);
      
      if (document.description) {
        formData.append('description', document.description);
      }
      
      formData.append('document_type', document.document_type);
      
      if (document.document_type === 'text' && document.content) {
        formData.append('content', document.content);
      }
      
      if (document.document_type === 'file' && document.file) {
        formData.append('file', document.file);
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
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: t("common.success"),
        description: t("admin.training.documentCreated"),
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
    mutationFn: async (data: { id: number; document: Partial<DocumentFormData> }) => {
      const res = await apiRequest("PATCH", `/api/training/documents/${data.id}`, data.document);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: t("common.success"),
        description: t("admin.training.documentUpdated"),
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

  const deleteDocumentMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/training/documents/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: t("common.success"),
        description: t("admin.training.documentDeleted"),
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
      const res = await apiRequest("POST", "/api/training/categories", category);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: t("common.success"),
        description: t("admin.training.categoryCreated"),
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
        title: t("common.success"),
        description: t("admin.training.categoryUpdated"),
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
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: t("common.success"),
        description: t("admin.training.categoryDeleted"),
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
    return await res.json();
  };

  return {
    // Documents
    documents,
    documentsLoading,
    documentsError,
    refetchDocuments,
    createDocumentMutation,
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
    removeDocumentFromCategory
  };
}