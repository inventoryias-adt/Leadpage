import Link from 'next/link';
import { bookingAction } from '@/app/actions/agenda';
import { AgendaGrid } from '@/components/AgendaGrid';
import { Icon } from '@/components/Icons';
import { PERIODS, PERIOD_LABEL, fmtDay, periodRange, rangeBounds, whatsappText, type AgendaPeriod, type ExportRow } from '@/lib/agenda-export';
import { addDaysKey, dateKeyOf, formatBookingWhen, hmOf, parseDateKey, todayKey, weekdayOf } from '@/lib/booking';
import { formatPhone } from '@/lib/br';
import { imageUrl } from '@/lib/images';
import { prisma } from '@/lib/db';
import { dayWindow, unionWindow, windowLabel } from '@/lib/agenda-hours';
import { DAY_NAMES, parseSchedule } from '@/lib/hours';
import { resourceColor } from '@/lib/palette';
import { formatBRL, formatPoints } from '@/lib/points';
import { requireActiveRestaurant } from '@/lib/session';

export const metadata = { title: 'Agenda' };
export const dynamic = 'force-dynamic';

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Aguardando', cls: 'bg-amber-100 text-amber-800' },
  CONFIRMED: { label: 'Confirmado', cls: 'bg-[#EAF0FF] text-electric-600' },
  COMPLETED: { label: 'Concluído', cls: 'bg-emerald-100 text-emerald-700' },
  CANCELED: { label: 'Cancelado', cls: 'bg-slate-100 text-slate-500' },
  NO_SHOW: { label: 'Faltou', cls: 'bg-rose-100 text-rose-700' },
};

type Row = Awaited<ReturnType<typeof load>>[number];

