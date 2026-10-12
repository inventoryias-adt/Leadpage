import Link from 'next/link';
import { cancelMyBooking } from '@/app/actions/booking';
import { Icon } from '@/components/Icons';
import { canCustomerCancel, formatBookingWhen } from '@/lib/booking';
import { prisma } from '@/lib/db';
import { formatBRL, formatPoints } from '@/lib/points';
import { requireCustomer } from '@/lib/session';

export const metadata = { title: 'Meus agendamentos' };
export const dynamic = 'force-dynamic';

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Aguardando confirmação', cls: 'bg-amber-100 text-amber-800' },
  CONFIRMED: { label: 'Confirmado', cls: 'bg-emerald-100 text-emerald-700' },
  COMPLETED: { label: 'Concluído', cls: 'bg-slate-100 text-slate-600' },
  CANCELED: { label: 'Cancelado', cls: 'bg-slate-100 text-slate-500' },
  NO_SHOW: { label: 'Não compareceu', cls: 'bg-slate-100 text-slate-500' },
};

export default async function MeusAgendamentosPage({ searchParams }: { searchParams: Promise<{ novo?: string; cancelado?: string; erro?: string }> }) {
  const customer = await requireCustomer('/perfil/agendamentos');
  const sp = await searchParams;
  const now = new Date();
  const all = await prisma.booking.findMany({
    where: { customerId: customer.id },
    orderBy: { startsAt: 'desc' },
    take: 100,
    include: { restaurant: { select: { id: true, name: true, bookingCancelHours: true } }, unit: { select: { name: true, address: true } } },
  });
  const upcoming = all.filter((b) => (b.status === 'PENDING' || b.status === 'CONFIRMED') && b.endsAt > now).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const past = all.filter((b) => !upcoming.includes(b));

  const card = (b: (typeof all)[number], withCancel: boolean) => {
    const st = STATUS[b.status];
    const cancelable = withCancel && canCustomerCancel(b, b.restaurant.bookingCancelHours, now);
    return (
      <li key={b.id} className={`glass-panel-sm space-y-2 p-4 ${sp.novo === b.id ? 'ring-2 ring-electric-500' : ''}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-bold text-slate-800">{b.serviceName}</p>
            <p className="truncate text-sm text-slate-600">{formatBookingWhen(b.startsAt)}</p>
            <p className="truncate text-xs text-slate-500">
              <Link href={`/lugar/${b.restaurant.id}`} className="link-inline !font-medium">{b.restaurant.name}</Link>
              {b.unit.address ? ` · ${b.unit.address}` : ''}
            </p>
          </div>
          <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
        </div>
        <p className="text-xs text-slate-500">
          {b.durationMin} min{b.priceCents > 0 ? ` · ${formatBRL(b.priceCents - b.discountCents)}${b.discountCents > 0 ? ` (desconto de ${formatBRL(b.discountCents)} com ${formatPoints(b.pointsUsed)} pts)` : ''}` : ''}{b.partySize ? ` · ${b.partySize} ${b.partySize === 1 ? 'pessoa' : 'pessoas'}` : ''}
          {b.pointsAwarded > 0 ? ` · +${formatPoints(b.pointsAwarded)} pts` : ''}
        </p>
        {withCancel && (
          cancelable ? (
            <form action={cancelMyBooking}>
              <input type="hidden" name="id" value={b.id} />
              <button className="btn-danger btn-sm" aria-label={`Cancelar ${b.serviceName}`}>Cancelar agendamento</button>
            </form>
          ) : (
            <p className="text-xs text-slate-500">O prazo para cancelar pelo app já passou. Fale com o lugar.</p>
          )
        )}
      </li>
    );
  };

  return (
    <main className="space-y-5 p-4 sm:p-6 md:pt-8">
      <header>
        <Link href="/perfil" className="inline-flex items-center gap-1 text-sm font-semibold text-electric-600"><Icon name="back" size={16} /> Perfil</Link>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-primary">Meus agendamentos</h1>
        <p className="text-sm text-slate-600">Seus horários marcados e o histórico. Quando o atendimento é concluído, os pontos entram na carteira.</p>
      </header>

      {sp.novo && <p role="status" className="glass-success">Agendamento feito! Ele aparece abaixo.</p>}
      {sp.cancelado && <p role="status" className="glass-success">Agendamento cancelado.</p>}
      {sp.erro === 'prazo' && <p role="alert" className="glass-error">O prazo para cancelar pelo app já passou. Fale com o lugar.</p>}

      <section aria-labelledby="prox">
        <h2 id="prox" className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Próximos</h2>
        {upcoming.length === 0 ? (
          <p className="glass-panel-sm p-4 text-sm text-slate-600">
            Nada marcado. Abra um <Link href="/lugares" className="link-inline">lugar</Link> e toque em “Agendar”.
          </p>
        ) : (
          <ul className="space-y-3">{upcoming.map((b) => card(b, true))}</ul>
        )}
      </section>

      {past.length > 0 && (
        <section aria-labelledby="ant">
          <h2 id="ant" className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Anteriores</h2>
          <ul className="space-y-3">{past.map((b) => card(b, false))}</ul>
        </section>
      )}
    </main>
  );
}
