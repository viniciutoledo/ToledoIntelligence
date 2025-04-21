import { createContext, ReactNode, useContext } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";

interface LlmConfig {
  id: number;
  model_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: number;
  // API key is masked on the client
  api_key?: string;
}

interface LlmData {
  active: boolean;
  config?: LlmConfig;
  message?: string;
}

interface TestConnectionParams {
  model_name: string;
  api_key: string;
}

interface SaveConfigParams {
  model_name: string;
  api_key: string;
}

type LlmContextType = {
  llmData: LlmData | null;
  isLoading: boolean;
  testConnectionMutation: any;
  saveConfigMutation: any;
  refetchLlmConfig: () => void;
};

export const LlmContext = createContext<LlmContextType | null>(null);

export function LlmProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const { t } = useLanguage();

  // Get LLM config
  const {
    data: llmData,
    isLoading,
    refetch: refetchLlmConfig,
  } = useQuery<LlmData>({
    queryKey: ["/api/admin/llm"],
    retry: false,
  });

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async (params: TestConnectionParams) => {
      const res = await apiRequest("POST", "/api/admin/llm/test", params);
      return await res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: t("admin.connectionSuccess"),
          variant: "default",
        });
      } else {
        toast({
          title: t("admin.connectionFailed"),
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: t("admin.connectionFailed"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Save config mutation
  const saveConfigMutation = useMutation({
    mutationFn: async (params: SaveConfigParams) => {
      const res = await apiRequest("POST", "/api/admin/llm", params);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/llm"] });
      toast({
        title: t("admin.settingsSaved"),
        variant: "default",
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <LlmContext.Provider
      value={{
        llmData,
        isLoading,
        testConnectionMutation,
        saveConfigMutation,
        refetchLlmConfig,
      }}
    >
      {children}
    </LlmContext.Provider>
  );
}

export function useLlm() {
  const context = useContext(LlmContext);
  if (!context) {
    throw new Error("useLlm must be used within a LlmProvider");
  }
  return context;
}
