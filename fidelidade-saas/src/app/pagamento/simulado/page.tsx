import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { paymentProvider } from '@/lib/payments';
import { requireRestaurant } from '@/lib/session';
import { SubmitButton } from '@/components/ui';

export const metadata = { title: 'Pagamento simulado' };
export const dynamic = 'force-dynamic';

const mockEnabled = () => process.env.NODE_ENV !== 'production' && paymentProvider() === 'mock';

/** Apenas desenvolvimento (PAYMENT_PROVIDER=mock): simula a aprovação do pagamento. */
async function approve() {
  'use server';
  if (!mockEnabled()) notFound();
  const restaurant = await requireRestaurant();
  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: { subscriptionStatus: 'ACTIVE', paymentCustomerId: 'mock', paymentSubscriptionId: 'mock' },
  });
  redirect('/dashboard/configuracoes');
}

export default async function SimuladoPage() {
  if (!mockEnabled()) notFound();
  await requireRestaurant();
  return (
    <main className="flex min-h-screen items-center justify-center p-5">
      <div className="glass-panel w-full max-w-md p-8 text-center">
        <span className="glass-chip mb-4">Modo desenvolvimento</span>
        <h1 className="mb-2 text-2xl font-bold text-primary">Pagamento simulado</h1>
        <p className="mb-6 text-slate-600">Nenhuma cobrança real será feita. Configure o Stripe para produção.</p>
        <form action={approve}>
          <SubmitButton>Simular pagamento de R$ 197,00</SubmitButton>
        </form>
      </div>
    </main>
  );
}
