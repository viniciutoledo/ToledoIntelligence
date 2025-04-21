import Stripe from 'stripe';
import { supabase } from './supabase';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('A variável de ambiente STRIPE_SECRET_KEY deve ser definida');
}

if (!process.env.STRIPE_PRICE_ID_BASIC || !process.env.STRIPE_PRICE_ID_INTERMEDIATE) {
  throw new Error('As variáveis de ambiente STRIPE_PRICE_ID_BASIC e STRIPE_PRICE_ID_INTERMEDIATE devem ser definidas');
}

// Configuração do cliente Stripe
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// IDs dos produtos no Stripe
export const STRIPE_PRICE_IDS = {
  BASIC: process.env.STRIPE_PRICE_ID_BASIC,
  INTERMEDIATE: process.env.STRIPE_PRICE_ID_INTERMEDIATE
};

// Limites de mensagens por plano
export const MESSAGE_LIMITS = {
  BASIC: 2500,
  INTERMEDIATE: 5000,
};

// Função para criar ou obter um cliente no Stripe
export async function getOrCreateStripeCustomer(userId: string, email: string): Promise<string> {
  // Verificar se o usuário já tem um ID de cliente Stripe
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single();

  if (userError) {
    throw new Error(`Erro ao obter dados do usuário: ${userError.message}`);
  }

  // Se o usuário já tem um ID de cliente, retorná-lo
  if (userData?.stripe_customer_id) {
    return userData.stripe_customer_id;
  }

  // Caso contrário, criar um novo cliente no Stripe
  const customer = await stripe.customers.create({
    email,
    metadata: { userId }
  });

  // Atualizar o usuário com o ID do cliente Stripe
  const { error: updateError } = await supabase
    .from('users')
    .update({ stripe_customer_id: customer.id })
    .eq('id', userId);

  if (updateError) {
    throw new Error(`Erro ao atualizar o ID do cliente Stripe: ${updateError.message}`);
  }

  return customer.id;
}

// Função para criar uma sessão de checkout do Stripe
export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  userId: string
): Promise<string> {
  const baseUrl = process.env.NODE_ENV === 'production'
    ? 'https://toledoia.com' // URL de produção (substituir pelo seu domínio)
    : 'http://localhost:5000';

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: `${baseUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/subscription/cancel`,
    metadata: {
      userId,
    },
  });

  return session.url || '';
}

// Função para obter detalhes da assinatura de um usuário
export async function getSubscriptionDetails(subscriptionId: string) {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return {
      status: subscription.status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      priceId: subscription.items.data[0].price.id,
    };
  } catch (error) {
    console.error('Erro ao obter detalhes da assinatura:', error);
    return null;
  }
}

// Função para cancelar a assinatura de um usuário
export async function cancelSubscription(subscriptionId: string) {
  try {
    return await stripe.subscriptions.cancel(subscriptionId);
  } catch (error) {
    console.error('Erro ao cancelar assinatura:', error);
    throw error;
  }
}

// Função para atualizar o plano de um usuário no banco de dados
export async function updateUserSubscriptionTier(
  userId: string,
  tier: 'basic' | 'intermediate',
  subscriptionId: string
) {
  // Determinar o limite máximo de mensagens com base no plano
  const maxMessages = tier === 'basic' ? MESSAGE_LIMITS.BASIC : MESSAGE_LIMITS.INTERMEDIATE;

  // Atualizar o usuário no banco de dados
  const { error } = await supabase
    .from('users')
    .update({
      subscription_tier: tier,
      stripe_subscription_id: subscriptionId,
      max_messages: maxMessages,
    })
    .eq('id', userId);

  if (error) {
    throw new Error(`Erro ao atualizar o plano de assinatura: ${error.message}`);
  }

  return true;
}