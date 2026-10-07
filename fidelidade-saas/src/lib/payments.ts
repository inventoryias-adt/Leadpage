import 'server-only';
import Stripe from 'stripe';

export const PLAN_PRICE_CENTS = 19700;

export const appUrl = () => (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');

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
