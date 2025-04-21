import { createClient } from '@supabase/supabase-js';

// Verificamos que as variáveis de ambiente estão definidas
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  throw new Error('As variáveis de ambiente SUPABASE_URL e SUPABASE_ANON_KEY devem ser definidas');
}

// Criamos o cliente do Supabase para o backend
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Esquema do Supabase para os usuários
export type SupabaseUser = {
  id: string;
  email: string;
  role: 'technician' | 'admin';
  is_blocked: boolean;
  language: 'pt' | 'en';
  created_at: string;
  updated_at: string;
  last_login?: string;
  twofa_enabled: boolean;
  subscription_tier: 'none' | 'basic' | 'intermediate';
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  message_count: number;
  max_messages: number;
}

// Verificar o status da assinatura do usuário
export async function checkSubscriptionStatus(userId: string): Promise<{
  tier: 'none' | 'basic' | 'intermediate';
  messageCount: number;
  maxMessages: number;
  active: boolean;
}> {
  const { data, error } = await supabase
    .from('users')
    .select('subscription_tier, message_count, max_messages, stripe_subscription_id')
    .eq('id', userId)
    .single();

  if (error || !data) {
    console.error('Erro ao verificar status da assinatura:', error);
    return { tier: 'none', messageCount: 0, maxMessages: 0, active: false };
  }

  return {
    tier: data.subscription_tier || 'none',
    messageCount: data.message_count || 0,
    maxMessages: data.max_messages || 0,
    active: !!data.stripe_subscription_id
  };
}

// Incrementar contagem de mensagens do usuário
export async function incrementMessageCount(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('increment_message_count', {
      user_id: userId
    });

    if (error) {
      console.error('Erro ao incrementar contagem de mensagens:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Erro ao incrementar contagem de mensagens:', err);
    return false;
  }
}

// Verificar se o usuário atingiu o limite de mensagens
export async function checkMessageLimit(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .select('message_count, max_messages')
    .eq('id', userId)
    .single();

  if (error || !data) {
    console.error('Erro ao verificar limite de mensagens:', error);
    return false;
  }

  // Se max_messages for 0, significa ilimitado
  if (data.max_messages === 0) return true;
  
  // Verifica se o usuário ainda tem mensagens disponíveis
  return data.message_count < data.max_messages;
}