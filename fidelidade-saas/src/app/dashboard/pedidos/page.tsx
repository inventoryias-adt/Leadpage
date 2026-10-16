import Link from 'next/link';
import { advanceOrder } from '@/app/actions/menu';
import { EmptyState } from '@/components/EmptyState';
import { AutoRefresh } from '@/components/MenuForms';
import { Icon } from '@/components/Icons';
import { SubmitButton } from '@/components/ui';
import { formatPhone } from '@/lib/br';
import { prisma } from '@/lib/db';
import { OPEN_STATUSES, STATUS_LABEL, orderPoints, prepText, type OrderStatus } from '@/lib/orders';
import { formatBRL, formatPoints } from '@/lib/points';
import { requireActiveRestaurant } from '@/lib/session';

export const metadata = { title: 'Pedidos' };
export const dynamic = 'force-dynamic';

const when = (d: Date) => d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });

/** Ação de um pedido: um formulário por botão, para cada um enviar o seu próprio status. */
function Act({ id, to, children, ghost = false }: { id: string; to: OrderStatus; children: React.ReactNode; ghost?: boolean }) {
  return (
    <form action={advanceOrder}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="to" value={to} />
      <SubmitButton pendingText="…" variant={ghost ? 'ghost' : 'primary'} className="btn-sm !w-auto">{children}</SubmitButton>
    </form>
  );
}

export default async function PedidosPage({ searchParams }: { searchParams: Promise<{ erro?: string; pontos?: string }> }) {
  const restaurant = await requireActiveRestaurant();
  const sp = await searchParams;

  const include = { items: true, customer: { select: { id: true, name: true, phone: true } }, unit: { select: { name: true } } } as const;
  const [open, closed, unitCount] = await Promise.all([
    prisma.order.findMany({ where: { restaurantId: restaurant.id, status: { in: OPEN_STATUSES } }, orderBy: { createdAt: 'asc' }, include }),
    prisma.order.findMany({ where: { restaurantId: restaurant.id, status: { in: ['PICKED_UP', 'CANCELED'] } }, orderBy: { createdAt: 'desc' }, take: 15, include }),
    prisma.unit.count({ where: { restaurantId: restaurant.id, active: true } }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <AutoRefresh seconds={15} />
      <section className="glass-panel p-5 sm:p-7">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-primary">Pedidos para retirar</h1>
          <Link href="/dashboard/cardapio" className="glass-button-ghost btn-sm !w-auto">
            <Icon name="gift" size={16} /> Cardápio e ajustes
          </Link>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          {restaurant.ordersEnabled ? 'Esta tela atualiza sozinha. Cobre no balcão e marque “Retirado e pago”: os pontos entram na carteira do cliente.' : 'Os pedidos pelo app estão desligados. Ligue em “Cardápio e ajustes” para os clientes pedirem.'}
        </p>
        {sp.erro && <p role="alert" className="glass-error mb-3">{sp.erro}</p>}
        {sp.pontos && <p role="status" className="glass-success mb-3">Pedido retirado. O cliente ganhou {formatPoints(Number(sp.pontos) || 0)} pontos.</p>}

        {open.length === 0 ? (
          <EmptyState compact variant="gift" title="Nenhum pedido em andamento" text="Quando um cliente pedir pelo app, o pedido aparece aqui com o código dele." />
        ) : (
          <ul className="space-y-3">
            {open.map((o) => (
              <li key={o.id} className="glass-inset space-y-3 p-4" data-testid="order-card" data-status={o.status}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-2xl font-bold tracking-[0.25em] text-electric-600">{o.code}</p>
                    <p className="text-sm font-semibold text-slate-800">
                      <Link href={`/dashboard/clientes/${o.customer.id}`} className="link-inline">{o.customer.name}</Link> · {formatPhone(o.customer.phone)}
                    </p>
                    <p className="text-xs text-slate-500">{when(o.createdAt)} · {prepText(o.prepMin)}{unitCount > 1 && o.unit ? ` · ${o.unit.name}` : ''}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${o.status === 'RECEIVED' ? 'bg-rose-100 text-rose-700' : o.status === 'PREPARING' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>
                    {o.status === 'RECEIVED' ? 'Novo' : STATUS_LABEL[o.status as OrderStatus]}
                  </span>
                </div>
                <ul className="space-y-0.5 text-sm text-slate-800">
                  {o.items.map((i) => <li key={i.id}><strong>{i.qty}×</strong> {i.name}</li>)}
                </ul>
                {o.note && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Observação: {o.note}</p>}
                <p className="text-sm font-bold text-primary">
                  Cobrar {formatBRL(o.totalCents)} no balcão
                  <span className="ml-2 text-xs font-medium text-slate-500">rende {formatPoints(orderPoints(o.totalCents, restaurant.pointsPerReal))} pts</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {o.status === 'RECEIVED' && <Act id={o.id} to="PREPARING">Começar a preparar</Act>}
                  {o.status !== 'READY' && <Act id={o.id} to="READY" ghost={o.status === 'RECEIVED'}>Pronto para retirar</Act>}
                  {o.status === 'READY' && <Act id={o.id} to="PICKED_UP">Retirado e pago</Act>}
                  <Act id={o.id} to="CANCELED" ghost>Cancelar</Act>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {closed.length > 0 && (
        <section className="glass-panel p-5 sm:p-7">
          <h2 className="mb-3 font-bold text-primary">Últimos pedidos encerrados</h2>
          <ul className="divide-y divide-white/60 text-sm">
            {closed.map((o) => (
              <li key={o.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-800"><span className="font-mono tracking-widest text-slate-500">{o.code}</span> · {o.customer.name}</p>
                  <p className="truncate text-xs text-slate-500">{o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</p>
                  <p className="text-xs text-slate-400">{when(o.createdAt)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-bold text-slate-700">{formatBRL(o.totalCents)}</p>
                  <p className={`text-xs ${o.status === 'CANCELED' ? 'text-rose-600' : 'text-emerald-700'}`}>{STATUS_LABEL[o.status as OrderStatus]}{o.pointsAwarded > 0 ? ` · +${formatPoints(o.pointsAwarded)} pts` : ''}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
