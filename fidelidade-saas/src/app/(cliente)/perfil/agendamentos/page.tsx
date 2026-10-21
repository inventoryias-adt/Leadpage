import Link from 'next/link';
import { answerBookingReminder, cancelMyBooking, leaveWaitingList } from '@/app/actions/booking';
import { Icon } from '@/components/Icons';
import { WAIT_PERIODS, bookingPoints, canCustomerCancel, formatBookingWhen, todayKey } from '@/lib/booking';
import { waitPosition } from '@/lib/booking-db';
import { directionsUrl, googleCalendarUrl } from '@/lib/calendar-links';
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

export default async function MeusAgendamentosPage({ searchParams }: { searchParams: Promise<{ novo?: string; remarcado?: string; cancelado?: string; erro?: string; lembrete?: string; presenca?: string; liberado?: string; espera?: string }> }) {
  const customer = await requireCustomer('/perfil/agendamentos');
  const sp = await searchParams;
  const now = new Date();
  const all = await prisma.booking.findMany({
    where: { customerId: customer.id },
    orderBy: { startsAt: 'desc' },
    take: 100,
    include: { restaurant: { select: { id: true, name: true, bookingCancelHours: true, pointsPerReal: true } }, unit: { select: { name: true, address: true } }, resource: { select: { name: true } } },
  });
  const waiting = await prisma.waitlistEntry.findMany({
    where: { customerId: customer.id, status: 'WAITING', date: { gte: todayKey(now) } },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    include: { service: { select: { name: true } }, restaurant: { select: { id: true, name: true } }, resource: { select: { name: true } } },
  });
  const waitingAt = await Promise.all(waiting.map((w) => waitPosition(w)));
  const upcoming = all.filter((b) => (b.status === 'PENDING' || b.status === 'CONFIRMED') && b.endsAt > now).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const past = all.filter((b) => !upcoming.includes(b));
  const fresh = sp.novo ? all.find((b) => b.id === sp.novo) ?? null : null;
  const freshPoints = fresh ? bookingPoints(fresh.priceCents - fresh.discountCents, fresh.restaurant.pointsPerReal) : 0;

  type Row = (typeof all)[number];
  const eventOf = (b: Row) => ({
    uid: b.id,
    title: `${b.serviceName} · ${b.restaurant.name}`,
    startsAt: b.startsAt,
    endsAt: b.endsAt,
    location: b.unit.address ?? b.restaurant.name,
    description: `${b.resource ? `Com ${b.resource.name}. ` : ''}Agendado pelo Fidelize.`,
  });
  /** Levar o horário para o calendário do celular e chegar lá. */
  const calendarLinks = (b: Row) => (
    <div className="flex flex-wrap gap-2" data-testid="calendar-links">
      <a href={`/perfil/agendamentos/${b.id}/calendario`} className="glass-button btn-sm" aria-label={`Adicionar ${b.serviceName} ao calendário`}><Icon name="calendar" size={15} /> Adicionar ao calendário</a>
      <a href={googleCalendarUrl(eventOf(b))} target="_blank" rel="noopener noreferrer" className="glass-button btn-sm">Google Agenda</a>
      {b.unit.address && <a href={directionsUrl(b.unit.address)} target="_blank" rel="noopener noreferrer" className="glass-button btn-sm"><Icon name="pin" size={15} /> Como chegar</a>}
    </div>
  );

  const card = (b: Row, withCancel: boolean) => {
    const st = STATUS[b.status];
    const cancelable = withCancel && canCustomerCancel(b, b.restaurant.bookingCancelHours, now);
    return (
      <li key={b.id} className={`glass-panel-sm space-y-2 p-4 ${sp.novo === b.id || sp.remarcado === b.id ? 'ring-2 ring-electric-500' : ''}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-bold text-slate-800">{b.serviceName}</p>
            <p className="truncate text-sm text-slate-600">{formatBookingWhen(b.startsAt)}{b.resource ? ` · com ${b.resource.name}` : ''}</p>
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
        {withCancel && b.reminderSentAt && !b.reminderAnswer && (
          <div role="group" aria-label={`Está tudo certo? ${b.serviceName}`} className={`space-y-2 rounded-xl bg-electric-600/10 p-3 ${sp.lembrete === b.id ? 'ring-2 ring-electric-500' : ''}`}>
            <p className="text-sm font-bold text-slate-800">Está tudo certo para o seu horário?</p>
            <p className="text-xs text-slate-600">Se não puder ir, libere o horário para outra pessoa usar. Se não responder, mantemos o seu horário.</p>
            <div className="flex flex-wrap gap-2">
              <form action={answerBookingReminder}>
                <input type="hidden" name="id" value={b.id} /><input type="hidden" name="answer" value="yes" />
                <button className="glass-button btn-sm">Sim, estarei lá</button>
              </form>
              <form action={answerBookingReminder}>
                <input type="hidden" name="id" value={b.id} /><input type="hidden" name="answer" value="no" />
                <button className="btn-danger btn-sm">Não vou poder ir</button>
              </form>
            </div>
          </div>
        )}
        {withCancel && calendarLinks(b)}
        {withCancel && b.reminderAnswer === 'OK' && <p className="text-xs font-semibold text-emerald-700">Você confirmou que vai. Até já!</p>}
        {withCancel && (
          cancelable ? (
            <div className="flex flex-wrap gap-2">
              {b.serviceId && b.unitId && (
                <Link href={`/lugar/${b.restaurant.id}/agendar?reagendar=${b.id}`} className="glass-button-navy btn-sm" aria-label={`Reagendar ${b.serviceName}`} data-testid="reschedule">
                  <Icon name="clock" size={15} /> Reagendar
                </Link>
              )}
              <form action={cancelMyBooking}>
                <input type="hidden" name="id" value={b.id} />
                <button className="btn-danger btn-sm" aria-label={`Cancelar ${b.serviceName}`}>Cancelar agendamento</button>
              </form>
            </div>
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

      {fresh && (
        <section role="status" data-testid="booking-success" aria-label="Agendamento feito" className="space-y-3 rounded-[24px] bg-primary p-5 text-white">
          <p className="flex items-center gap-2 text-sm font-semibold text-lime-300"><Icon name="check" size={18} /> {fresh.status === 'CONFIRMED' ? 'Horário garantido!' : 'Pedido enviado! O lugar vai confirmar.'}</p>
          <div>
            <p className="text-xl font-extrabold tracking-tight">{fresh.serviceName}</p>
            <p className="text-sm text-white/80">{formatBookingWhen(fresh.startsAt)}{fresh.resource ? ` · com ${fresh.resource.name}` : ''}</p>
            <p className="text-sm text-white/70">{fresh.restaurant.name}{fresh.unit.address ? ` · ${fresh.unit.address}` : ''}</p>
          </div>
          {freshPoints > 0 && <p className="text-sm"><span className="chip-lima">Ao concluir você ganha +{formatPoints(freshPoints)} pontos</span></p>}
        </section>
      )}
      {sp.cancelado && <p role="status" className="glass-success">Agendamento cancelado.</p>}
      {sp.remarcado && <p role="status" className="glass-success">Horário remarcado! O novo horário aparece abaixo.</p>}
      {sp.presenca && <p role="status" className="glass-success">Combinado! Avisamos o lugar que você vai.</p>}
      {sp.espera === 'saiu' && <p role="status" className="glass-success">Você saiu da lista de espera.</p>}
      {sp.liberado && <p role="status" className="glass-success">Horário liberado. Obrigado por avisar!</p>}
      {sp.erro && sp.erro !== 'prazo' && <p role="alert" className="glass-error">{sp.erro}</p>}
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

      {waiting.length > 0 && (
        <section aria-labelledby="espera" data-testid="my-waitlist">
          <h2 id="espera" className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Lista de espera</h2>
          <ul className="space-y-3">
            {waiting.map((w, i) => (
              <li key={w.id} className="glass-panel-sm space-y-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-800">{w.service.name}</p>
                    <p className="truncate text-sm text-slate-600">{formatBookingWhen(new Date(`${w.date}T12:00:00-03:00`)).split(' às ')[0]} · {WAIT_PERIODS[w.period as keyof typeof WAIT_PERIODS] ?? 'Qualquer horário'}{w.resource ? ` · com ${w.resource.name}` : ''}</p>
                    <p className="truncate text-xs text-slate-500"><Link href={`/lugar/${w.restaurant.id}`} className="link-inline !font-medium">{w.restaurant.name}</Link> · {waitingAt[i]}º da fila</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-[#EAF0FF] px-2 py-0.5 text-xs font-semibold text-electric-600">Esperando</span>
                </div>
                <p className="text-xs text-slate-500">Avisamos no app quando abrir um horário. Quem confirmar primeiro fica com ele.</p>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/lugar/${w.restaurant.id}/agendar?servico=${w.serviceId}&unidade=${w.unitId}&data=${w.date}`} className="glass-button btn-sm">Ver horários</Link>
                  <form action={leaveWaitingList}>
                    <input type="hidden" name="id" value={w.id} />
                    <button className="btn-danger btn-sm" aria-label={`Sair da lista de ${w.service.name}`}>Sair da lista</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {past.length > 0 && (
        <section aria-labelledby="ant">
          <h2 id="ant" className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Anteriores</h2>
          <ul className="space-y-3">{past.map((b) => card(b, false))}</ul>
        </section>
      )}
    </main>
  );
}
