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
function Act({ id, to, children, ghost = false, full = false }: { id: string; to: OrderStatus; children: React.ReactNode; ghost?: boolean; full?: boolean }) {
  return (
    <form action={advanceOrder} className={full ? 'w-full' : undefined}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="to" value={to} />
      <SubmitButton pendingText="…" variant={ghost ? 'ghost' : 'primary'} className={full ? 'btn-sm' : 'btn-sm !w-auto'}>{children}</SubmitButton>
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
  const pickedUp = closed.filter((o) => o.status === 'PICKED_UP').slice(0, 8);
  const canceled = closed.filter((o) => o.status === 'CANCELED');
  const columns = [
    { key: 'RECEIVED', title: 'Recebidos', color: '#2150C9', orders: open.filter((o) => o.status === 'RECEIVED') },
    { key: 'PREPARING', title: 'Preparando', color: '#B45309', orders: open.filter((o) => o.status === 'PREPARING') },
    { key: 'READY', title: 'Prontos', color: '#15803d', orders: open.filter((o) => o.status === 'READY') },
    { key: 'PICKED_UP', title: 'Retirados', color: '#64748B', orders: pickedUp },
  ] as const;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <AutoRefresh seconds={15} />
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-primary">Pedidos</h1>
          <p className="text-sm text-slate-600">
            {restaurant.ordersEnabled ? 'Esta tela atualiza sozinha. Cobre no balcão e marque “Retirado e pago”: os pontos entram na carteira do cliente.' : 'Os pedidos pelo app estão desligados. Ligue em “Cardápio e ajustes” para os clientes pedirem.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={restaurant.ordersEnabled ? 'chip-verde' : 'chip-sumido'}>● {restaurant.ordersEnabled ? `recebendo pedidos · ${prepText(restaurant.orderPrepMin)}` : 'pedidos desligados'}</span>
          <Link href="/dashboard/cardapio" className="glass-button-ghost btn-sm !w-auto">
            <Icon name="gift" size={16} /> Cardápio e ajustes
          </Link>
        </div>
      </header>
      {sp.erro && <p role="alert" className="glass-error">{sp.erro}</p>}
      {sp.pontos && <p role="status" className="glass-success">Pedido retirado. O cliente ganhou {formatPoints(Number(sp.pontos) || 0)} pontos.</p>}

      {open.length === 0 && pickedUp.length === 0 ? (
        <section className="glass-panel p-5 sm:p-7">
          <EmptyState compact variant="gift" title="Nenhum pedido em andamento" text="Quando um cliente pedir pelo app, o pedido aparece aqui com o código dele." />
        </section>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="pedidos-colunas">
          {columns.map((col) => (
            <section key={col.key} aria-label={col.title} className="rounded-[20px] bg-[#EEF1F6] p-2.5" data-column={col.key}>
              <div className="mb-2 flex items-center justify-between px-1.5 pt-1">
                <h2 className="text-sm font-bold" style={{ color: col.color }}>{col.title}</h2>
                <span className="glass-chip !bg-white !text-slate-600">{col.orders.length}</span>
              </div>
              <ul className="space-y-2.5">
                {col.orders.length === 0 && <li className="px-2 py-4 text-center text-xs text-slate-400">Nenhum pedido</li>}
                {col.orders.map((o) => (
                  <li key={o.id} className="glass-panel-sm space-y-2 !rounded-2xl p-3" data-testid={col.key === 'PICKED_UP' ? 'order-done-card' : 'order-card'} data-status={o.status}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-mono text-lg font-bold tracking-[0.2em] text-primary">{o.code}</p>
                      <p className="text-xs font-semibold text-slate-500">{formatBRL(o.totalCents)}</p>
                    </div>
                    <div className="min-w-0 text-xs text-slate-600">
                      <p className="truncate font-semibold text-slate-800">
                        <Link href={`/dashboard/clientes/${o.customer.id}`} className="link-inline !font-semibold">{o.customer.name}</Link>
                      </p>
                      <p className="truncate">{formatPhone(o.customer.phone)}</p>
                      <p className="text-slate-400">{when(o.createdAt)}{unitCount > 1 && o.unit ? ` · ${o.unit.name}` : ''}</p>
                    </div>
                    <ul className="space-y-0.5 text-sm text-slate-800">
                      {o.items.map((i) => <li key={i.id}><strong>{i.qty}×</strong> {i.name}</li>)}
                    </ul>
                    {o.note && <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">Observação: {o.note}</p>}
                    {col.key !== 'PICKED_UP' && (
                      <>
                        <p className="text-xs font-semibold text-primary">
                          Cobrar {formatBRL(o.totalCents)} no balcão
                          <span className="block font-medium text-slate-500">rende {formatPoints(orderPoints(o.totalCents, restaurant.pointsPerReal))} pts</span>
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {o.status === 'RECEIVED' && <Act id={o.id} to="PREPARING" full>Começar a preparar</Act>}
                          {o.status === 'PREPARING' && <Act id={o.id} to="READY" full>Pronto para retirar</Act>}
                          {o.status === 'RECEIVED' && <Act id={o.id} to="READY" ghost>Pronto para retirar</Act>}
                          {o.status === 'READY' && <Act id={o.id} to="PICKED_UP" full>Retirado e pago</Act>}
                          <Act id={o.id} to="CANCELED" ghost>Cancelar</Act>
                        </div>
                      </>
                    )}
                    {col.key === 'PICKED_UP' && <p className="text-xs font-semibold text-emerald-700">Concluído{o.pointsAwarded > 0 ? ` · +${formatPoints(o.pointsAwarded)} pts` : ''}</p>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {canceled.length > 0 && (
        <section className="glass-panel p-5 sm:p-7">
          <h2 className="mb-3 font-bold text-primary">Pedidos cancelados recentes</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {canceled.map((o) => (
              <li key={o.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-800"><span className="font-mono tracking-widest text-slate-500">{o.code}</span> · {o.customer.name}</p>
                  <p className="truncate text-xs text-slate-500">{o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</p>
                  <p className="text-xs text-slate-400">{when(o.createdAt)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-bold text-slate-700">{formatBRL(o.totalCents)}</p>
                  <p className="text-xs text-rose-600">{STATUS_LABEL[o.status as OrderStatus]}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
