import { redirect } from 'next/navigation';
import { startCheckout, logout } from '@/app/actions/auth';
import { SubmitButton } from '@/components/ui';
import { requireRestaurant } from '@/lib/session';

export const metadata = { title: 'Pagamento' };

export default async function PagamentoPage() {
  const restaurant = await requireRestaurant();
  if (restaurant.subscriptionStatus === 'ACTIVE') redirect('/dashboard');

  const copy: Record<string, string> = {
    PENDING: 'Falta só o pagamento para liberar o seu painel.',
    PAST_DUE: 'Não conseguimos processar a última cobrança. Atualize o pagamento para reativar o acesso.',
    CANCELED: 'Sua assinatura foi cancelada. Reative para voltar a usar o painel.',
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-5">
      <div className="glass-panel w-full max-w-md p-8 text-center">
        <h1 className="mb-2 text-2xl font-bold text-primary">Olá, {restaurant.name}!</h1>
        <p className="mb-6 text-slate-600">{copy[restaurant.subscriptionStatus]}</p>
        <p className="mb-6 text-4xl font-extrabold text-electric-600">
          R$ 197<span className="text-lg text-slate-500">,00/mês</span>
        </p>
        <form action={startCheckout}>
          <SubmitButton pendingText="Abrindo pagamento…">Ir para pagamento seguro</SubmitButton>
        </form>
        <form action={logout} className="mt-4">
          <button className="glass-button-ghost btn-sm">Sair</button>
        </form>
      </div>
    </main>
  );
}
