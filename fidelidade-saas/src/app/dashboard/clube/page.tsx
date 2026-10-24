import { cancelClubByOwner, payClubSubscription, toggleClubPlan, undoClubPayment } from '@/app/actions/club';
import { AddSubscriberForm, ClubPlanForm } from '@/components/ClubForms';
import { EmptyState } from '@/components/EmptyState';
import { SubmitButton } from '@/components/ui';
import { STATE_LABEL, itemsText, type SubState } from '@/lib/club';
import { allPlans, subscriptionsOfRestaurant } from '@/lib/club-db';
import { prisma } from '@/lib/db';
import { formatBRL } from '@/lib/points';
import { requireActiveRestaurant } from '@/lib/session';

export const metadata = { title: 'Clube de assinatura' };
export const dynamic = 'force-dynamic';

const dmy = (key: string | null) => (key ? key.split('-').reverse().join('/') : '');
const TONE: Record<SubState, string> = { AWAITING: 'bg-amber-50 text-amber-800', ACTIVE: 'bg-emerald-50 text-emerald-700', DUE: 'bg-rose-50 text-rose-700', ENDING: 'bg-slate-100 text-slate-600', ENDED: 'bg-slate-100 text-slate-500' };

export default async function ClubePage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const restaurant = await requireActiveRestaurant();
  const sp = await searchParams;
  const [plans, subs, services] = await Promise.all([
    allPlans(restaurant.id),
    subscriptionsOfRestaurant(restaurant.id),
    prisma.service.findMany({ where: { restaurantId: restaurant.id, active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, priceCents: true } }),
  ]);
  const svcs = services.map((s) => ({ id: s.id, name: s.name, priceLabel: s.priceCents > 0 ? formatBRL(s.priceCents) : '' }));
  const need = subs.filter((s) => s.state === 'AWAITING' || s.state === 'DUE');
  const rest = subs.filter((s) => s.state !== 'AWAITING' && s.state !== 'DUE');
  const monthly = subs.filter((s) => s.state === 'ACTIVE').reduce((n, s) => n + s.priceCents, 0);

  const row = (s: (typeof subs)[number]) => (
    <li key={s.id} className="glass-inset space-y-2 p-3" data-testid="sub-row">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-slate-900">{s.customer.name} <span className="font-normal text-slate-500">· {s.planName} · {formatBRL(s.priceCents)}/mês</span></p>
          <p className="text-xs text-slate-500">{s.coveredUntil ? `Pago até ${dmy(s.coveredUntil)}` : 'Nenhum pagamento ainda'}{s.requestedBy === 'CUSTOMER' && s.paidPeriods === 0 ? ' · pedido feito pelo app' : ''}</p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${TONE[s.state]}`} data-testid="sub-state">{STATE_LABEL[s.state]}</span>
      </div>
      {s.cycle && s.state !== 'ENDED' && (
        <p className="text-xs text-slate-600" data-testid="sub-balance">Neste ciclo ({dmy(s.cycle.start)} a {dmy(s.cycle.end)}): {s.balances.map((b) => `${b.name} ${b.used}/${b.quantity}`).join(' · ')}</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {s.canPay && (
          <form action={payClubSubscription}><input type="hidden" name="id" value={s.id} /><SubmitButton pendingText="…" variant="navy" className="btn-sm !w-auto px-4" data-testid="sub-pay">{s.paidPeriods === 0 ? 'Registrar 1º pagamento' : 'Registrar pagamento do próximo mês'}</SubmitButton></form>
        )}
        {s.status === 'ACTIVE' && !s.canPay && <span className="text-xs text-slate-500" data-testid="sub-paid-ok">A renovação abre na última semana do ciclo.</span>}
        {s.paidPeriods > 0 && <form action={undoClubPayment}><input type="hidden" name="id" value={s.id} /><button className="text-xs font-semibold text-slate-500 underline" data-testid="sub-undo">Desfazer último pagamento</button></form>}
        {s.status === 'ACTIVE' && <form action={cancelClubByOwner}><input type="hidden" name="id" value={s.id} /><button className="text-xs font-semibold text-rose-600 underline" data-testid="sub-cancel">Cancelar assinatura</button></form>}
      </div>
    </li>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-primary">Clube de assinatura</h1>
        <p className="text-sm text-slate-600">Planos mensais para o cliente fiel (ex.: 3 cortes e 2 barbas por mês). Cada agendamento coberto pelo plano abate do saldo do ciclo; a mensalidade você recebe no balcão e registra aqui, e ela entra no Financeiro.</p>
      </header>

      {sp.erro && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700" data-testid="club-error">{sp.erro}</p>}

      <section className="grid grid-cols-3 gap-2 sm:gap-3" data-testid="club-kpis">
        {[['Assinantes em dia', String(subs.filter((s) => s.state === 'ACTIVE').length), 'kpi-active'], ['A receber / vencidas', String(need.length), 'kpi-need'], ['Receita mensal', formatBRL(monthly), 'kpi-monthly']].map(([label, value, id]) => (
          <div key={id} className="glass-panel-sm !rounded-2xl p-3 sm:p-4" data-testid={id}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-lg font-extrabold text-primary sm:text-2xl">{value}</p></div>
        ))}
      </section>

      <section className="glass-panel !rounded-[22px] p-4 sm:p-5" aria-labelledby="planos">
        <h2 id="planos" className="font-bold text-primary">Planos</h2>
        {plans.length === 0 ? (
          <EmptyState compact variant="gift" title="Nenhum plano ainda" text="Crie o primeiro abaixo: escolha os serviços, quantas vezes por mês e o valor." />
        ) : (
          <ul className="mt-3 space-y-3" data-testid="plan-list">
            {plans.map((p) => (
              <li key={p.id} className="glass-inset p-3" data-testid="plan-row">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">{p.name} <span className="font-normal text-slate-500">· {formatBRL(p.priceCents)}/mês</span> {!p.active && <span className="glass-chip ml-1 !px-2 !py-0.5 !text-[11px]">inativo</span>}</p>
                    <p className="text-sm text-slate-600">{itemsText(p.items)}</p>
                    <p className="text-xs text-slate-500">{p.subscribers} {p.subscribers === 1 ? 'assinante' : 'assinantes'}{p.description ? ` · ${p.description}` : ''}</p>
                  </div>
                  <form action={toggleClubPlan}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="active" value={p.active ? '0' : '1'} /><button className="text-xs font-semibold text-slate-500 underline" data-testid="plan-toggle">{p.active ? 'Pausar novas assinaturas' : 'Reativar'}</button></form>
                </div>
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer font-semibold text-electric-600">Editar plano</summary>
                  <div className="mt-3"><ClubPlanForm uid={`p-${p.id}`} services={svcs} plan={{ id: p.id, name: p.name, description: p.description ?? '', price: (p.priceCents / 100).toFixed(2).replace('.', ','), items: Object.fromEntries(p.items.map((i) => [i.serviceId, i.quantity])) }} /></div>
                </details>
              </li>
            ))}
          </ul>
        )}
        <details className="mt-4 rounded-2xl border border-slate-200 bg-white p-3" open={plans.length === 0}>
          <summary className="cursor-pointer text-sm font-bold text-electric-600" data-testid="plan-new">+ Criar plano</summary>
          <div className="mt-3"><ClubPlanForm uid="novo" services={svcs} /></div>
        </details>
      </section>

      <section className="glass-panel !rounded-[22px] p-4 sm:p-5" aria-labelledby="assinantes">
        <h2 id="assinantes" className="font-bold text-primary">Assinantes</h2>
        {need.length > 0 && (
          <div className="mt-3" data-testid="sub-need">
            <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-amber-700">Aguardando pagamento ou vencidos</h3>
            <ul className="space-y-2">{need.map(row)}</ul>
          </div>
        )}
        {rest.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">Demais assinaturas</h3>
            <ul className="space-y-2">{rest.map(row)}</ul>
          </div>
        )}
        {subs.length === 0 && <p className="mt-2 text-sm text-slate-500" data-testid="no-subs">Ninguém assina ainda. Quando um cliente pedir um plano pelo app, ele aparece aqui; você também pode cadastrar pelo CPF.</p>}
        <details className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
          <summary className="cursor-pointer text-sm font-bold text-electric-600" data-testid="sub-new">+ Cadastrar assinante pelo CPF</summary>
          <div className="mt-3"><AddSubscriberForm plans={plans.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name }))} /></div>
        </details>
      </section>
    </div>
  );
}