const load = (restaurantId: string, from: Date, to: Date, opts: { statuses?: string[]; resourceId?: string } = {}) =>
  prisma.booking.findMany({
    where: {
      restaurantId,
      startsAt: { gte: from, lt: to },
      ...(opts.statuses ? { status: { in: opts.statuses as never[] } } : {}),
      ...(opts.resourceId ? { resourceId: opts.resourceId } : {}),
    },
    orderBy: { startsAt: 'asc' },
    include: { customer: { select: { name: true, phone: true } }, resource: { select: { name: true, color: true } }, unit: { select: { name: true } } },
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
    <li id={`ag-${b.id}`} className="glass-panel-sm scroll-mt-4 space-y-2 border-l-4 p-4" style={{ borderLeftColor: b.resource ? resourceColor({ id: b.resourceId ?? '', color: b.resource.color }).hex : undefined }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-slate-800">
            {showDay ? formatBookingWhen(b.startsAt) : `${hmOf(b.startsAt)} – ${hmOf(b.endsAt)}`} · {b.serviceName}
          </p>
          <p className="truncate text-sm text-slate-700">
            {b.customer.name} · <a href={`https://wa.me/55${b.customer.phone}`} target="_blank" rel="noopener noreferrer" className="link-inline !font-medium">{formatPhone(b.customer.phone)}</a>
          </p>
          <p className="truncate text-xs text-slate-500">
            {[b.resource?.name, b.unit.name, b.partySize ? `${b.partySize} ${b.partySize === 1 ? 'pessoa' : 'pessoas'}` : null, b.priceCents > 0 ? `a cobrar ${formatBRL(b.priceCents - b.discountCents)}` : null].filter(Boolean).join(' · ')}
          </p>
          {b.note && <p className="mt-1 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600">“{b.note}”</p>}
        </div>
        <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
      </div>
      {b.discountCents > 0 && (
        <p className="text-xs font-semibold text-electric-600">
          Desconto de {formatBRL(b.discountCents)} com {formatPoints(b.pointsUsed)} pontos do cliente{b.status === 'CANCELED' ? ' (devolvidos)' : ''}. Valor cheio: {formatBRL(b.priceCents)}.
        </p>
      )}
      {(b.status === 'PENDING' || b.status === 'CONFIRMED') && b.reminderAnswer === 'OK' && <p className="text-xs font-semibold text-emerald-700">Cliente confirmou presença no lembrete.</p>}
      {(b.status === 'PENDING' || b.status === 'CONFIRMED') && b.reminderSentAt && !b.reminderAnswer && <p className="text-xs text-slate-500">Lembrete enviado às {hmOf(b.reminderSentAt)}; o cliente ainda não respondeu.</p>}
      {b.status === 'CANCELED' && b.reminderAnswer === 'NO' && <p className="text-xs font-semibold text-slate-600">O cliente avisou que não vai e liberou o horário.</p>}
      {b.status === 'COMPLETED' && b.pointsAwarded > 0 && <p className="text-xs font-semibold text-emerald-700">+{formatPoints(b.pointsAwarded)} pontos creditados</p>}
      <Actions b={b} back={back} />
    </li>
  );
}

const toExport = (b: Row): ExportRow => ({
  startsAt: b.startsAt,
  endsAt: b.endsAt,
  serviceName: b.serviceName,
  customerName: b.customer.name,
  customerPhone: b.customer.phone,
  resourceName: b.resource?.name ?? null,
  status: b.status,
  priceCents: b.priceCents,
  discountCents: b.discountCents,
  partySize: b.partySize,
  note: b.note,
});

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ data?: string; per?: string; prof?: string; vista?: string; ok?: string; erro?: string }> }) {
  const restaurant = await requireActiveRestaurant();
  const sp = await searchParams;
  const today = todayKey();
  const date = sp.data && parseDateKey(sp.data) ? sp.data : today;
  const per: AgendaPeriod = (PERIODS as readonly string[]).includes(sp.per ?? '') ? (sp.per as AgendaPeriod) : 'dia';
  const range = periodRange(per, date);
  const { start, end } = rangeBounds(range.from, range.to);

  const staff = await prisma.resource.findMany({ where: { restaurantId: restaurant.id }, orderBy: { name: 'asc' }, select: { id: true, name: true, phone: true, color: true, photoImageId: true, active: true, schedule: true } });
  const who = staff.find((r) => r.id === sp.prof) ?? null; // só aceita profissional deste estabelecimento

  // No dia, a grade é a vista principal; "Ver agendamentos" troca para a lista (com os botões de confirmar, concluir, etc.).
  const vista: 'grade' | 'lista' = per === 'dia' && sp.vista === 'lista' ? 'lista' : 'grade';
  const qs = (over: { data?: string; per?: AgendaPeriod; prof?: string | null; vista?: 'grade' | 'lista' }) => {
    const q = new URLSearchParams();
    const d = over.data ?? date, p = over.per ?? per, f = over.prof === undefined ? who?.id : over.prof;
    const v = over.vista ?? vista;
    if (d !== today) q.set('data', d);
    if (p !== 'dia') q.set('per', p);
    if (f) q.set('prof', f);
    if (p === 'dia' && v === 'lista') q.set('vista', 'lista');
    const text = q.toString();
    return text ? `?${text}` : '';
  };
  const href = (over: Parameters<typeof qs>[0]) => `/dashboard/agenda${qs(over)}`;
  const back = href({});

  const [list, pending, setup, units] = await Promise.all([
    load(restaurant.id, start, end, { resourceId: who?.id }),
    load(restaurant.id, new Date(), new Date(Date.now() + 365 * 24 * 3_600_000), { statuses: ['PENDING'], resourceId: who?.id }),
    prisma.service.count({ where: { restaurantId: restaurant.id, active: true } }),
    prisma.unit.findMany({ where: { restaurantId: restaurant.id, active: true }, select: { openingSchedule: true } }),
  ]);
  const weekday = weekdayOf(date);
  const openWindow = unionWindow(units.map((u) => dayWindow(parseSchedule(u.openingSchedule), weekday)));
  const pendingOtherDays = pending.filter((b) => b.startsAt < start || b.startsAt >= end);

  // Agrupa por dia (Brasília) para as visões de semana e mês.
  const byDay = new Map<string, Row[]>();
  for (const b of list) byDay.set(dateKeyOf(b.startsAt), [...(byDay.get(dateKeyOf(b.startsAt)) ?? []), b]);

  const title = date === today ? 'Hoje' : date === addDaysKey(today, 1) ? 'Amanhã' : date === addDaysKey(today, -1) ? 'Ontem' : DAY_NAMES[weekdayOf(date)];
  const [y, m, d] = date.split('-');
  const step = per === 'dia' ? 1 : per === 'semana' ? 7 : 0;
  const prevDate = per === 'mes' || per === 'mes-passado' ? addDaysKey(range.from, -1) : addDaysKey(date, -step);
  const nextDate = per === 'mes' || per === 'mes-passado' ? addDaysKey(range.to, 1) : addDaysKey(date, step);
  const navPer: AgendaPeriod = per === 'mes-passado' ? 'mes' : per;
  const heading = per === 'dia' ? title : PERIOD_LABEL[per];
  const sub = per === 'dia' ? `${d}/${m}/${y}` : range.label;

  const text = whatsappText(list.map(toExport), { who: who?.name ?? null, label: range.label });
  const waHref = `https://wa.me/${who?.phone ? `55${who.phone}` : ''}?text=${encodeURIComponent(text)}`;
  const csvHref = `/dashboard/agenda/exportar${(() => { const q = new URLSearchParams({ data: date, per }); if (who) q.set('prof', who.id); return `?${q}`; })()}`;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-primary">Agenda</h1>
          <p className="text-sm text-slate-600">Confirme pedidos, conclua os atendimentos (os pontos entram sozinhos) e marque quem faltou.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {per === 'dia' && (
            <Link href={href({ vista: vista === 'grade' ? 'lista' : 'grade' })} className="glass-button-navy btn-sm" data-testid="toggle-vista">
              <Icon name={vista === 'grade' ? 'receipt' : 'clock'} size={16} /> {vista === 'grade' ? `Ver agendamentos${list.length ? ` (${list.length})` : ''}` : 'Ver grade do dia'}
            </Link>
          )}
          <Link href="/dashboard/configuracoes#agenda" className="glass-button-ghost btn-sm"><Icon name="cog" size={16} /> Serviços e regras</Link>
        </div>
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

      <section aria-label="Filtros" className="space-y-2">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Período">
          {PERIODS.map((p) => (
            <Link key={p} href={href({ per: p, data: p === 'mes-passado' ? date : date })} aria-current={p === per ? 'true' : undefined} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${p === per ? 'bg-electric-500 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
              {PERIOD_LABEL[p]}
            </Link>
          ))}
        </div>
        {staff.length > 0 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Profissional">
            <Link href={href({ prof: null })} aria-current={!who ? 'true' : undefined} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${!who ? 'bg-electric-500 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}`}>Todos</Link>
            {staff.map((r) => (
              <Link key={r.id} href={href({ prof: r.id })} aria-current={who?.id === r.id ? 'true' : undefined} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${who?.id === r.id ? 'bg-electric-500 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}`}><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-baseline" style={{ background: resourceColor(r).hex }} />{r.name}</Link>
            ))}
          </div>
        )}
      </section>

      <nav aria-label="Período" className="glass-panel-sm flex items-center justify-between gap-2 p-2">
        <Link href={href({ data: prevDate, per: navPer })} className="glass-button-ghost btn-sm" aria-label="Anterior"><Icon name="back" size={16} /></Link>
        <div className="text-center">
          <p className="font-bold text-primary">{heading}</p>
          <p className="text-xs text-slate-500">{sub}{who ? ` · ${who.name}` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          {(date !== today || per !== 'dia') && <Link href={href({ data: today, per })} className="link-inline text-xs">Hoje</Link>}
          <Link href={href({ data: nextDate, per: navPer })} className="glass-button-ghost btn-sm" aria-label="Próximo"><Icon name="chevron" size={16} /></Link>
        </div>
      </nav>

      <div className="flex flex-wrap gap-2">
        <a href={waHref} target="_blank" rel="noopener noreferrer" className="glass-button btn-sm">
          Enviar pelo WhatsApp{who ? ` para ${who.name.split(' ')[0]}` : ''}
        </a>
        <a href={csvHref} className="glass-button-ghost btn-sm" download>Baixar planilha (CSV)</a>
      </div>
      {who && !who.phone && <p className="text-xs text-slate-500">{who.name} não tem WhatsApp cadastrado: o WhatsApp abrirá para você escolher o contato. Cadastre em Regras → Agenda e serviços.</p>}

      {per === 'dia' && vista === 'grade' && list.length > 0 && (
        <AgendaGrid
          open={openWindow}
          openLabel={openWindow && openWindow !== 'closed' ? windowLabel(openWindow) : undefined}
          linkBase={href({ vista: 'lista' })}
          staff={(who ? [who] : staff.filter((r) => r.active || list.some((b) => b.resourceId === r.id))).map((r) => ({ id: r.id, name: r.name, color: r.color, photoUrl: imageUrl(r.photoImageId), work: dayWindow(parseSchedule(r.schedule), weekday) }))}
          bookings={list.map((b) => ({ id: b.id, resourceId: b.resourceId, startsAt: b.startsAt, endsAt: b.endsAt, serviceName: b.serviceName, customerName: b.customer.name, status: b.status }))}
          nowMin={date === today ? (() => { const hm = hmOf(new Date()); return Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5)); })() : null}
        />
      )}

      {list.length === 0 ? (
        <p className="glass-panel-sm p-4 text-sm text-slate-600">Nenhum agendamento {per === 'dia' ? 'neste dia' : 'neste período'}{who ? ` para ${who.name}` : ''}.</p>
      ) : per === 'dia' ? (
        vista === 'lista' && <ul className="space-y-3" aria-label="Agendamentos do dia">{list.map((b) => <Item key={b.id} b={b} back={back} />)}</ul>
      ) : (
        <div className="space-y-5">
          {[...byDay.entries()].map(([key, items]) => (
            <section key={key} aria-label={`${DAY_NAMES[weekdayOf(key)]}, ${fmtDay(key)}`}>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{DAY_NAMES[weekdayOf(key)]}, {fmtDay(key)} · {items.length}</h2>
              <ul className="space-y-3">{items.map((b) => <Item key={b.id} b={b} back={back} />)}</ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
