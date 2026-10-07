import 'server-only';
import Stripe from 'stripe';

export const PLAN_PRICE_CENTS = 19700;

/** URL pública usada nos links/QR Codes: APP_URL, senão o domínio da própria Vercel, senão localhost. */
export function appUrl() {
  const e = process.env;
  const vercel =
    e.VERCEL_ENV === 'production' && e.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${e.VERCEL_PROJECT_PRODUCTION_URL}`
      : e.VERCEL_URL
        ? `https://${e.VERCEL_URL}`
        : undefined;
  return (e.APP_URL || vercel || 'http://localhost:3000').replace(/\/$/, '');
}

/** Pagamento simulado só em desenvolvimento local ou em *previews* da Vercel — nunca em produção. */
export const mockPaymentsAllowed = () => process.env.NODE_ENV !== 'production' || process.env.VERCEL_ENV === 'preview';

export function paymentProvider(): 'stripe' | 'mock' {
  const p = process.env.PAYMENT_PROVIDER ?? 'mock';
  if (p !== 'stripe' && !mockPaymentsAllowed()) {
    throw new Error('Configure PAYMENT_PROVIDER=stripe (pagamento simulado não é permitido em produção).');
  }
  return p === 'stripe' ? 'stripe' : 'mock';
}

let stripeClient: Stripe | undefined;
export function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY não configurada.');
  return (stripeClient ??= new Stripe(key));
}

/** Devolve a URL para onde o restaurante deve ser enviado para pagar os R$ 197,00/mês. */
export async function createCheckoutUrl(restaurant: { id: string; email: string; name: string }) {
  if (paymentProvider() === 'mock') return '/pagamento/simulado';

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) throw new Error('STRIPE_PRICE_ID não configurado.');

  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: restaurant.email,
    client_reference_id: restaurant.id,
    subscription_data: { metadata: { restaurantId: restaurant.id } },
    success_url: `${appUrl()}/pagamento/retorno`,
    cancel_url: `${appUrl()}/pagamento`,
    locale: 'pt-BR',
  });
  if (!session.url) throw new Error('Stripe não retornou a URL de checkout.');
  return session.url;
}

/** Portal do cliente do Stripe: trocar cartão, ver faturas e cancelar. Null quando não há cobrança real para gerenciar. */
export async function createPortalUrl(restaurant: { paymentCustomerId: string | null }) {
  if (paymentProvider() === 'mock' || !restaurant.paymentCustomerId) return null;
  const session = await stripe().billingPortal.sessions.create({
    customer: restaurant.paymentCustomerId,
    return_url: `${appUrl()}/dashboard/configuracoes#conta`,
    locale: 'pt-BR',
  });
  return session.url;
}
