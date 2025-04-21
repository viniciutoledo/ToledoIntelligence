import { createContext, ReactNode, useContext } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";

interface Avatar {
  id: number;
  name: string;
  image_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: number;
}

interface SaveAvatarParams {
  name: string;
  image?: File;
}

type AvatarContextType = {
  avatar: Avatar | null;
  isLoading: boolean;
  saveAvatarMutation: any;
  resetAvatarMutation: any;
  refetchAvatar: () => void;
};

export const AvatarContext = createContext<AvatarContextType | null>(null);

export function AvatarProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const { t } = useLanguage();

  // Get current avatar
  const {
    data: avatar,
    isLoading,
    refetch: refetchAvatar,
  } = useQuery<Avatar>({
    queryKey: ["/api/avatar"],
    retry: false,
  });

  // Save avatar mutation
  const saveAvatarMutation = useMutation({
    mutationFn: async (params: SaveAvatarParams) => {
      const formData = new FormData();
      formData.append("name", params.name);
      
      if (params.image) {
        formData.append("image", params.image);
      }

      const url = avatar?.id 
        ? `/api/admin/avatar/${avatar.id}` 
        : '/api/admin/avatar';
      
      const method = avatar?.id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || res.statusText);
      }

      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/avatar"] });
      toast({
        title: t("admin.avatarSaved"),
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

  // Reset avatar to default
  const resetAvatarMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/avatar/reset");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/avatar"] });
      toast({
        title: t("admin.avatarReset"),
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
    <AvatarContext.Provider
      value={{
        avatar,
        isLoading,
        saveAvatarMutation,
        resetAvatarMutation,
        refetchAvatar,
      }}
    >
      {children}
    </AvatarContext.Provider>
  );
}

export function useAvatar() {
  const context = useContext(AvatarContext);
  if (!context) {
    throw new Error("useAvatar must be used within an AvatarProvider");
  }
  return context;
}
