import Link from 'next/link';
import { cancelMyOrder } from '@/app/actions/orders';
import { Icon } from '@/components/Icons';
import { SubmitButton } from '@/components/ui';
import { prisma } from '@/lib/db';
import { OPEN_STATUSES, STATUS_LABEL, prepText, type OrderStatus } from '@/lib/orders';
import { formatBRL, formatDateTimeBR, formatPoints } from '@/lib/points';
import { requireCustomer } from '@/lib/session';

export const metadata = { title: 'Meus pedidos' };
export const dynamic = 'force-dynamic';

const CLS: Record<OrderStatus, string> = {
  RECEIVED: 'bg-amber-100 text-amber-800',
  PREPARING: 'bg-amber-100 text-amber-800',
  READY: 'bg-emerald-100 text-emerald-700',
  PICKED_UP: 'bg-slate-100 text-slate-600',
  CANCELED: 'bg-slate-100 text-slate-500',
};

export default async function MeusPedidosPage({ searchParams }: { searchParams: Promise<{ cancelado?: string; erro?: string }> }) {
  const customer = await requireCustomer('/perfil/pedidos');
  const sp = await searchParams;
  const orders = await prisma.order.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: 'desc' },
    take: 60,
    include: { items: true, restaurant: { select: { id: true, name: true } }, unit: { select: { name: true, address: true } } },
  });
  const open = orders.filter((o) => OPEN_STATUSES.includes(o.status as OrderStatus));
  const past = orders.filter((o) => !open.includes(o));

  const card = (o: (typeof orders)[number]) => {
    const st = o.status as OrderStatus;
    return (
      <li key={o.id} className="glass-panel-sm space-y-3 p-4" data-testid="my-order" data-status={o.status}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-bold text-slate-800">
              <Link href={`/lugar/${o.restaurant.id}`} className="link-inline !font-bold">{o.restaurant.name}</Link>
            </p>
            <p className="truncate text-xs text-slate-500">{formatDateTimeBR(o.createdAt)}{o.unit?.address ? ` · ${o.unit.address}` : ''}</p>
          </div>
          <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${CLS[st]}`}>{STATUS_LABEL[st]}</span>
        </div>
        <ul className="space-y-0.5 text-sm text-slate-700">
          {o.items.map((i) => <li key={i.id}>{i.qty}× {i.name}</li>)}
        </ul>
        {o.note && <p className="text-xs text-slate-500">Observação: {o.note}</p>}
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="font-extrabold text-slate-900">{formatBRL(o.totalCents)}</p>
            {st === 'PICKED_UP' && o.pointsAwarded > 0 && <p className="text-xs font-semibold text-emerald-700">+{formatPoints(o.pointsAwarded)} pontos</p>}
            {OPEN_STATUSES.includes(st) && <p className="text-xs text-slate-500">{st === 'READY' ? 'Pague no balcão ao retirar' : `Pague no balcão · ${prepText(o.prepMin)}`}</p>}
          </div>
          {OPEN_STATUSES.includes(st) && (
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Código</p>
              <p className="font-mono text-2xl font-bold tracking-[0.25em] text-electric-600">{o.code}</p>
            </div>
          )}
        </div>
        {st === 'RECEIVED' && (
          <form action={cancelMyOrder}>
            <input type="hidden" name="id" value={o.id} />
            <SubmitButton variant="ghost" pendingText="Cancelando…" className="btn-sm !w-auto">Cancelar pedido</SubmitButton>
          </form>
        )}
      </li>
    );
  };

  return (
    <main className="p-4 sm:p-6 md:pt-8">
      <Link href="/perfil" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-electric-600 hover:text-primary">
        <Icon name="back" size={16} /> Perfil
      </Link>
      <h1 className="text-2xl font-extrabold tracking-tight text-primary">Meus pedidos</h1>
      <p className="mb-5 text-sm text-slate-600">Acompanhe o que você pediu pelo app. Você paga e retira no balcão, mostrando o código.</p>
      {sp.cancelado && <p role="status" className="glass-success mb-4">Pedido cancelado.</p>}
      {sp.erro && <p role="alert" className="glass-error mb-4">{sp.erro}</p>}

      {orders.length === 0 ? (
        <div className="glass-panel mx-auto max-w-xl p-6 text-center">
          <p className="font-bold text-slate-800">Você ainda não fez pedidos</p>
          <p className="mb-4 mt-1 text-sm text-slate-600">Nos lugares que aceitam pedidos pelo app, toque em “Fazer pedido”.</p>
          <Link href="/lugares" className="glass-button">Ver lugares</Link>
        </div>
      ) : (
        <div className="space-y-6">
          {open.length > 0 && (
            <section aria-labelledby="andamento">
              <h2 id="andamento" className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Em andamento</h2>
              <ul className="space-y-3">{open.map(card)}</ul>
            </section>
          )}
          {past.length > 0 && (
            <section aria-labelledby="anteriores">
              <h2 id="anteriores" className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Anteriores</h2>
              <ul className="space-y-3">{past.map(card)}</ul>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
