import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
  UseMutationResult,
} from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type TrainingDocument = {
  id: number;
  name: string;
  description: string | null;
  document_type: "text" | "file" | "website";
  content: string | null;
  file_url: string | null;
  website_url: string | null;
  created_at: string;
  updated_at: string;
  created_by: number;
  status: "pending" | "processing" | "completed" | "error";
  is_active: boolean;
  error_message: string | null;
};

type TrainingCategory = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  created_by: number;
};

type DocumentCategory = {
  id: number;
  document_id: number;
  category_id: number;
  created_at: string;
};

type CreateDocumentData = {
  name: string;
  description?: string;
  document_type: "text" | "file" | "website";
  content?: string;
  file?: File;
  website_url?: string;
  categories?: number[];
};

type CreateCategoryData = {
  name: string;
  description?: string;
};

type UpdateDocumentData = {
  id: number;
  name?: string;
  description?: string;
};

type UpdateCategoryData = {
  id: number;
  name?: string;
  description?: string;
};

interface TrainingContextType {
  documents: TrainingDocument[] | undefined;
  documentsLoading: boolean;
  categories: TrainingCategory[] | undefined;
  categoriesLoading: boolean;
  createDocumentMutation: UseMutationResult<TrainingDocument, Error, CreateDocumentData>;
  updateDocumentMutation: UseMutationResult<TrainingDocument, Error, UpdateDocumentData>;
  deleteDocumentMutation: UseMutationResult<void, Error, number>;
  createCategoryMutation: UseMutationResult<TrainingCategory, Error, CreateCategoryData>;
  updateCategoryMutation: UseMutationResult<TrainingCategory, Error, UpdateCategoryData>;
  deleteCategoryMutation: UseMutationResult<void, Error, number>;
  addDocumentToCategoryMutation: UseMutationResult<DocumentCategory, Error, { documentId: number; categoryId: number }>;
  removeDocumentFromCategoryMutation: UseMutationResult<void, Error, { documentId: number; categoryId: number }>;
  getDocumentCategories: (documentId: number) => Promise<TrainingCategory[]>;
  getCategoryDocuments: (categoryId: number) => Promise<TrainingDocument[]>;
}

export const TrainingContext = createContext<TrainingContextType | null>(null);

export function TrainingProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: documents,
    isLoading: documentsLoading,
  } = useQuery<TrainingDocument[]>({
    queryKey: ["/api/training/documents"],
    staleTime: 30000,
  });

  const {
    data: categories,
    isLoading: categoriesLoading,
  } = useQuery<TrainingCategory[]>({
    queryKey: ["/api/training/categories"],
    staleTime: 30000,
  });

  const createDocumentMutation = useMutation<TrainingDocument, Error, CreateDocumentData>({
    mutationFn: async (data) => {
      const formData = new FormData();
      formData.append("name", data.name);
      if (data.description) formData.append("description", data.description);
      formData.append("document_type", data.document_type);
      
      if (data.document_type === "text" && data.content) {
        formData.append("content", data.content);
      } else if (data.document_type === "file" && data.file) {
        formData.append("file", data.file);
      } else if (data.document_type === "website" && data.website_url) {
        formData.append("website_url", data.website_url);
      }
      
      if (data.categories && data.categories.length > 0) {
        formData.append("categories", JSON.stringify(data.categories));
      }
      
      const res = await fetch("/api/training/documents", {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) {
        throw new Error(`Error creating document: ${res.statusText}`);
      }
      
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/documents"] });
      toast({
        title: "Document created",
        description: "The document was created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateDocumentMutation = useMutation<TrainingDocument, Error, UpdateDocumentData>({
    mutationFn: async ({ id, ...data }) => {
      const res = await apiRequest("PUT", `/api/training/documents/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/documents"] });
      toast({
        title: "Document updated",
        description: "The document was updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteDocumentMutation = useMutation<void, Error, number>({
    mutationFn: async (id) => {
      await apiRequest("DELETE", `/api/training/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/documents"] });
      toast({
        title: "Document deleted",
        description: "The document was deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createCategoryMutation = useMutation<TrainingCategory, Error, CreateCategoryData>({
    mutationFn: async (data) => {
      const res = await apiRequest("POST", "/api/training/categories", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/categories"] });
      toast({
        title: "Category created",
        description: "The category was created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateCategoryMutation = useMutation<TrainingCategory, Error, UpdateCategoryData>({
    mutationFn: async ({ id, ...data }) => {
      const res = await apiRequest("PUT", `/api/training/categories/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/categories"] });
      toast({
        title: "Category updated",
        description: "The category was updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteCategoryMutation = useMutation<void, Error, number>({
    mutationFn: async (id) => {
      await apiRequest("DELETE", `/api/training/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training/categories"] });
      toast({
        title: "Category deleted",
        description: "The category was deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addDocumentToCategoryMutation = useMutation<DocumentCategory, Error, { documentId: number; categoryId: number }>({
    mutationFn: async ({ documentId, categoryId }) => {
      const res = await apiRequest("POST", `/api/training/documents/${documentId}/categories/${categoryId}`);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "The document was added to the category",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeDocumentFromCategoryMutation = useMutation<void, Error, { documentId: number; categoryId: number }>({
    mutationFn: async ({ documentId, categoryId }) => {
      await apiRequest("DELETE", `/api/training/documents/${documentId}/categories/${categoryId}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "The document was removed from the category",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getDocumentCategories = async (documentId: number): Promise<TrainingCategory[]> => {
    const res = await apiRequest("GET", `/api/training/documents/${documentId}/categories`);
    return await res.json();
  };

  const getCategoryDocuments = async (categoryId: number): Promise<TrainingDocument[]> => {
    const res = await apiRequest("GET", `/api/training/categories/${categoryId}/documents`);
    return await res.json();
  };

  return (
    <TrainingContext.Provider
      value={{
        documents,
        documentsLoading,
        categories,
        categoriesLoading,
        createDocumentMutation,
        updateDocumentMutation,
        deleteDocumentMutation,
        createCategoryMutation,
        updateCategoryMutation,
        deleteCategoryMutation,
        addDocumentToCategoryMutation,
        removeDocumentFromCategoryMutation,
        getDocumentCategories,
        getCategoryDocuments,
      }}
    >
      {children}
    </TrainingContext.Provider>
  );
}

export function useTraining() {
  const context = useContext(TrainingContext);
  if (!context) {
    throw new Error("useTraining must be used within a TrainingProvider");
  }
  return context;
}