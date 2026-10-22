import { redirect } from 'next/navigation';
import { startCheckout, logout } from '@/app/actions/auth';
import { SubmitButton } from '@/components/ui';
import { requireRestaurant } from '@/lib/session';
import { FIRST_MONTH_PRICE_DEC, FIRST_MONTH_PRICE_INT, PLAN_PRICE, PLAN_PRICE_DEC, PLAN_PRICE_INT, firstMonthEligible } from '@/lib/plan';

export const metadata = { title: 'Pagamento' };

export default async function PagamentoPage() {
  const restaurant = await requireRestaurant();
  if (restaurant.subscriptionStatus === 'ACTIVE') redirect('/dashboard');

  const copy: Record<string, string> = {
    PENDING: 'Falta só o pagamento para liberar o seu painel.',
    PAST_DUE: 'Não conseguimos processar a última cobrança. Atualize o pagamento para reativar o acesso.',
    CANCELED: 'Sua assinatura foi cancelada. Reative para voltar a usar o painel.',
  };

  const firstMonth = firstMonthEligible(restaurant);

  return (
    <main className="flex min-h-screen items-center justify-center p-5">
      <div className="glass-panel w-full max-w-md p-8 text-center">
        <h1 className="mb-2 text-2xl font-bold text-primary">Olá, {restaurant.name}!</h1>
        <p className="mb-6 text-slate-600">{copy[restaurant.subscriptionStatus]}</p>
        {firstMonth ? (
          <div className="mb-6" data-testid="preco-primeiro-mes">
            <p className="text-5xl font-extrabold text-electric-600">
              {FIRST_MONTH_PRICE_INT}<span className="text-2xl">{FIRST_MONTH_PRICE_DEC}</span>
              <span className="block text-base font-semibold text-slate-500">no primeiro mês</span>
            </p>
            <p className="mt-1 text-sm text-slate-500">Depois, {PLAN_PRICE} por mês. Sem taxa de adesão e sem fidelidade.</p>
          </div>
        ) : (
          <p className="mb-6 text-4xl font-extrabold text-electric-600">
            {PLAN_PRICE_INT}<span className="text-lg text-slate-500">{PLAN_PRICE_DEC}/mês</span>
          </p>
        )}
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
