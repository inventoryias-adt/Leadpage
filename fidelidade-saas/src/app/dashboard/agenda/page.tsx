import Link from 'next/link';
import { bookingAction } from '@/app/actions/agenda';
import { Icon } from '@/components/Icons';
import { addDaysKey, dayStartUtc, formatBookingWhen, hmOf, parseDateKey, todayKey, weekdayOf } from '@/lib/booking';
import { formatPhone } from '@/lib/br';
import { prisma } from '@/lib/db';
import { DAY_NAMES } from '@/lib/hours';
import { formatBRL, formatPoints } from '@/lib/points';
import { requireActiveRestaurant } from '@/lib/session';

export const metadata = { title: 'Agenda' };
export const dynamic = 'force-dynamic';

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Aguardando', cls: 'bg-amber-100 text-amber-800' },
  CONFIRMED: { label: 'Confirmado', cls: 'bg-emerald-100 text-emerald-700' },
  COMPLETED: { label: 'Concluído', cls: 'bg-slate-100 text-slate-600' },
  CANCELED: { label: 'Cancelado', cls: 'bg-slate-100 text-slate-500' },
  NO_SHOW: { label: 'Faltou', cls: 'bg-rose-100 text-rose-700' },
};

type Row = Awaited<ReturnType<typeof load>>[number];

const load = (restaurantId: string, from: Date, to: Date, statuses?: string[]) =>
  prisma.booking.findMany({
    where: { restaurantId, startsAt: { gte: from, lt: to }, ...(statuses ? { status: { in: statuses as never[] } } : {}) },
    orderBy: { startsAt: 'asc' },
    include: { customer: { select: { name: true, phone: true } }, resource: { select: { name: true } }, unit: { select: { name: true } } },
  });

function Actions({ b, back }: { b: Row; back: string }) {
  const btn = (op: string, label: string, cls: string) => (
    <form action={bookingAction}>
      <input type="hidden" name="id" value={b.id} />
      <input type="hidden" name="op" value={op} />
      <input type="hidden" name="back" value={back} />
      <button className={`${cls} btn-sm`} aria-label={`${label}: ${b.serviceName} de ${b.customer.name}`}>{label}</button>
    </form>
  );
  if (b.status === 'PENDING') return <div className="flex flex-wrap gap-2">{btn('confirm', 'Confirmar', 'glass-button')}{btn('cancel', 'Cancelar', 'btn-danger')}</div>;
  if (b.status === 'CONFIRMED')
    return (
      <div className="flex flex-wrap gap-2">
        {btn('complete', 'Concluir', 'glass-button')}
        {btn('noshow', 'Faltou', 'glass-button-ghost')}
        {btn('cancel', 'Cancelar', 'btn-danger')}
      </div>
    );
  return null;
}

function Item({ b, back, showDay }: { b: Row; back: string; showDay?: boolean }) {
  const st = STATUS[b.status];
  return (
    <li className="glass-panel-sm space-y-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-slate-800">
            {showDay ? formatBookingWhen(b.startsAt) : `${hmOf(b.startsAt)} – ${hmOf(b.endsAt)}`} · {b.serviceName}
          </p>
          <p className="truncate text-sm text-slate-700">
            {b.customer.name} · <a href={`https://wa.me/55${b.customer.phone}`} target="_blank" rel="noopener noreferrer" className="link-inline !font-medium">{formatPhone(b.customer.phone)}</a>
          </p>
          <p className="truncate text-xs text-slate-500">
            {[b.resource?.name, b.unit.name, b.partySize ? `${b.partySize} ${b.partySize === 1 ? 'pessoa' : 'pessoas'}` : null, b.priceCents > 0 ? formatBRL(b.priceCents) : null].filter(Boolean).join(' · ')}
          </p>
          {b.note && <p className="mt-1 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600">“{b.note}”</p>}
        </div>
        <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
      </div>
      {b.status === 'COMPLETED' && b.pointsAwarded > 0 && <p className="text-xs font-semibold text-emerald-700">+{formatPoints(b.pointsAwarded)} pontos creditados</p>}
      <Actions b={b} back={back} />
    </li>
  );
}

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ data?: string; ok?: string; erro?: string }> }) {
  const restaurant = await requireActiveRestaurant();
  const sp = await searchParams;
  const today = todayKey();
  const date = sp.data && parseDateKey(sp.data) ? sp.data : today;
  const start = dayStartUtc(date);
  const end = new Date(start.getTime() + 24 * 3_600_000);
  const back = `/dashboard/agenda${date === today ? '' : `?data=${date}`}`;

  const [day, pending, setup] = await Promise.all([
    load(restaurant.id, start, end),
    load(restaurant.id, new Date(), new Date(Date.now() + 365 * 24 * 3_600_000), ['PENDING']),
    prisma.service.count({ where: { restaurantId: restaurant.id, active: true } }),
  ]);
  const pendingOtherDays = pending.filter((b) => b.startsAt < start || b.startsAt >= end);
  const title = date === today ? 'Hoje' : date === addDaysKey(today, 1) ? 'Amanhã' : date === addDaysKey(today, -1) ? 'Ontem' : DAY_NAMES[weekdayOf(date)];
  const [y, m, d] = date.split('-');

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-primary">Agenda</h1>
          <p className="text-sm text-slate-600">Confirme pedidos, conclua os atendimentos (os pontos entram sozinhos) e marque quem faltou.</p>
        </div>
        <Link href="/dashboard/configuracoes#agenda" className="glass-button-ghost btn-sm"><Icon name="cog" size={16} /> Serviços e regras</Link>
      </header>

      {sp.ok && <p role="status" className="glass-success">{sp.ok}</p>}
      {sp.erro && <p role="alert" className="glass-error">{sp.erro}</p>}
      {setup === 0 && <p className="glass-panel-sm p-4 text-sm text-slate-600">Cadastre ao menos um serviço em <Link href="/dashboard/configuracoes#agenda" className="link-inline">Regras → Agenda e serviços</Link> para o cliente poder agendar.</p>}

      {pendingOtherDays.length > 0 && (
        <section aria-labelledby="pend">
          <h2 id="pend" className="mb-3 text-xs font-bold uppercase tracking-wider text-amber-700">Aguardando a sua confirmação ({pendingOtherDays.length})</h2>
          <ul className="space-y-3">{pendingOtherDays.map((b) => <Item key={b.id} b={b} back={back} showDay />)}</ul>
        </section>
      )}

      <nav aria-label="Dia" className="glass-panel-sm flex items-center justify-between gap-2 p-2">
        <Link href={`/dashboard/agenda?data=${addDaysKey(date, -1)}`} className="glass-button-ghost btn-sm" aria-label="Dia anterior"><Icon name="back" size={16} /></Link>
        <div className="text-center">
          <p className="font-bold text-primary">{title}</p>
          <p className="text-xs text-slate-500">{d}/{m}/{y}</p>
        </div>
        <div className="flex items-center gap-2">
          {date !== today && <Link href="/dashboard/agenda" className="link-inline text-xs">Hoje</Link>}
          <Link href={`/dashboard/agenda?data=${addDaysKey(date, 1)}`} className="glass-button-ghost btn-sm" aria-label="Próximo dia"><Icon name="chevron" size={16} /></Link>
        </div>
      </nav>

      {day.length === 0 ? (
        <p className="glass-panel-sm p-4 text-sm text-slate-600">Nenhum agendamento neste dia.</p>
      ) : (
        <ul className="space-y-3">{day.map((b) => <Item key={b.id} b={b} back={back} />)}</ul>
      )}
    </div>
  );
}
