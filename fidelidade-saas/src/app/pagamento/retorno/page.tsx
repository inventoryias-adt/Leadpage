import { redirect } from 'next/navigation';
import { AutoRefresh } from '@/components/AutoRefresh';
import { requireRestaurant } from '@/lib/session';

export const metadata = { title: 'Confirmando pagamento' };
export const dynamic = 'force-dynamic';

/** Retorno do checkout: o webhook pode demorar alguns segundos, então consultamos até ativar. */
export default async function RetornoPage() {
  const restaurant = await requireRestaurant();
  if (restaurant.subscriptionStatus === 'ACTIVE') redirect('/dashboard/configuracoes');
  return (
    <main className="flex min-h-screen items-center justify-center p-5">
      <AutoRefresh />
      <div className="glass-panel w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-electric-500/30 border-t-electric-500" />
        <h1 className="mb-2 text-xl font-bold text-primary">Confirmando seu pagamento…</h1>
        <p className="text-slate-600">Isso leva alguns segundos. Esta página atualiza sozinha.</p>
      </div>
    </main>
  );
}
