import { createContext, useContext, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// Tipos para os widgets
export interface ChatWidget {
  id: string;
  name: string;
  greeting: string;
  avatar_url: string;
  avatar_data?: string;
  avatar_mime_type?: string;
  is_active: boolean;
  api_key: string;
  theme_color: string;
  background_color?: string;
  font_size?: string;
  font_color?: string;
  bot_message_bg_color?: string;
  user_message_bg_color?: string;
  allowed_domains?: string[];
  created_at: string;
  updated_at: string;
  user_id: number;
  // Configurações avançadas
  hide_minimize_button?: boolean;
  hide_close_button?: boolean;
  default_height?: string;
  default_width?: string;
  custom_css?: string;
  // Configurações de comportamento
  allow_human_help?: boolean;
  use_emojis?: boolean;
  restrict_topics?: boolean;
  split_responses?: boolean;
  allow_reminders?: boolean;
  response_time?: string;
  agent_timezone?: string;
  max_interactions?: number;
  interaction_limit_action?: string;
}

interface WidgetsContextType {
  widgets: ChatWidget[];
  isLoading: boolean;
  error: Error | null;
  createWidgetMutation: any;
  updateWidgetMutation: any;
  deleteWidgetMutation: any;
  toggleActiveMutation: any;
}

// Criar o contexto
export const WidgetsContext = createContext<WidgetsContextType | null>(null);

// Provider para o contexto
export function WidgetsProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Consulta para obter todos os widgets
  const {
    data: widgets = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['/api/widgets'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/widgets');
      return response.json();
    }
  });

  // Mutation para criar um novo widget
  const createWidgetMutation = useMutation({
    mutationFn: async (widgetData: Partial<ChatWidget>) => {
      const response = await apiRequest('POST', '/api/widgets', widgetData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/widgets'] });
      toast({
        title: 'Widget criado com sucesso',
        description: 'O novo widget está pronto para ser usado',
        variant: 'default',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao criar widget',
        description: error.message || 'Tente novamente mais tarde',
        variant: 'destructive',
      });
    }
  });

  // Mutation para atualizar um widget existente
  const updateWidgetMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ChatWidget> }) => {
      const response = await apiRequest('PATCH', `/api/widgets/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/widgets'] });
      toast({
        title: 'Widget atualizado com sucesso',
        description: 'As alterações foram salvas',
        variant: 'default',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar widget',
        description: error.message || 'Tente novamente mais tarde',
        variant: 'destructive',
      });
    }
  });

  // Mutation para excluir um widget
  const deleteWidgetMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/widgets/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/widgets'] });
      toast({
        title: 'Widget excluído com sucesso',
        variant: 'default',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao excluir widget',
        description: error.message || 'Tente novamente mais tarde',
        variant: 'destructive',
      });
    }
  });

  // Mutation para ativar/desativar um widget
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await apiRequest('PATCH', `/api/widgets/${id}`, { is_active: isActive });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/widgets'] });
      toast({
        title: 'Status do widget atualizado',
        variant: 'default',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar status',
        description: error.message || 'Tente novamente mais tarde',
        variant: 'destructive',
      });
    }
  });

  return (
    <WidgetsContext.Provider
      value={{
        widgets,
        isLoading,
        error,
        createWidgetMutation,
        updateWidgetMutation,
        deleteWidgetMutation,
        toggleActiveMutation
      }}
    >
      {children}
    </WidgetsContext.Provider>
  );
}

// Hook personalizado para acessar o contexto
export function useWidgets() {
  const context = useContext(WidgetsContext);
  if (!context) {
    throw new Error('useWidgets deve ser usado dentro de um WidgetsProvider');
  }
  return context;
}