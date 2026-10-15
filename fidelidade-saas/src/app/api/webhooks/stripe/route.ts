import type Stripe from 'stripe';
import { prisma } from '@/lib/db';
import { stripe } from '@/lib/payments';
import type { SubscriptionStatus } from '@prisma/client';

export const runtime = 'nodejs';

function mapStatus(status: Stripe.Subscription.Status): SubscriptionStatus | null {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'ACTIVE';
    case 'past_due':
    case 'unpaid':
      return 'PAST_DUE';
    case 'canceled':
    case 'incomplete_expired':
      return 'CANCELED';
    default:
      return null; // incomplete / paused: não altera
  }
}

export async function POST(req: Request) {
  const signature = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) return new Response('Webhook não configurado', { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return new Response('Assinatura inválida', { status: 400 });
  }

  // O Stripe reenvia eventos (falha de rede, nova tentativa): cada id é processado uma única vez.
  // Guardamos o id na tabela RateLimit (chave única, sem migração) por 35 dias; o Stripe para de reenviar em 3 dias.
  const fresh = await prisma.$queryRaw<{ key: string }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt") VALUES (${'stripe-event:' + event.id}, 1, now() + interval '35 days')
    ON CONFLICT ("key") DO NOTHING RETURNING "key"`;
  if (fresh.length === 0) return new Response('ok (já processado)');

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.client_reference_id && session.payment_status === 'paid') {
          await prisma.restaurant.updateMany({
            where: { id: session.client_reference_id },
            data: {
              subscriptionStatus: 'ACTIVE',
              paymentCustomerId: typeof session.customer === 'string' ? session.customer : null,
              paymentSubscriptionId: typeof session.subscription === 'string' ? session.subscription : null,
            },
          });
        }
        break;
      }
      case 'invoice.payment_failed': {
        // Cobrança recusada: o acesso fica suspenso até o cartão ser atualizado (portal) ou a nova tentativa passar.
        const invoice = event.data.object as Stripe.Invoice;
        const customer = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        if (customer) {
          await prisma.restaurant.updateMany({ where: { paymentCustomerId: customer, subscriptionStatus: 'ACTIVE' }, data: { subscriptionStatus: 'PAST_DUE' } });
        }
        break;
      }
      case 'invoice.paid': {
        // Pagamento (ou nova tentativa) confirmado: só reativa quem estava inadimplente; um cancelamento feito pela administração não é desfeito.
        const invoice = event.data.object as Stripe.Invoice;
        const customer = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        if (customer) {
          await prisma.restaurant.updateMany({ where: { paymentCustomerId: customer, subscriptionStatus: 'PAST_DUE' }, data: { subscriptionStatus: 'ACTIVE' } });
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const status = event.type === 'customer.subscription.deleted' ? 'CANCELED' : mapStatus(sub.status);
        if (status) {
          await prisma.restaurant.updateMany({
            where: {
              OR: [{ paymentSubscriptionId: sub.id }, ...(sub.metadata?.restaurantId ? [{ id: sub.metadata.restaurantId }] : [])],
            },
            data: { subscriptionStatus: status, paymentSubscriptionId: sub.id },
          });
        }
        break;
      }
    }
  } catch (e) {
    // Falhou no meio: libera o id para o Stripe poder reenviar e tentar de novo.
    await prisma.$executeRaw`DELETE FROM "RateLimit" WHERE "key" = ${'stripe-event:' + event.id}`;
    throw e;
  }
  return new Response('ok');
}
